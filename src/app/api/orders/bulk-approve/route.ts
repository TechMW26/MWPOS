import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { approveOrder, getOrder } from "@/lib/services/order-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["C_AND_F", "ADMIN", "SUPERADMIN"].includes(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { orderIds?: unknown; notes?: unknown } | null;
  const orderIds = Array.isArray(body?.orderIds) ? Array.from(new Set(body.orderIds.filter((id): id is string => typeof id === "string" && id.length > 0))).slice(0, 50) : [];
  if (!orderIds.length) return NextResponse.json({ message: "Select at least one order" }, { status: 400 });
  const results: Array<{ orderId: string; success: boolean; message?: string }> = [];
  for (const orderId of orderIds) {
    try {
      const order = await getOrder(orderId);
      if (!order) throw new Error("Order not found");
      if (order.status !== "PENDING_CF_APPROVAL") throw new Error("Order is not pending approval");
      if (session.role === "C_AND_F" && order.cfId !== session.uid) throw new Error("Order is not assigned to your account");
      await approveOrder(orderId, session, typeof body?.notes === "string" ? body.notes.slice(0, 500) : "Bulk approved by C&F");
      results.push({ orderId, success: true });
    } catch (error) { results.push({ orderId, success: false, message: error instanceof Error ? error.message : "Approval failed" }); }
  }
  const approved = results.filter((result) => result.success).length;
  return NextResponse.json({ approved, failed: results.length - approved, results }, { status: approved ? 200 : 400 });
}
