import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrder, createOrder, approveOrder } from "@/lib/services/order-service";
import { createOrderSchema } from "@/lib/validation/schemas";
import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/db/admin";
import type { Order, SessionData, Store, User } from "@/types/models";

function canViewOrder(session: SessionData, order: Order): boolean {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return true;
  if (session.role === "C_AND_F") return order.cfId === session.uid;
  if (session.role === "ASM") return order.asmId === session.uid || order.placedByUid === session.uid;
  const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
  return distributorIds.includes(order.distributorId);
}

async function getOrderContext(orders: Order[], includeHistory: boolean) {
  const [usersSnap, storesSnap] = await Promise.all([adminDb.ref("users").get(), adminDb.ref("stores").get()]);
  const users = (usersSnap.val() as Record<string, User> | null) || {};
  const stores = (storesSnap.val() as Record<string, Store> | null) || {};
  return orders.map((order) => {
    const context = {
      distributor: {
        id: order.distributorId,
        name: stores[order.distributorId]?.name || "Unknown distributor",
        phone: stores[order.distributorId]?.phone || null,
      },
      asm: order.asmId ? { uid: order.asmId, name: users[order.asmId]?.displayName || "Unknown ASM", role: users[order.asmId]?.role || "ASM" } : null,
      placedBy: { uid: order.placedByUid, name: users[order.placedByUid]?.displayName || "Unknown user", role: users[order.placedByUid]?.role || null },
      cf: order.cfId ? { uid: order.cfId, name: users[order.cfId]?.displayName || "Unknown C&F", role: users[order.cfId]?.role || "C_AND_F" } : null,
    };
    if (!includeHistory) {
      const fullOrder = order as Order & { items?: unknown; editHistory?: Record<string, unknown> };
      const { items: _items, statusHistory, editHistory, ...summary } = fullOrder;
      return { ...summary, context, timelineCount: Object.keys(statusHistory || {}).length, editCount: Object.keys(editHistory || {}).length };
    }
    return { ...order, context, timeline: Object.entries(order.statusHistory || {}).map(([id, change]) => ({
      id,
      ...change,
      actorName: users[change.changedBy]?.displayName || "System",
      actorRole: users[change.changedBy]?.role || null,
    })).sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt)),
    editTimeline: Object.entries((order as Order & { editHistory?: Record<string, Record<string, any>> }).editHistory || {}).map(([id, edit]) => ({
      id,
      ...edit,
      actorName: users[String(edit.editedBy)]?.displayName || "System",
    })).sort((a, b) => Date.parse(String((a as Record<string, unknown>).editedAt)) - Date.parse(String((b as Record<string, unknown>).editedAt))),
    };
  });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const distributorId = searchParams.get("distributorId");
  const status = searchParams.get("status");
  const asmId = searchParams.get("asmId");
  const days = Math.min(730, Math.max(1, Number(searchParams.get("days")) || 365));
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 250));

  if (orderId) {
    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    if (!canViewOrder(session, order)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json((await getOrderContext([order], true))[0]);
  }

  const snap = await adminDb.ref("orders").once("value");
  const all = snap.val() as Record<string, Order> | null;
  let orders = all ? Object.values(all).filter((order) => canViewOrder(session, order)) : [];
  if (distributorId) {
    const hasDistributorAccess = orders.some((order) => order.distributorId === distributorId);
    if (!hasDistributorAccess && session.role !== "SUPERADMIN" && session.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    orders = orders.filter((order) => order.distributorId === distributorId);
  }
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  orders = orders.filter((order) => Date.parse(order.createdAt) >= cutoff);
  if (status) orders = orders.filter((order) => order.status === status);
  if (asmId) orders = orders.filter((order) => order.asmId === asmId);
  orders.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return NextResponse.json(await getOrderContext(orders.slice(0, limit), false), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // ASM/Admin can create for distributors; distributor owners can create for themselves.
  if (!["ASM", "ADMIN", "SUPERADMIN", "DISTRIBUTOR", "C_AND_F"].includes(session.role)) {
    return NextResponse.json({ message: "Your role cannot create orders" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });

    const distributorId = parsed.data.distributorId ?? session.distributorIds[0] ?? session.storeIds[0];
    if (!distributorId) {
      return NextResponse.json({ message: "No distributor is linked to this account" }, { status: 400 });
    }

    // Find source store (distribution center)
    const [sourceStoreSnap, distributorSnap] = await Promise.all([
      adminDb.ref("stores").orderByChild("type").equalTo("DISTRIBUTION").once("value"),
      adminDb.ref(`stores/${distributorId}`).get(),
    ]);
    const stores = sourceStoreSnap.val();
    const distributionStores = stores ? Object.values(stores) as Store[] : [];
    let assignedCfId = session.cfId;
    if (!assignedCfId && distributorSnap.exists()) {
      const distributor = distributorSnap.val() as Store;
      const asmsSnap = await adminDb.ref("users").orderByChild("role").equalTo("ASM").get();
      const asms = (asmsSnap.val() as Record<string, User> | null) || {};
      assignedCfId = Object.values(asms).find((asm) => asm.isActive && asm.approvalStatus === "APPROVED" && asm.districtId === distributor.districtId && asm.cfId)?.cfId ?? null;
    }
    const sourceStore = distributionStores.find((store) => assignedCfId && (store.ownerUid === assignedCfId || store.managerUid === assignedCfId))
      || distributionStores.find((store) => store.isActive);
    if (!sourceStore) {
      return NextResponse.json({ message: "No active distribution warehouse is configured" }, { status: 400 });
    }
    const sourceStoreId = sourceStore.id;

    let order = await createOrder({
      ...parsed.data,
      distributorId,
      sourceStoreId,
      asmId: session.role === "ASM" ? session.uid : "",
      idempotencyKey: parsed.data.idempotencyKey || uuidv4(),
    }, session);

    if (session.role === "C_AND_F") {
      order = await approveOrder(order.orderId, session, "Directly placed and approved by C&F");
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("[Orders] Failed to create order:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
