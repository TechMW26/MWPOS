import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrdersByStore, createOrder } from "@/lib/services/order-service";
import { createOrderSchema } from "@/lib/validation/schemas";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ message: "storeId required" }, { status: 400 });
  const orders = await getOrdersByStore(storeId);
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    const sourceStoreSnap = await (await import("@/lib/db/admin")).adminDb.ref("stores").orderByChild("type").equalTo("DISTRIBUTION").once("value");
    const stores = sourceStoreSnap.val();
    const sourceStoreId = Object.keys(stores || {})[0] || "store-dist-001";
    const order = await createOrder({ ...parsed.data, sourceStoreId, customerId: session.uid, idempotencyKey: parsed.data.idempotencyKey || uuidv4() }, session);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
