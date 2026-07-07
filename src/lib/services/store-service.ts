// ============================================================
// Store Service — Create and manage stores
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "./audit-service";
import { findOrCreateCustomerOwner } from "./user-service";
import type { Store, SessionData, UserStoreMembership } from "@/types/models";
import type { StoreType } from "@/types";

interface CreateStoreInput {
  name: string;
  type: StoreType;
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
  const owner =
    input.type === "CUSTOMER"
      ? await findOrCreateCustomerOwner({
          ownerUid: input.ownerUid ?? (session.role === "CUSTOMER" ? session.uid : null),
          email: input.ownerEmail ?? input.email,
          phone: input.ownerPhone ?? input.phone,
          displayName: input.ownerName ?? input.name,
        })
      : null;

  const store: Store = {
    id: storeId,
    name: input.name,
    type: input.type,
    ownerUid: owner?.uid ?? null,
    logoUrl: input.logoUrl ?? null,
    address: input.address,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    phone: input.phone,
    email: input.email ?? owner?.email ?? null,
    gstin: input.gstin ?? null,
    approvalStatus: input.type === "DISTRIBUTION" ? "APPROVED" : "PENDING",
    isActive: true,
    createdBy: session.uid,
    createdAt: now,
    updatedAt: now,
  };

  const creatorMembership: UserStoreMembership = {
    uid: session.uid,
    storeId,
    role: "CREATOR",
    joinedAt: now,
  };

  const updates: Record<string, unknown> = {
    [`stores/${storeId}`]: store,
    [`storeMembers/${storeId}/${session.uid}`]: creatorMembership,
    [`userStoreMemberships/${session.uid}/${storeId}`]: creatorMembership,
  };

  if (owner) {
    const ownerMembership: UserStoreMembership = {
      uid: owner.uid,
      storeId,
      role: "OWNER",
      joinedAt: now,
    };
    updates[`storeMembers/${storeId}/${owner.uid}`] = ownerMembership;
    updates[`userStoreMemberships/${owner.uid}/${storeId}`] = ownerMembership;
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

  await writeAuditLog({
    actorId: session.uid,
    action: "STORE_UPDATED",
    entityType: "STORE",
    entityId: storeId,
    before: { name: before.name },
    after: { ...updates },
  });
}
