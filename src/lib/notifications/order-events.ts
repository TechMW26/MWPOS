import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/db/admin";
import { getFirebaseAdminMessaging } from "@/lib/firebase/admin-auth";
import type { Order, Store, User } from "@/types/models";
import type { OrderStatus } from "@/types";

const meaningful: Partial<Record<OrderStatus, string>> = {
  OTP_VERIFIED: "Distributor verified the order",
  PENDING_CF_APPROVAL: "Order is ready for C&F approval",
  CF_APPROVED: "Order approved by C&F",
  CF_REJECTED: "Order rejected by C&F",
  ALLOCATED: "Inventory allocated",
  PACKED: "Order packed",
  SHIPPED: "Order shipped",
  DELIVERED: "Order delivered",
  CANCELLED: "Order cancelled",
  REJECTED: "Order rejected",
};

export async function notifyOrderParticipants(order: Order, status: OrderStatus, actorUid: string) {
  const title = meaningful[status];
  if (!title) return;
  const [storeSnap, usersSnap] = await Promise.all([adminDb.ref(`stores/${order.distributorId}`).get(), adminDb.ref("users").get()]);
  const store = storeSnap.val() as Store | null;
  const users = (usersSnap.val() as Record<string, User> | null) || {};
  const recipients = new Map<string, string>();
  if (store?.ownerUid) recipients.set(store.ownerUid, `/storefront/orders/${order.id}`);
  if (order.asmId) recipients.set(order.asmId, `/asm/orders/${order.id}`);
  if (order.cfId) recipients.set(order.cfId, `/cf/orders/${order.id}`);
  recipients.delete(actorUid);
  const body = `${store?.name || "Distributor"} · Order #${order.id.slice(0, 8)} · ₹${((order.totalPaise || 0) / 100).toLocaleString("en-IN")}`;
  const now = new Date().toISOString();
  await Promise.all(Array.from(recipients).map(async ([uid, link]) => {
    const id = uuidv4();
    await adminDb.ref(`notifications/${uid}/${id}`).set({ id, uid, title, body, type: status.includes("REJECT") || status === "CANCELLED" ? "WARNING" : "INFO", read: false, link, createdAt: now });
    const tokenRecord = (users[uid] as (User & { fcmTokens?: Record<string, { token?: string }> }) | undefined)?.fcmTokens || {};
    const tokens = Array.from(new Set(Object.values(tokenRecord).map((entry) => entry.token).filter((token): token is string => Boolean(token)))).slice(0, 500);
    if (tokens.length) await getFirebaseAdminMessaging().sendEachForMulticast({ tokens, notification: { title, body }, data: { orderId: order.id, click_action: link, type: "ORDER_STATUS" }, webpush: { fcmOptions: { link } } });
  }));
}
