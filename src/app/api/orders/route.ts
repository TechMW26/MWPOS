import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrder, getOrdersByDistributor, getOrdersByAsm, getOrdersByCf, createOrder } from "@/lib/services/order-service";
import { createOrderSchema } from "@/lib/validation/schemas";
import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/db/admin";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const distributorId = searchParams.get("distributorId");

  if (orderId) {
    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });

    const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
    const canView =
      ["SUPERADMIN", "ADMIN"].includes(session.role) ||
      (session.role === "C_AND_F" && order.cfId === session.uid) ||
      (session.role === "ASM" && (order.asmId === session.uid || order.placedByUid === session.uid)) ||
      (session.role === "DISTRIBUTOR" && distributorIds.includes(order.distributorId));

    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json(order);
  }

  if (distributorId) {
    const orders = await getOrdersByDistributor(distributorId);
    if (session.role === "DISTRIBUTOR") {
      const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
      if (!distributorIds.includes(distributorId)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      return NextResponse.json(orders.filter((order) => order.placedByUid === session.uid || order.otpStatus !== "PENDING"));
    }
    return NextResponse.json(orders);
  }

  if (session.role === "DISTRIBUTOR") {
    const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
    const orders = (await Promise.all(distributorIds.map((id) => getOrdersByDistributor(id)))).flat();
    return NextResponse.json(
      orders
        .filter((order) => order.placedByUid === session.uid || order.otpStatus !== "PENDING")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  }

  // Role-based order listing
  if (session.role === "ASM") {
    return NextResponse.json(await getOrdersByAsm(session.uid));
  }
  if (session.role === "C_AND_F") {
    return NextResponse.json(await getOrdersByCf(session.uid));
  }
  // SUPERADMIN/ADMIN: list all orders
  const snap = await adminDb.ref("orders").once("value");
  const all = snap.val() as Record<string, unknown> | null;
  return NextResponse.json(all ? Object.values(all) : []);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // ASM/Admin can create for distributors; distributor owners can create for themselves.
  if (!["ASM", "ADMIN", "SUPERADMIN", "DISTRIBUTOR"].includes(session.role)) {
    return NextResponse.json({ message: "Only ASM/Admin/Distributor can create orders" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });

    // Find source store (distribution center)
    const sourceStoreSnap = await adminDb.ref("stores").orderByChild("type").equalTo("DISTRIBUTION").once("value");
    const stores = sourceStoreSnap.val();
    const sourceStoreId = (stores ? Object.keys(stores)[0] : null) ?? "store-dist-001";

    const distributorId = parsed.data.distributorId ?? session.distributorIds[0] ?? session.storeIds[0];
    if (!distributorId) {
      return NextResponse.json({ message: "No distributor is linked to this account" }, { status: 400 });
    }

    const order = await createOrder({
      ...parsed.data,
      distributorId,
      sourceStoreId,
      asmId: session.role === "DISTRIBUTOR" ? "" : session.uid,
      idempotencyKey: parsed.data.idempotencyKey || uuidv4(),
    }, session);

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("[Orders] Failed to create order:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
