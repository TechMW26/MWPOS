import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { v4 as uuidv4 } from "uuid";
import { adminDb } from "../src/lib/db/admin";
import { getFirebaseAdminAuth } from "../src/lib/firebase/admin-auth";
import type { Store, User, UserDistributorMembership } from "../src/types/models";

interface PartyRecord {
  sourceKey: string;
  sourceRows: string[];
  region: string;
  name: string;
  phones: string[];
  email: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string | null;
}

interface ImportDocument {
  sourceFile: string;
  stats: Record<string, number>;
  parties: PartyRecord[];
  skippedRows: Array<{ sourceRow: string; name: string; rawPhone: string }>;
}

interface ResolvedUser {
  phone: string;
  dbUid: string;
  firebaseUid: string;
  existing: boolean;
}

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function normalizedPhone(value: string | null | undefined): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return local.length === 10 && /^[6-9]/.test(local) ? `+91${local}` : null;
}

function authErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const inputPath = argument("--input");
  const apply = process.argv.includes("--apply");
  if (!inputPath) throw new Error("Usage: tsx scripts/import-party-report.ts --input <normalized.json> [--apply]");

  const inputBytes = readFileSync(inputPath);
  const document = JSON.parse(inputBytes.toString("utf8")) as ImportDocument;
  const fingerprint = createHash("sha256").update(inputBytes).digest("hex");

  const [usersSnapshot, storesSnapshot] = await Promise.all([
    adminDb.ref("users").get(),
    adminDb.ref("stores").get(),
  ]);
  const existingUsers = (usersSnapshot.val() ?? {}) as Record<string, User>;
  const existingStores = (storesSnapshot.val() ?? {}) as Record<string, Store>;
  const superadmin = Object.values(existingUsers).find((user) => user.role === "SUPERADMIN" && user.isActive);
  if (!superadmin) throw new Error("An active SUPERADMIN is required to attribute this import");

  const usersByPhone = new Map<string, User>();
  for (const user of Object.values(existingUsers)) {
    const phone = normalizedPhone(user.phone);
    if (phone) usersByPhone.set(phone, user);
  }

  const requestedPhones = [...new Set(document.parties.flatMap((party) => party.phones))];
  const roleConflicts = requestedPhones
    .map((phone) => ({ phone, user: usersByPhone.get(phone) }))
    .filter((entry): entry is { phone: string; user: User } => Boolean(entry.user && entry.user.role !== "DISTRIBUTOR"));
  const blockedPhones = new Set(roleConflicts.map((entry) => entry.phone));
  const eligibleParties = document.parties.filter((party) => party.phones.some((phone) => !blockedPhones.has(phone)));

  const storeByGstin = new Map<string, Store>();
  const storesByNamePhone = new Map<string, Store>();
  for (const store of Object.values(existingStores)) {
    if (store.gstin) storeByGstin.set(normalizeText(store.gstin), store);
    const phone = normalizedPhone(store.phone);
    if (phone) storesByNamePhone.set(`${normalizeText(store.name)}|${phone}`, store);
  }

  let existingStoreMatches = 0;
  let plannedNewStores = 0;
  for (const party of eligibleParties) {
    const gstinMatch = party.gstin ? storeByGstin.get(normalizeText(party.gstin)) : undefined;
    const phoneMatch = party.phones.map((phone) => storesByNamePhone.get(`${normalizeText(party.name)}|${phone}`)).find(Boolean);
    if (gstinMatch || phoneMatch) existingStoreMatches += 1;
    else plannedNewStores += 1;
  }

  const dryRun = {
    mode: apply ? "apply" : "dry-run",
    source: document.sourceFile,
    fingerprint,
    sourceStats: document.stats,
    requestedPhones: requestedPhones.length,
    eligiblePhones: requestedPhones.length - blockedPhones.size,
    existingDistributorUsers: requestedPhones.filter((phone) => usersByPhone.get(phone)?.role === "DISTRIBUTOR").length,
    newDistributorUsers: requestedPhones.filter((phone) => !usersByPhone.has(phone)).length,
    roleConflicts: roleConflicts.map(({ phone, user }) => ({ phone, existingRole: user.role, existingUid: user.uid })),
    eligibleParties: eligibleParties.length,
    partiesBlockedByRoleConflict: document.parties.length - eligibleParties.length,
    existingStoreMatches,
    plannedNewStores,
  };
  console.log(JSON.stringify(dryRun, null, 2));
  if (!apply) return;

  const auth = getFirebaseAdminAuth();
  const eligiblePhones = requestedPhones.filter((phone) => !blockedPhones.has(phone));
  let authCreated = 0;
  let authReused = 0;
  const resolvedUsers = await mapWithConcurrency(eligiblePhones, 8, async (phone): Promise<ResolvedUser> => {
    const existing = usersByPhone.get(phone);
    let authUser;
    try {
      authUser = await auth.getUserByPhoneNumber(phone);
      authReused += 1;
      if (authUser.disabled) authUser = await auth.updateUser(authUser.uid, { disabled: false });
    } catch (error) {
      if (authErrorCode(error) !== "auth/user-not-found") throw error;
      const party = document.parties.find((candidate) => candidate.phones.includes(phone));
      authUser = await auth.createUser({ phoneNumber: phone, displayName: party?.name ?? phone, disabled: false });
      authCreated += 1;
    }
    return {
      phone,
      dbUid: existing?.uid ?? authUser.uid,
      firebaseUid: authUser.uid,
      existing: Boolean(existing),
    };
  });
  const resolvedByPhone = new Map(resolvedUsers.map((user) => [user.phone, user]));

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};
  let newUsers = 0;
  let linkedExistingUsers = 0;
  for (const resolved of resolvedUsers) {
    const existing = usersByPhone.get(resolved.phone);
    const party = document.parties.find((candidate) => candidate.phones.includes(resolved.phone));
    if (existing) {
      if (existing.firebaseUid !== resolved.firebaseUid || existing.phone !== resolved.phone) {
        updates[`users/${existing.uid}/firebaseUid`] = resolved.firebaseUid;
        updates[`users/${existing.uid}/phone`] = resolved.phone;
        updates[`users/${existing.uid}/updatedAt`] = now;
        linkedExistingUsers += 1;
      }
      continue;
    }
    const user: User = {
      uid: resolved.dbUid,
      firebaseUid: resolved.firebaseUid,
      email: party?.email ?? null,
      phone: resolved.phone,
      displayName: party?.name ?? resolved.phone,
      role: "DISTRIBUTOR",
      approvalStatus: null,
      isActive: true,
      avatarUrl: null,
      districtId: null,
      cfId: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    updates[`users/${user.uid}`] = user;
    usersByPhone.set(resolved.phone, user);
    newUsers += 1;
  }

  let storesCreated = 0;
  let storesReused = 0;
  let membershipsCreated = 0;
  for (const party of eligibleParties) {
    const partyUsers = party.phones.map((phone) => resolvedByPhone.get(phone)).filter((user): user is ResolvedUser => Boolean(user));
    if (!partyUsers.length) continue;
    const primaryUser = partyUsers[0]!;
    const gstinMatch = party.gstin ? storeByGstin.get(normalizeText(party.gstin)) : undefined;
    const phoneMatch = party.phones.map((phone) => storesByNamePhone.get(`${normalizeText(party.name)}|${phone}`)).find(Boolean);
    let store = gstinMatch ?? phoneMatch;

    if (!store) {
      const storeId = uuidv4();
      store = {
        id: storeId,
        name: party.name,
        type: "DISTRIBUTOR",
        districtId: null,
        ownerUid: primaryUser.dbUid,
        managerUid: null,
        logoUrl: null,
        address: party.address,
        city: party.city,
        state: party.state,
        pincode: party.pincode,
        phone: primaryUser.phone,
        email: party.email,
        gstin: party.gstin,
        approvalStatus: "APPROVED",
        isActive: true,
        createdBy: superadmin.uid,
        createdAt: now,
        updatedAt: now,
      };
      updates[`stores/${storeId}`] = store;
      updates[`distributors/${storeId}`] = { ...store, districtId: "" };
      const auditId = uuidv4();
      updates[`auditLogs/${auditId}`] = {
        id: auditId,
        actorId: superadmin.uid,
        action: "STORE_CREATED",
        entityType: "STORE",
        entityId: storeId,
        before: null,
        after: { name: store.name, type: store.type, importSource: document.sourceFile, sourceRows: party.sourceRows },
        ipAddress: null,
        createdAt: now,
      };
      storesCreated += 1;
      if (party.gstin) storeByGstin.set(normalizeText(party.gstin), store);
      for (const phone of party.phones) storesByNamePhone.set(`${normalizeText(party.name)}|${phone}`, store);
    } else {
      storesReused += 1;
      if (store.type === "DISTRIBUTOR") {
        updates[`distributors/${store.id}`] = { ...store, districtId: store.districtId ?? "" };
      }
    }

    for (const partyUser of partyUsers) {
      const membership: UserDistributorMembership = {
        uid: partyUser.dbUid,
        distributorId: store.id,
        role: "OWNER",
        joinedAt: now,
      };
      updates[`storeMembers/${store.id}/${partyUser.dbUid}`] = membership;
      updates[`userStoreMemberships/${partyUser.dbUid}/${store.id}`] = membership;
      membershipsCreated += 1;
    }
  }

  const importId = fingerprint.slice(0, 24);
  updates[`dataImports/partyReportAll/${importId}`] = {
    id: importId,
    sourceFile: document.sourceFile,
    fingerprint,
    importedBy: superadmin.uid,
    importedAt: now,
    sourceStats: document.stats,
    result: {
      newUsers,
      linkedExistingUsers,
      authCreated,
      authReused,
      storesCreated,
      storesReused,
      membershipsCreated,
      skippedRowsWithoutValidPhone: document.skippedRows.length,
      roleConflicts: roleConflicts.length,
    },
  };

  await adminDb.ref().update(updates);
  console.log(JSON.stringify({
    applied: true,
    fingerprint,
    newUsers,
    linkedExistingUsers,
    authCreated,
    authReused,
    storesCreated,
    storesReused,
    membershipsCreated,
    skippedRowsWithoutValidPhone: document.skippedRows.length,
    roleConflicts: roleConflicts.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
