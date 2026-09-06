import { adminDb } from "@/lib/db/admin";
import type { Order, SessionData } from "@/types/models";

function records(snapshot: { val(): unknown }): Order[] {
  const value = snapshot.val();
  return value && typeof value === "object"
    ? Object.values(value as Record<string, Order>)
    : [];
}

export async function queryOrdersForSession(session: SessionData, cutoffIso: string): Promise<Order[]> {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") {
    return records(await adminDb.ref("orders").orderByChild("createdAt").startAt(cutoffIso).get());
  }

  if (session.role === "ASM") {
    const [assigned, placed] = await Promise.all([
      adminDb.ref("orders").orderByChild("asmId").equalTo(session.uid).get(),
      adminDb.ref("orders").orderByChild("placedByUid").equalTo(session.uid).get(),
    ]);
    return Array.from(new Map([...records(assigned), ...records(placed)].map((order) => [order.id, order])).values());
  }

  if (session.role === "C_AND_F") {
    return records(await adminDb.ref("orders").orderByChild("cfId").equalTo(session.uid).get());
  }

  const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
  const snapshots = await Promise.all(
    distributorIds.map((distributorId) => adminDb.ref("orders").orderByChild("distributorId").equalTo(distributorId).get())
  );
  return Array.from(new Map(snapshots.flatMap(records).map((order) => [order.id, order])).values());
}
