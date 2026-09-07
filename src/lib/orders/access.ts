import type { Order, SessionData } from "@/types/models";

export function canViewOrder(session: SessionData, order: Order): boolean {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return true;
  if (session.role === "C_AND_F") return order.cfId === session.uid;
  if (session.role === "ASM") return order.asmId === session.uid || order.placedByUid === session.uid;
  const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
  return distributorIds.includes(order.distributorId);
}
