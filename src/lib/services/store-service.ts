// ============================================================
// Store Service — Create and manage stores
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "./audit-service";
import { findOrCreateCustomerOwner } from "./user-service";
import type { Store, SessionData, UserDistributorMembership } from "@/types/models";
import type { StoreType } from "@/types";

interface CreateStoreInput {
  name: string;
  type: StoreType;
  districtId?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string | null;
  gstin?: string | null;
  ownerUid?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerName?: string | null;
  logoUrl?: string | null;
}

export async function createStore(input: CreateStoreInput, session: SessionData): Promise<Store> {
  const storeId = uuidv4();
  const now = new Date().toISOString();

  const isAdminCreator = session.role === "ADMIN" || session.role === "SUPERADMIN";
  const autoApproved = input.type === "DISTRIBUTION" || isAdminCreator;
  const owner = await findOrCreateCustomerOwner({
    ownerUid: input.ownerUid,
    email: input.ownerEmail,
    phone: input.ownerPhone,
    displayName: input.ownerName || input.name,
    role: input.type === "DISTRIBUTOR" ? "DISTRIBUTOR" : undefined,
  });

  const store: Store = {
    id: storeId,
    name: input.name,
    type: input.type,
    districtId: input.districtId ?? null,
    ownerUid: owner?.uid ?? null,
    managerUid: null,
    logoUrl: input.logoUrl ?? null,
    address: input.address,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    phone: input.phone,
    email: input.email ?? null,
    gstin: input.gstin ?? null,
    approvalStatus: autoApproved ? "APPROVED" : "PENDING",
    isActive: true,
    createdBy: session.uid,
    createdAt: now,
    updatedAt: now,
  };

  const creatorMembership: UserDistributorMembership = {
    uid: session.uid,
    distributorId: storeId,
    role: "CREATOR",
    joinedAt: now,
  };

  const updates: Record<string, unknown> = {
    [`stores/${storeId}`]: store,
    [`storeMembers/${storeId}/${session.uid}`]: creatorMembership,
    [`userStoreMemberships/${session.uid}/${storeId}`]: creatorMembership,
  };

  if (owner) {
    const ownerMembership: UserDistributorMembership = {
      uid: owner.uid,
      distributorId: storeId,
      role: "OWNER",
      joinedAt: now,
    };
    updates[`storeMembers/${storeId}/${owner.uid}`] = ownerMembership;
    updates[`userStoreMemberships/${owner.uid}/${storeId}`] = ownerMembership;
  }

  if (input.type === "DISTRIBUTOR") {
    updates[`distributors/${storeId}`] = {
      ...store,
      districtId: input.districtId ?? "",
    };
  }

  await adminDb.ref().update(updates);

  await writeAuditLog({
    actorId: session.uid,
    action: "STORE_CREATED",
    entityType: "STORE",
    entityId: storeId,
    after: { name: store.name, type: store.type },
  });

  return store;
}

export async function getStore(storeId: string): Promise<Store | null> {
  const snap = await adminDb.ref(`stores/${storeId}`).get();
  if (!snap.exists()) return null;
  return snap.val() as Store;
}

export async function listStores(type?: StoreType): Promise<Store[]> {
  let query = adminDb.ref("stores") as unknown as { orderByChild(child: string): { equalTo(value: string): { once(event: string): ReturnType<typeof adminDb.ref> } } };
  if (type) {
    query = query.orderByChild("type").equalTo(type) as unknown as typeof query;
  }
  const snap = await (query as unknown as ReturnType<typeof adminDb.ref>).once("value");
  if (!snap.exists()) return [];
  return Object.values(snap.val() as Record<string, Store>);
}

export async function updateStore(storeId: string, updates: Partial<Store>, session: SessionData): Promise<void> {
  const snap = await adminDb.ref(`stores/${storeId}`).get();
  if (!snap.exists()) throw new Error("Store not found");

  const before = snap.val() as Store;

  await adminDb.ref(`stores/${storeId}`).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  const distributorSnap = await adminDb.ref(`distributors/${storeId}`).get();
  if (distributorSnap.exists()) {
    await adminDb.ref(`distributors/${storeId}`).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  await writeAuditLog({
    actorId: session.uid,
    action: "STORE_UPDATED",
    entityType: "STORE",
    entityId: storeId,
    before: { name: before.name },
    after: { ...updates },
  });
}
