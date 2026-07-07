import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { hashOtpCode } from "@/lib/auth/otp-utils";
import type { Order, OrderApprovalRequest } from "@/types/models";

const ownerApprovalSchema = z.object({
  approvalRequestId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  otpCode: z.string().length(6).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = ownerApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    }

    const approvalSnap = await adminDb.ref(`orderApprovalRequests/${parsed.data.approvalRequestId}`).get();
    if (!approvalSnap.exists()) return NextResponse.json({ message: "Approval request not found" }, { status: 404 });

    const approval = approvalSnap.val() as OrderApprovalRequest;
    if (approval.ownerUid !== session.uid) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (approval.status !== "PENDING") return NextResponse.json({ message: "Approval request already handled" }, { status: 409 });
    if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
      await adminDb.ref(`orderApprovalRequests/${approval.id}/status`).set("EXPIRED");
      return NextResponse.json({ message: "Approval OTP expired" }, { status: 410 });
    }
    if (approval.hashedOtp && (!parsed.data.otpCode || hashOtpCode(parsed.data.otpCode) !== approval.hashedOtp)) {
      return NextResponse.json({ message: "Invalid OTP" }, { status: 401 });
    }

    const orderSnap = await adminDb.ref(`orders/${approval.orderId}`).get();
    if (!orderSnap.exists()) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    const order = orderSnap.val() as Order;

    const now = new Date().toISOString();
    const approved = parsed.data.action === "APPROVE";
    const nextStatus = approved ? "SUBMITTED" : "REJECTED";
    const approvalStatus = approved ? "APPROVED" : "REJECTED";

    await adminDb.ref().update({
      [`orderApprovalRequests/${approval.id}/status`]: approvalStatus,
      [`orderApprovalRequests/${approval.id}/respondedAt`]: now,
      [`orders/${approval.orderId}/status`]: nextStatus,
      [`orders/${approval.orderId}/ownerApprovalStatus`]: approvalStatus,
      [`orders/${approval.orderId}/updatedAt`]: now,
      [`orders/${approval.orderId}/statusHistory/${now}`]: {
        from: order.status,
        to: nextStatus,
        changedBy: session.uid,
        changedAt: now,
        notes: approved ? "Owner approved order" : "Owner rejected order",
      },
      [`ordersByStore/${order.customerStoreId}/${approval.orderId}/status`]: nextStatus,
      [`ordersByStatus/${order.status}/${approval.orderId}`]: null,
      [`ordersByStatus/${nextStatus}/${approval.orderId}`]: {
        orderId: approval.orderId,
        storeId: order.customerStoreId,
        createdAt: now,
      },
      [`notifications/${session.uid}/${approval.id}/read`]: true,
    });

    return NextResponse.json({ orderId: approval.orderId, status: nextStatus });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
