import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { verifyOrderOtpSchema } from "@/lib/validation/schemas";
import { hashOtpCode } from "@/lib/auth/otp-utils";
import { v4 as uuidv4 } from "uuid";
import type { Order, OrderOtpRequest } from "@/types/models";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = verifyOrderOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const { orderId, otpCode } = parsed.data;
    const now = new Date().toISOString();

    // Get the order
    const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
    if (!orderSnap.exists()) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    const order = orderSnap.val() as Order;

    if (order.otpStatus !== "PENDING") {
      return NextResponse.json({ message: "No pending OTP verification for this order" }, { status: 400 });
    }

    if (!order.otpRequestId) {
      return NextResponse.json({ message: "No OTP request found" }, { status: 400 });
    }

    // Get the OTP request
    const otpSnap = await adminDb.ref(`orderOtpRequests/${order.otpRequestId}`).get();
    if (!otpSnap.exists()) {
      return NextResponse.json({ message: "OTP request not found" }, { status: 404 });
    }
    const otpRequest = otpSnap.val() as OrderOtpRequest;

    // Check expiry
    if (new Date(otpRequest.expiresAt) < new Date()) {
      await adminDb.ref(`orderOtpRequests/${order.otpRequestId}`).update({ status: "EXPIRED" });
      await adminDb.ref(`orders/${orderId}`).update({ otpStatus: "EXPIRED", status: "DRAFT", updatedAt: now });
      return NextResponse.json({ message: "OTP has expired. Please request a new OTP." }, { status: 410 });
    }

    // Check attempts
    if (otpRequest.attempts >= otpRequest.maxAttempts) {
      await adminDb.ref(`orderOtpRequests/${order.otpRequestId}`).update({ status: "FAILED" });
      await adminDb.ref(`orders/${orderId}`).update({ otpStatus: "FAILED", status: "DRAFT", updatedAt: now });
      return NextResponse.json({ message: "Max OTP attempts exceeded" }, { status: 429 });
    }

    // Verify OTP
    const hashedInput = await hashOtpCode(otpCode);
    const isValid = hashedInput === otpRequest.hashedOtp;

    if (!isValid) {
      await adminDb.ref(`orderOtpRequests/${order.otpRequestId}`).update({
        attempts: otpRequest.attempts + 1,
      });
      return NextResponse.json({ message: "Invalid OTP code" }, { status: 400 });
    }

    // OTP verified — update order and OTP request
    const statusHistoryId = uuidv4();
    const updates: Record<string, unknown> = {
      [`orderOtpRequests/${order.otpRequestId}/status`]: "VERIFIED",
      [`orderOtpRequests/${order.otpRequestId}/verifiedAt`]: now,
      [`orders/${orderId}/otpStatus`]: "VERIFIED",
      [`orders/${orderId}/status`]: order.cfId ? "PENDING_CF_APPROVAL" : "OTP_VERIFIED",
      [`orders/${orderId}/updatedAt`]: now,
      [`orders/${orderId}/statusHistory/${statusHistoryId}`]: {
        from: order.status,
        to: order.cfId ? "PENDING_CF_APPROVAL" : "OTP_VERIFIED",
        changedBy: session.uid,
        changedAt: now,
        notes: "OTP verified by distributor",
      },
    };

    await adminDb.ref().update(updates);

    return NextResponse.json({ success: true, status: order.cfId ? "PENDING_CF_APPROVAL" : "OTP_VERIFIED" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
