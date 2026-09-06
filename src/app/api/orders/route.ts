import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrder, createOrder, approveOrder } from "@/lib/services/order-service";
import { createOrderSchema } from "@/lib/validation/schemas";
import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/db/admin";
import { queryOrdersForSession } from "@/lib/orders/query";
import type { Order, SessionData, Store, User } from "@/types/models";

function canViewOrder(session: SessionData, order: Order): boolean {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return true;
  if (session.role === "C_AND_F") return order.cfId === session.uid;
  if (session.role === "ASM") return order.asmId === session.uid || order.placedByUid === session.uid;
  const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
  return distributorIds.includes(order.distributorId);
}

async function getOrderContext(orders: Order[], includeHistory: boolean) {
  const userIds = new Set<string>();
  const storeIds = new Set<string>();
  for (const order of orders) {
    storeIds.add(order.distributorId);
    [order.asmId, order.placedByUid, order.cfId].filter(Boolean).forEach((id) => userIds.add(id as string));
    if (includeHistory) {
      Object.values(order.statusHistory || {}).forEach((change) => userIds.add(change.changedBy));
      Object.values((order as Order & { editHistory?: Record<string, { editedBy?: string }> }).editHistory || {})
        .forEach((edit) => { if (edit.editedBy) userIds.add(edit.editedBy); });
    }
  }
  async function loadRecords<T extends object>(path: string, ids: Set<string>, key: (record: T) => string): Promise<Record<string, T>> {
    if (!ids.size) return {};
    if (ids.size > 50) {
      const snapshot = await adminDb.ref(path).get();
      return (snapshot.val() as Record<string, T> | null) || {};
    }
    const entries: Array<T | null> = await Promise.all(Array.from(ids, async (id): Promise<T | null> => {
      const snapshot = await adminDb.ref(`${path}/${id}`).get();
      return snapshot.exists() ? snapshot.val() as T : null;
    }));
    const found = entries.filter((entry): entry is T => entry !== null);
    return Object.fromEntries(found.map((entry) => [key(entry), entry]));
  }
  const [users, stores] = await Promise.all([
    loadRecords<User>("users", userIds, (user) => user.uid),
    loadRecords<Store>("stores", storeIds, (store) => store.id),
  ]);
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

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let orders = (await queryOrdersForSession(session, new Date(cutoff).toISOString()))
    .filter((order) => canViewOrder(session, order));
  if (distributorId) {
    orders = orders.filter((order) => order.distributorId === distributorId);
  }
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

    // Warehouse selection happens only at approval time. Loading every
    // distribution store here made the most common order action needlessly
    // depend on warehouse configuration and collection size.
    const assignedCfId = session.role === "C_AND_F" ? session.uid : session.cfId;

    let order = await createOrder({
      ...parsed.data,
      distributorId,
      sourceStoreId: null,
      asmId: session.role === "ASM" ? session.uid : "",
      assignedCfId,
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
