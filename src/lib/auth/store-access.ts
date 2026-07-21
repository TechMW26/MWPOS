import { adminDb } from "@/lib/db/admin";
import { territoryMatchesResource } from "@/lib/auth/authorization";
import type { SessionData, Store, User } from "@/types/models";

export async function canAccessStore(session: SessionData, storeId: string): Promise<boolean> {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return true;
  const storeSnap = await adminDb.ref(`stores/${storeId}`).get();
  if (!storeSnap.exists()) return false;
  const store = storeSnap.val() as Store;
  if (store.ownerUid === session.uid || store.managerUid === session.uid || session.storeIds.includes(storeId) || session.distributorIds.includes(storeId)) return true;
  if (session.role === "ASM") return territoryMatchesResource(session, store.districtId);
  if (session.role !== "C_AND_F") return false;

  const usersSnap = await adminDb.ref("users").get();
  const users = (usersSnap.val() as Record<string, User> | null) || {};
  const asms = Object.values(users).filter((user) => user.role === "ASM" && user.cfId === session.uid);
  return asms.some((asm) => territoryMatchesResource(asm, store.districtId));
}
