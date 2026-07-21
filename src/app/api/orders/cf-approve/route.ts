import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { approveOrder, getOrder, transitionOrder } from "@/lib/services/order-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    requireRole(session, "SUPERADMIN", "ADMIN", "C_AND_F");
    const { orderId, action, notes } = await request.json() as { orderId?: string; action?: "APPROVE" | "REJECT"; notes?: string };
    if (!orderId || !action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ message: "orderId and a valid action are required" }, { status: 400 });
    }
    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    if (order.status !== "PENDING_CF_APPROVAL") return NextResponse.json({ message: "Order is not pending C&F approval" }, { status: 400 });
    if (session.role === "C_AND_F" && order.cfId !== session.uid) return NextResponse.json({ message: "This order is not assigned to your C&F account" }, { status: 403 });

    const result = action === "APPROVE"
      ? await approveOrder(orderId, session, notes || "Approved by C&F")
      : await transitionOrder(orderId, "CF_REJECTED", session, notes || "Rejected by C&F");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ message }, { status: message.startsWith("Access denied") ? 403 : 500 });
  }
}
