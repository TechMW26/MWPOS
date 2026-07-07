import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canTransitionOrder } from "@/lib/auth/authorization";
import { transitionOrderSchema } from "@/lib/validation/schemas";
import { approveOrder, transitionOrder, cancelOrder, rejectOrder, fulfillOrder, deliverOrder } from "@/lib/services/order-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canTransitionOrder(session)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const parsed = transitionOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    const { orderId, toStatus, notes } = parsed.data;
    let result;
    switch (toStatus) {
      case "CF_APPROVED": result = await approveOrder(orderId, session, notes); break;
      case "CANCELLED": result = await cancelOrder(orderId, session, notes); break;
      case "REJECTED": result = await rejectOrder(orderId, session, notes); break;
      case "SHIPPED": result = await fulfillOrder(orderId, session); break;
      case "DELIVERED": result = await deliverOrder(orderId, session); break;
      default: result = await transitionOrder(orderId, toStatus, session, notes); break;
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
