// ============================================================
// User Service — Find/Create users, manage roles
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "./audit-service";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-auth";
import type { User, SessionData } from "@/types/models";
import type { UserRole, ApprovalStatus } from "@/types";

export async function findUserByPhone(phoneInput: string): Promise<User | null> {
  const phone = normalizePhoneNumber(phoneInput);
  const exactSnap = await adminDb.ref("users").orderByChild("phone").equalTo(phone).once("value");
  if (exactSnap.exists()) {
    return Object.values(exactSnap.val() as Record<string, User>)[0] ?? null;
  }

  // One-time compatibility for phone values created before E.164 normalization.
  const allUsersSnap = await adminDb.ref("users").once("value");
  if (!allUsersSnap.exists()) return null;
  return Object.values(allUsersSnap.val() as Record<string, User>).find((user) => {
    if (!user.phone) return false;
    try {
      return normalizePhoneNumber(user.phone) === phone;
    } catch {
      return false;
    }
  }) ?? null;
}

// ─── Find or Create User By Verified Phone ───────────────────

export async function findOrCreateUserByPhone(input: {
  phone: string;
  firebaseUid?: string;
  displayName?: string | null;
  role?: UserRole;
  email?: string | null;
}): Promise<User> {
  const phone = normalizePhoneNumber(input.phone);

  const existingUser = await findUserByPhone(phone);
  if (existingUser) {
    const lastLoginAt = new Date().toISOString();
    const updates: Record<string, unknown> = { lastLoginAt, phone };
    if (input.firebaseUid && existingUser.firebaseUid !== input.firebaseUid) {
      updates.firebaseUid = input.firebaseUid;
    }
    if (input.email && !existingUser.email) {
      updates.email = input.email.toLowerCase().trim();
    }
    await adminDb.ref(`users/${existingUser.uid}`).update(updates);
    return { ...existingUser, ...updates } as User;
  }

  const uid = input.firebaseUid ?? uuidv4();
  const now = new Date().toISOString();

  const newUser: User = {
    uid,
    firebaseUid: input.firebaseUid ?? null,
    email: input.email?.toLowerCase().trim() ?? null,
    phone,
    displayName: input.displayName?.trim() || phone,
    role: input.role ?? "ASM",
    districtId: null,
    cfId: null,
    approvalStatus: (input.role ?? "ASM") === "ASM" ? "PENDING" : null,
    isActive: true,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  await adminDb.ref(`users/${uid}`).set(newUser);

  return newUser;
}

export async function findOrCreateCustomerOwner(input: {
  ownerUid?: string | null;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  role?: UserRole;
}): Promise<User | null> {
  if (input.ownerUid) {
    const existing = await getUser(input.ownerUid);
    if (!existing) throw new Error("Selected owner user was not found");
    if (input.role && existing.role !== input.role) {
      const updatedAt = new Date().toISOString();
      await adminDb.ref(`users/${existing.uid}`).update({ role: input.role, approvalStatus: null, updatedAt });
      return { ...existing, role: input.role, approvalStatus: null, updatedAt };
    }
    return existing;
  }

  const phone = input.phone?.trim();
  if (phone) {
    const user = await findOrCreateUserByPhone({
      phone,
      displayName: input.displayName,
      role: input.role ?? "DISTRIBUTOR",
      email: input.email,
    });
    if (input.role && user.role !== input.role) {
      const updatedAt = new Date().toISOString();
      await adminDb.ref(`users/${user.uid}`).update({ role: input.role, approvalStatus: null, updatedAt });
      return { ...user, role: input.role, approvalStatus: null, updatedAt };
    }
    return user;
  }

  return null;
}

// ─── Build Session Data ──────────────────────────────────────

export async function buildSessionData(user: User): Promise<SessionData> {
  // Get store and distributor memberships
  const membershipsSnap = await adminDb.ref(`userStoreMemberships/${user.uid}`).get();
  const storeIds: string[] = [];
  const distributorIds: string[] = [];

  if (membershipsSnap.exists()) {
    const memberships = membershipsSnap.val() as Record<string, unknown>;
    storeIds.push(...Object.keys(memberships));
    distributorIds.push(...Object.keys(memberships));
  }

  return {
    uid: user.uid,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    storeIds,
    distributorIds,
    districtId: user.districtId,
    cfId: user.cfId,
    approvalStatus: user.approvalStatus,
  };
}

// ─── Create User (admin-initiated) ───────────────────────────

export async function createUser(input: {
  email: string | null;
  phone: string;
  displayName: string;
  role: string;
  districtId?: string | null;
  locations?: { state: string; district: string; ward: string; districtId: string }[];
  createdByRole?: string | null;
}): Promise<User> {
  const now = new Date().toISOString();
  const phone = normalizePhoneNumber(input.phone);

  if (await findUserByPhone(phone)) throw new Error("A user with this phone already exists");

  let firebaseUid: string;
  try {
    const firebaseAuth = getFirebaseAdminAuth();
    try {
      firebaseUid = (await firebaseAuth.getUserByPhoneNumber(phone)).uid;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "auth/user-not-found") throw error;
      firebaseUid = (await firebaseAuth.createUser({
        phoneNumber: phone,
        displayName: input.displayName.trim(),
        disabled: false,
      })).uid;
    }
  } catch {
    // Firebase Admin Auth unavailable (e.g. missing/incorrect service account key).
    // Fall back to a generated UID so the user record can still be created in the DB.
    // Phone OTP login will still work because Firebase client-side sign-in creates
    // the Auth user on first verification, and findOrCreateUserByPhone pairs them up.
    firebaseUid = uuidv4();
  }

  const newUser: User = {
    uid: firebaseUid,
    firebaseUid,
    email: input.email?.toLowerCase().trim() ?? null,
    phone,
    displayName: input.displayName.trim(),
    role: input.role as UserRole,
    districtId: input.districtId ?? null,
    locations: input.locations ?? undefined,
    cfId: null,
    approvalStatus: input.role === "ASM"
      ? input.createdByRole === "ADMIN" || input.createdByRole === "SUPERADMIN" ? "APPROVED" : "PENDING"
      : null,
    isActive: true,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  await adminDb.ref(`users/${firebaseUid}`).set(newUser);
  return newUser;
}

// ─── Update User Role ────────────────────────────────────────

export async function updateUserRole(
  targetUid: string,
  newRole: UserRole,
  performedBy: SessionData
): Promise<void> {
  const userSnap = await adminDb.ref(`users/${targetUid}`).get();
  if (!userSnap.exists()) throw new Error("User not found");

  const oldUser = userSnap.val() as User;

  await adminDb.ref(`users/${targetUid}`).update({
    role: newRole,
    updatedAt: new Date().toISOString(),
  });

  await writeAuditLog({
    actorId: performedBy.uid,
    action: "ROLE_CHANGED",
    entityType: "USER",
    entityId: targetUid,
    before: { role: oldUser.role },
    after: { role: newRole },
  });
}

// ─── Update Approval Status ──────────────────────────────────

export async function updateApprovalStatus(
  targetUid: string,
  status: ApprovalStatus,
  performedBy: SessionData
): Promise<void> {
  const userSnap = await adminDb.ref(`users/${targetUid}`).get();
  if (!userSnap.exists()) throw new Error("User not found");

  const oldUser = userSnap.val() as User;

  await adminDb.ref(`users/${targetUid}`).update({
    approvalStatus: status,
    updatedAt: new Date().toISOString(),
  });

  await writeAuditLog({
    actorId: performedBy.uid,
    action: "APPROVAL_CHANGED",
    entityType: "USER",
    entityId: targetUid,
    before: { approvalStatus: oldUser.approvalStatus },
    after: { approvalStatus: status },
  });
}

// ─── Get User ────────────────────────────────────────────────

export async function getUser(uid: string): Promise<User | null> {
  const snap = await adminDb.ref(`users/${uid}`).get();
  if (!snap.exists()) return null;
  return snap.val() as User;
}

// ─── List Users ──────────────────────────────────────────────

export async function listUsers(filters?: {
  role?: UserRole;
  approvalStatus?: ApprovalStatus;
}): Promise<User[]> {
  let query = adminDb.ref("users");

  if (filters?.role) {
    const filtered = await adminDb.ref("users").orderByChild("role").equalTo(filters.role).once("value");
    if (!filtered.exists()) return [];
    const allUsers = Object.values(filtered.val() as Record<string, User>);
    if (filters?.approvalStatus) {
      return allUsers.filter((u) => u.approvalStatus === filters.approvalStatus);
    }
    return allUsers;
  }

  const snapshot = await query.once("value");
  if (!snapshot.exists()) return [];

  const users = Object.values(snapshot.val() as Record<string, User>);

  if (filters?.approvalStatus) {
    return users.filter((u) => u.approvalStatus === filters.approvalStatus);
  }

  return users;
}
