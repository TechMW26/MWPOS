import { adminDb } from "@/lib/db/admin";
import type { AuditLog, InventoryBalance, Order, SessionData, Store, User } from "@/types/models";
import type { OrderStatus } from "@/types";
import type { DashboardActivityRow, DashboardPerformanceRow, DashboardResponse } from "@/types/dashboard";

export interface DashboardFilters {
  days: number;
  distributorId?: string;
  asmId?: string;
  status?: OrderStatus;
  search?: string;
}

const ORDER_STATUSES: OrderStatus[] = [
  "DRAFT", "PENDING_OTP", "OTP_VERIFIED", "PENDING_CF_APPROVAL", "CF_APPROVED",
  "ALLOCATED", "PICKING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "REJECTED", "CF_REJECTED",
];

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  PENDING_OTP: "#d97706",
  PENDING_CF_APPROVAL: "#9333ea",
  CF_APPROVED: "#2563eb",
  ALLOCATED: "#0891b2",
  PICKING: "#0284c7",
  PACKED: "#4f46e5",
  SHIPPED: "#0d9488",
  DELIVERED: "#16a34a",
  CANCELLED: "#64748b",
  REJECTED: "#dc2626",
  CF_REJECTED: "#dc2626",
};

function values<T>(input: unknown): T[] {
  return input && typeof input === "object" ? Object.values(input as Record<string, T>) : [];
}

function orderBasePath(role: SessionData["role"]): string {
  if (role === "SUPERADMIN") return "/superadmin/orders";
  if (role === "ADMIN") return "/admin/orders";
  if (role === "ASM") return "/asm/orders";
  if (role === "C_AND_F") return "/cf/orders";
  return "/storefront/orders";
}

export function scopeOrdersForSession(session: SessionData, orders: Order[]): Order[] {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return orders;
  if (session.role === "ASM") return orders.filter((order) => order.asmId === session.uid || order.placedByUid === session.uid);
  if (session.role === "C_AND_F") return orders.filter((order) => order.cfId === session.uid);
  const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
  return orders.filter((order) => distributorIds.includes(order.distributorId));
}

function scopedAsms(session: SessionData, users: User[], orders: Order[]): User[] {
  const orderAsmIds = new Set(orders.map((order) => order.asmId).filter(Boolean));
  return users.filter((user) => {
    if (user.role !== "ASM") return false;
    if (session.role === "SUPERADMIN" || session.role === "ADMIN") return true;
    if (session.role === "C_AND_F") return user.cfId === session.uid || orderAsmIds.has(user.uid);
    if (session.role === "ASM") return user.uid === session.uid;
    return orderAsmIds.has(user.uid);
  });
}

function scopedStores(session: SessionData, stores: Store[], orders: Order[], asms: User[]): Store[] {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return stores;
  const orderDistributorIds = new Set(orders.map((order) => order.distributorId));
  if (session.role === "DISTRIBUTOR") {
    const ids = session.distributorIds.length ? session.distributorIds : session.storeIds;
    return stores.filter((store) => ids.includes(store.id));
  }
  if (session.role === "ASM") {
    return stores.filter((store) => orderDistributorIds.has(store.id) || Boolean(session.districtId && store.districtId === session.districtId));
  }
  const districtIds = new Set(asms.map((asm) => asm.districtId).filter((id): id is string => Boolean(id)));
  return stores.filter((store) => orderDistributorIds.has(store.id) || (store.type === "DISTRIBUTOR" && Boolean(store.districtId && districtIds.has(store.districtId))));
}

function buildPerformance(
  entities: Array<{ id: string; name: string }>,
  orders: Order[],
  key: (order: Order) => string
): DashboardPerformanceRow[] {
  return entities.map((entity) => {
    const matches = orders.filter((order) => key(order) === entity.id);
    const sorted = [...matches].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
      id: entity.id,
      name: entity.name,
      orders: matches.length,
      delivered: matches.filter((order) => order.status === "DELIVERED").length,
      pending: matches.filter((order) => ["PENDING_OTP", "PENDING_CF_APPROVAL"].includes(order.status)).length,
      valuePaise: matches.reduce((sum, order) => sum + (order.totalPaise || 0), 0),
      lastOrderAt: sorted[0]?.createdAt ?? null,
    };
  }).filter((row) => row.orders > 0).sort((a, b) => b.valuePaise - a.valuePaise);
}

