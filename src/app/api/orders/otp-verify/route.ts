import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-auth";
import {
  canSessionVerifyDistributorOrder,
  OrderOtpValidationError,
  validateFirebaseOrderIdentity,
} from "@/lib/orders/workflow";
import { writeAuditLog } from "@/lib/services/audit-service";
import { notifyOrderParticipants } from "@/lib/notifications/order-events";
import { verifyOrderOtpSchema } from "@/lib/validation/schemas";
import type { KhataLedgerEntry, Order, Distributor, User } from "@/types/models";

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
    if (!canSessionVerifyDistributorOrder(session, order)) {
      return NextResponse.json({ message: "Only the linked distributor can approve this order" }, { status: 403 });
    }
    if (order.status !== "PENDING_OTP" || order.otpStatus === "VERIFIED") {
      return NextResponse.json({ message: "This order is not waiting for OTP approval" }, { status: 400 });
    }

    const [distributorSnap, userSnap] = await Promise.all([
      adminDb.ref(`stores/${order.distributorId}`).get(),
      adminDb.ref(`users/${session.uid}`).get(),
    ]);
    if (!distributorSnap.exists()) return NextResponse.json({ message: "Distributor not found" }, { status: 404 });
    const distributor = distributorSnap.val() as Distributor;
    const applicationUser = userSnap.exists() ? userSnap.val() as User : null;
    if (!distributor.phone) return NextResponse.json({ message: "Distributor phone number is not configured" }, { status: 400 });

    const decoded = await getFirebaseAdminAuth().verifyIdToken(parsed.data.firebaseIdToken, true);
    if (decoded.firebase.sign_in_provider !== "phone" || !decoded.phone_number) {
      return NextResponse.json({ message: "Firebase phone verification is required" }, { status: 403 });
    }
    validateFirebaseOrderIdentity({
      firebaseUid: decoded.uid,
      firebasePhone: decoded.phone_number,
      firebaseAuthTime: decoded.auth_time,
      sessionUid: session.uid,
      sessionPhone: session.phone,
      linkedFirebaseUid: applicationUser?.firebaseUid,
      distributorPhone: distributor.phone,
      maxAgeSeconds: MAX_AUTH_AGE_SECONDS,
    });

    const now = new Date().toISOString();
    const nextStatus = order.cfId ? "PENDING_CF_APPROVAL" : "OTP_VERIFIED";
    const otpHistoryId = uuidv4();
    const updates: Record<string, unknown> = {
      [`orders/${order.id}/otpStatus`]: "VERIFIED",
      [`orders/${order.id}/otpChannel`]: "firebase_sms",
      [`orders/${order.id}/otpDestination`]: maskPhone(decoded.phone_number),
      [`orders/${order.id}/otpExpiresAt`]: null,
      [`orders/${order.id}/otpVerifiedAt`]: now,
      [`orders/${order.id}/otpVerifiedBy`]: session.uid,
      [`orders/${order.id}/status`]: nextStatus,
      [`orders/${order.id}/updatedAt`]: now,
      [`orders/${order.id}/statusHistory/${otpHistoryId}`]: {
        from: order.status,
        to: "OTP_VERIFIED",
        changedBy: session.uid,
        changedAt: now,
        notes: "Approved by distributor using Firebase Phone Auth OTP",
      },
      [`ordersByDistributor/${order.distributorId}/${order.id}/status`]: nextStatus,
      [`ordersByStatus/${order.status}/${order.id}`]: null,
      [`ordersByStatus/${nextStatus}/${order.id}`]: { orderId: order.id, distributorId: order.distributorId, createdAt: now },
    };

    if (order.cfId) {
      updates[`orders/${order.id}/statusHistory/${uuidv4()}`] = {
        from: "OTP_VERIFIED",
        to: "PENDING_CF_APPROVAL",
        changedBy: session.uid,
        changedAt: now,
        notes: "Distributor approval complete; awaiting assigned C&F approval",
      };
    }

    if (order.paymentMode === "PAY_LATER" && order.khataEntryId) {
      const ledgerPath = `khataLedger/${order.distributorId}/${order.khataEntryId}`;
      const existingLedger = await adminDb.ref(ledgerPath).get();
      if (!existingLedger.exists()) {
        const balanceResult = await adminDb.ref(`khataBalances/${order.distributorId}`).transaction((current) => {
          const currentBalance = current && typeof current.balancePaise !== "undefined"
            ? Number(current.balancePaise) || 0
            : 0;
          return { storeId: order.distributorId, balancePaise: currentBalance + order.totalPaise, updatedAt: now };
        });
        const balanceAfter = Number((balanceResult.snapshot.val() as { balancePaise?: unknown } | null)?.balancePaise) || 0;
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
    await notifyOrderParticipants({ ...order, otpStatus: "VERIFIED", status: nextStatus }, nextStatus, session.uid)
      .catch((notificationError) => console.error("[Order OTP] Participant notification failed:", notificationError));

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error) {
    console.error("[Order OTP] Firebase verification failed:", error instanceof Error ? error.message : error);
    if (error instanceof OrderOtpValidationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Firebase OTP verification failed. Request a new code and try again." }, { status: 401 });
  }
}
