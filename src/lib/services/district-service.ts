// ============================================================
// District Service — CRUD for geographic districts
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "./audit-service";
import type { District, SessionData } from "@/types/models";

interface CreateDistrictInput {
  name: string;
  city: string;
  state: string;
}

export async function createDistrict(input: CreateDistrictInput, session: SessionData): Promise<District> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const district: District = {
    id,
    name: input.name,
    city: input.city,
    state: input.state,
    isActive: true,
    createdBy: session.uid,
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.ref(`districts/${id}`).set(district);

  await writeAuditLog({
    actorId: session.uid,
    action: "DISTRICT_CREATED",
    entityType: "DISTRICT",
    entityId: id,
    after: { name: district.name, city: district.city, state: district.state },
  });

  return district;
}

export async function listDistricts(): Promise<District[]> {
  const snap = await adminDb.ref("districts").once("value");
  const val = snap.val() as Record<string, District> | null;
  if (!val) return [];
  return Object.values(val).filter((d) => d.isActive);
}

export async function getDistrict(id: string): Promise<District | null> {
  const snap = await adminDb.ref(`districts/${id}`).get();
  return snap.exists() ? (snap.val() as District) : null;
}

export async function updateDistrict(id: string, updates: Partial<District>, session: SessionData): Promise<District | null> {
  const existing = await getDistrict(id);
  if (!existing) return null;

  const updated: District = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  await adminDb.ref(`districts/${id}`).update(updated as unknown as Record<string, unknown>);

  await writeAuditLog({
    actorId: session.uid,
    action: "DISTRICT_UPDATED",
    entityType: "DISTRICT",
    entityId: id,
    before: { name: existing.name },
    after: { name: updated.name },
  });

  return updated;
}