function getInventoryBalances(raw: unknown): InventoryBalance[] {
  return values<Record<string, InventoryBalance>>(raw).flatMap((storeBalances) => values<InventoryBalance>(storeBalances));
}

function activityFromOrders(orders: Order[], usersById: Map<string, User>): DashboardActivityRow[] {
  return orders.flatMap((order) => Object.entries(order.statusHistory || {}).map(([id, change]) => ({
    id,
    label: String(change.to).replaceAll("_", " "),
    detail: `Order #${order.id.slice(0, 8)}${change.notes ? ` · ${change.notes}` : ""}`,
    actorName: usersById.get(change.changedBy)?.displayName || "System",
    entityId: order.id,
    createdAt: change.changedAt,
    kind: "ORDER" as const,
  })));
}

export async function getDashboard(session: SessionData, filters: DashboardFilters): Promise<DashboardResponse> {
  const [ordersSnap, storesSnap, usersSnap, productsSnap, inventorySnap, auditSnap] = await Promise.all([
    adminDb.ref("orders").get(),
    adminDb.ref("stores").get(),
    adminDb.ref("users").get(),
    adminDb.ref("products").get(),
    adminDb.ref("inventoryBalances").get(),
    adminDb.ref("auditLogs").get(),
  ]);

  const allOrders = values<Order>(ordersSnap.val());
  const allStores = values<Store>(storesSnap.val());
  const users = values<User>(usersSnap.val());
  const usersById = new Map(users.map((user) => [user.uid, user]));
  const scopedOrders = scopeOrdersForSession(session, allOrders);
  const asms = scopedAsms(session, users, scopedOrders);
  const stores = scopedStores(session, allStores, scopedOrders, asms);
  const distributors = stores.filter((store) => store.type === "DISTRIBUTOR");
  const allowedDistributorIds = new Set(distributors.map((store) => store.id));
  const allowedAsmIds = new Set(asms.map((asm) => asm.uid));

  const cutoff = Date.now() - filters.days * 24 * 60 * 60 * 1000;
  const query = filters.search?.trim().toLowerCase() || "";
  let orders = scopedOrders.filter((order) => Date.parse(order.createdAt) >= cutoff);
  if (filters.distributorId) orders = allowedDistributorIds.has(filters.distributorId) ? orders.filter((order) => order.distributorId === filters.distributorId) : [];
  if (filters.asmId) orders = allowedAsmIds.has(filters.asmId) ? orders.filter((order) => order.asmId === filters.asmId) : [];
  if (filters.status) orders = orders.filter((order) => order.status === filters.status);
  if (query) {
    orders = orders.filter((order) => {
      const distributor = allStores.find((store) => store.id === order.distributorId)?.name || "";
      const asm = usersById.get(order.asmId)?.displayName || "";
      return [order.id, distributor, asm, order.status].some((value) => value.toLowerCase().includes(query));
    });
  }
  orders.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const visibleDistributorIds = new Set(filters.distributorId ? [filters.distributorId] : distributors.map((store) => store.id));
  const sourceStoreIds = new Set(scopedOrders.map((order) => order.sourceStoreId));
  const inventoryStoreIds = session.role === "SUPERADMIN" || session.role === "ADMIN"
    ? new Set(stores.map((store) => store.id))
    : new Set([...visibleDistributorIds, ...sourceStoreIds]);
  const inventory = getInventoryBalances(inventorySnap.val()).filter((balance) => inventoryStoreIds.has(balance.storeId));
  const activeProducts = values<{ isActive?: boolean }>(productsSnap.val()).filter((product) => product.isActive !== false).length;
  const orderValuePaise = orders.reduce((sum, order) => sum + (order.totalPaise || 0), 0);
  const khataDuePaise = orders.filter((order) => order.paymentMode === "PAY_LATER" && order.paymentStatus !== "COMPLETED")
    .reduce((sum, order) => sum + Math.max(0, (order.totalPaise || 0) - (order.paidAmountPaise || 0)), 0);
  const delivered = orders.filter((order) => order.status === "DELIVERED").length;

  const trend = Array.from({ length: Math.min(filters.days, 30) }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (Math.min(filters.days, 30) - index - 1));
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const matches = orders.filter((order) => {
      const time = Date.parse(order.createdAt);
      return time >= date.getTime() && time < next.getTime();
    });
    return {
      label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      value: matches.reduce((sum, order) => sum + (order.totalPaise || 0), 0),
      orders: matches.length,
    };
  });

  const orderActivity = activityFromOrders(orders, usersById);
  const visibleOrderIds = new Set(orders.map((order) => order.id));
  const hasOrderFilters = Boolean(filters.distributorId || filters.asmId || filters.status || query);
  const auditActivity: DashboardActivityRow[] = values<AuditLog>(auditSnap.val()).filter((log) => {
      if (Date.parse(log.createdAt) < cutoff) return false;
      if (session.role === "SUPERADMIN" || session.role === "ADMIN") {
        if (!hasOrderFilters) return true;
        return log.entityType === "ORDER" && visibleOrderIds.has(log.entityId);
      }
      if (log.entityType === "ORDER") return visibleOrderIds.has(log.entityId);
      if (session.role === "C_AND_F" && !hasOrderFilters && log.entityType === "INVENTORY") {
        return inventoryStoreIds.has(log.entityId.split(":")[0] || "");
      }
      return false;
    }).map((log) => ({
      id: log.id,
      label: log.action.replaceAll("_", " "),
      detail: `${log.entityType} · ${log.entityId.slice(0, 12)}`,
      actorName: usersById.get(log.actorId)?.displayName || "System",
      entityId: log.entityId,
      createdAt: log.createdAt,
      kind: "AUDIT" as const,
    }));

  return {
    viewer: { role: session.role, displayName: session.displayName },
    scopeLabel: session.role === "SUPERADMIN" || session.role === "ADMIN" ? "All operations" : session.role === "ASM" ? "My district and distributors" : session.role === "C_AND_F" ? "My ASMs and assigned orders" : "My business",
    orderBasePath: orderBasePath(session.role),
    generatedAt: new Date().toISOString(),
    filters: {
      distributors: distributors.map((store) => ({ id: store.id, label: store.name })).sort((a, b) => a.label.localeCompare(b.label)),
      asms: asms.map((asm) => ({ id: asm.uid, label: asm.displayName })).sort((a, b) => a.label.localeCompare(b.label)),
      statuses: ORDER_STATUSES,
    },
    metrics: {
      orders: orders.length,
      orderValuePaise,
      averageOrderPaise: orders.length ? Math.round(orderValuePaise / orders.length) : 0,
      khataDuePaise,
      pendingApprovals: orders.filter((order) => ["PENDING_OTP", "PENDING_CF_APPROVAL"].includes(order.status)).length,
      delivered,
      fulfillmentRate: orders.length ? Math.round((delivered / orders.length) * 100) : 0,
      activeClients: new Set(orders.map((order) => order.distributorId)).size,
      activeAsms: new Set(orders.map((order) => order.asmId).filter(Boolean)).size,
      activeProducts,
      lowStock: inventory.filter((balance) => balance.available <= (balance.reorderThreshold ?? 10)).length,
    },
    trend,
    statusCounts: ORDER_STATUSES.map((status) => ({
      label: status.replaceAll("_", " "),
      value: orders.filter((order) => order.status === status).length,
      color: STATUS_COLORS[status] || "#2563eb",
    })).filter((item) => item.value > 0),
    recentOrders: orders.slice(0, 25).map((order) => ({
      id: order.id,
      status: order.status,
      distributorId: order.distributorId,
      distributorName: allStores.find((store) => store.id === order.distributorId)?.name || "Unknown distributor",
      asmId: order.asmId,
      asmName: order.asmId ? usersById.get(order.asmId)?.displayName || "Unassigned ASM" : "Direct order",
      placedByName: usersById.get(order.placedByUid)?.displayName || "Unknown user",
      paymentMode: order.paymentMode,
      paymentStatus: order.paymentStatus,
      totalPaise: order.totalPaise || 0,
      createdAt: order.createdAt,
      historyCount: Object.keys(order.statusHistory || {}).length,
    })),
    asmPerformance: buildPerformance(asms.map((asm) => ({ id: asm.uid, name: asm.displayName })), orders, (order) => order.asmId),
    clientPerformance: buildPerformance(distributors.map((store) => ({ id: store.id, name: store.name })), orders, (order) => order.distributorId),
    activity: [...orderActivity, ...auditActivity].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30),
  };
}
