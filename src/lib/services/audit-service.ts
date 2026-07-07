// ============================================================
// Audit Service — Immutable audit logging
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import type { AuditLog } from "@/types/models";
import type { AuditAction } from "@/types";

interface AuditInput {
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const id = uuidv4();
  const entry: AuditLog = {
    id,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    ipAddress: input.ipAddress ?? null,
    createdAt: new Date().toISOString(),
  };

  await adminDb.ref(`auditLogs/${id}`).set(entry);
}

export async function getAuditLogs(input: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: AuditAction;
  limit?: number;
}): Promise<AuditLog[]> {
  const snapshot = await adminDb.ref("auditLogs").once("value");
  if (!snapshot.exists()) return [];

  const logs = snapshot.val() as Record<string, AuditLog> | null;
  if (!logs || typeof logs !== "object") return [];

  let results = Object.values(logs);

  if (input.entityType) results = results.filter((l) => l.entityType === input.entityType);
  if (input.entityId) results = results.filter((l) => l.entityId === input.entityId);
  if (input.actorId) results = results.filter((l) => l.actorId === input.actorId);
  if (input.action) results = results.filter((l) => l.action === input.action);

  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const limit = input.limit ?? 100;
  return results.slice(0, limit);
}
