import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth/session";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { adminDb } from "@/lib/db/admin";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-auth";
import { writeAuditLog } from "@/lib/services/audit-service";
import { verifyOrderOtpSchema } from "@/lib/validation/schemas";
import type { KhataLedgerEntry, Order, Distributor } from "@/types/models";

const MAX_AUTH_AGE_SECONDS = 5 * 60;

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `••••${digits.slice(-4)}`;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const parsed = verifyOrderOtpSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Invalid verification request" }, { status: 400 });

    const orderSnap = await adminDb.ref(`orders/${parsed.data.orderId}`).get();
    if (!orderSnap.exists()) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    const order = orderSnap.val() as Order;
    const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
    if (session.role !== "DISTRIBUTOR" || !distributorIds.includes(order.distributorId)) {
      return NextResponse.json({ message: "Only the linked distributor can approve this order" }, { status: 403 });
    }
    if (order.status !== "PENDING_OTP" || order.otpStatus === "VERIFIED") {
      return NextResponse.json({ message: "This order is not waiting for OTP approval" }, { status: 400 });
    }

    const distributorSnap = await adminDb.ref(`stores/${order.distributorId}`).get();
    if (!distributorSnap.exists()) return NextResponse.json({ message: "Distributor not found" }, { status: 404 });
    const distributor = distributorSnap.val() as Distributor;
    if (!distributor.phone) return NextResponse.json({ message: "Distributor phone number is not configured" }, { status: 400 });

    const decoded = await getFirebaseAdminAuth().verifyIdToken(parsed.data.firebaseIdToken, true);
    if (decoded.firebase.sign_in_provider !== "phone" || !decoded.phone_number) {
      return NextResponse.json({ message: "Firebase phone verification is required" }, { status: 403 });
    }
    if (decoded.uid !== session.uid) {
      return NextResponse.json({ message: "The verified Firebase account does not match this session" }, { status: 403 });
    }
    if (Math.floor(Date.now() / 1000) - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
      return NextResponse.json({ message: "Verification expired. Request a new Firebase OTP." }, { status: 401 });
    }
    if (normalizePhoneNumber(decoded.phone_number) !== normalizePhoneNumber(distributor.phone)) {
      return NextResponse.json({ message: "The verified phone does not match this distributor" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const nextStatus = order.cfId ? "PENDING_CF_APPROVAL" : "OTP_VERIFIED";
    const statusHistoryId = uuidv4();
    const updates: Record<string, unknown> = {
      [`orders/${order.id}/otpStatus`]: "VERIFIED",
      [`orders/${order.id}/otpChannel`]: "firebase_sms",
      [`orders/${order.id}/otpDestination`]: maskPhone(decoded.phone_number),
      [`orders/${order.id}/otpExpiresAt`]: null,
      [`orders/${order.id}/status`]: nextStatus,
      [`orders/${order.id}/updatedAt`]: now,
      [`orders/${order.id}/statusHistory/${statusHistoryId}`]: {
        from: order.status,
        to: nextStatus,
        changedBy: session.uid,
        changedAt: now,
        notes: "Approved by distributor using Firebase Phone Auth OTP",
      },
      [`ordersByDistributor/${order.distributorId}/${order.id}/status`]: nextStatus,
      [`ordersByStatus/${order.status}/${order.id}`]: null,
      [`ordersByStatus/${nextStatus}/${order.id}`]: { orderId: order.id, distributorId: order.distributorId, createdAt: now },
    };

    if (order.paymentMode === "PAY_LATER" && order.khataEntryId) {
      const ledgerPath = `khataLedger/${order.distributorId}/${order.khataEntryId}`;
      const existingLedger = await adminDb.ref(ledgerPath).get();
      if (!existingLedger.exists()) {
        const balanceSnap = await adminDb.ref(`khataBalances/${order.distributorId}/balancePaise`).get();
        const currentBalance = Number(balanceSnap.val()) || 0;
        const balanceAfter = currentBalance + order.totalPaise;
        const khataEntry: KhataLedgerEntry = {
          id: order.khataEntryId,
          storeId: order.distributorId,
          orderId: order.id,
          type: "DEBIT",
          amountPaise: order.totalPaise,
          balanceAfterPaise: balanceAfter,
          notes: order.notes || "ASM order approved with Firebase OTP",
          createdBy: session.uid,
          createdAt: now,
        };
        updates[ledgerPath] = khataEntry;
        updates[`khataBalances/${order.distributorId}`] = { storeId: order.distributorId, balancePaise: balanceAfter, updatedAt: now };
      }
    }

    await adminDb.ref().update(updates);
    await writeAuditLog({
      actorId: session.uid,
      action: "OTP_VERIFIED",
      entityType: "ORDER",
      entityId: order.id,
      before: { otpStatus: order.otpStatus, status: order.status },
      after: { otpStatus: "VERIFIED", status: nextStatus, provider: "FIREBASE_PHONE_AUTH" },
    }).catch((auditError) => console.error("[Order OTP] Audit log failed:", auditError));

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error) {
    console.error("[Order OTP] Firebase verification failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "Firebase OTP verification failed" }, { status: 401 });
  }
}
