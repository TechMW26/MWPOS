import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import type { Order } from "@/types/models";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN", "ADMIN", "C_AND_F");

  try {
    const body = await request.json();
    const { orderId, action } = body as { orderId: string; action: "APPROVE" | "REJECT" };

    if (!orderId || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ message: "orderId and action (APPROVE|REJECT) required" }, { status: 400 });
    }

    const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
    if (!orderSnap.exists()) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    const order = orderSnap.val() as Order;

    if (order.status !== "PENDING_CF_APPROVAL") {
      return NextResponse.json({ message: "Order is not pending C&F approval" }, { status: 400 });
    }

    // C&F can only approve orders assigned to them
    if (session.role === "C_AND_F" && order.cfId !== session.uid) {
      return NextResponse.json({ message: "This order is not assigned to your C&F" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const newStatus = action === "APPROVE" ? "CF_APPROVED" : "CF_REJECTED";
    const statusHistoryId = uuidv4();

    const updates: Record<string, unknown> = {
      [`orders/${orderId}/status`]: newStatus,
      [`orders/${orderId}/cfApprovalStatus`]: action === "APPROVE" ? "APPROVED" : "REJECTED",
      [`orders/${orderId}/updatedAt`]: now,
      [`orders/${orderId}/statusHistory/${statusHistoryId}`]: {
        from: order.status,
        to: newStatus,
        changedBy: session.uid,
        changedAt: now,
        notes: action === "APPROVE" ? "Approved by C&F" : "Rejected by C&F",
      },
    };

    await adminDb.ref().update(updates);

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
