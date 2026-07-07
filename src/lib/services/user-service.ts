// ============================================================
// User Service — Find/Create users, manage roles
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "./audit-service";
import type { User, SessionData } from "@/types/models";
import type { UserRole, ApprovalStatus } from "@/types";

// ─── Find or Create User ─────────────────────────────────────

export async function findOrCreateUser(input: {
  channel: "email" | "phone";
  destination: string;
  displayName?: string | null;
  role?: UserRole;
}): Promise<User> {
  const field = input.channel === "email" ? "email" : "phone";
  const fieldValue = input.destination.toLowerCase().trim();

  // Check if user already exists in RTDB
  const snapshot = await adminDb
    .ref("users")
    .orderByChild(field)
    .equalTo(fieldValue)
    .once("value");

  if (snapshot.exists()) {
    const users = snapshot.val() as Record<string, User>;
    const existingUser = Object.values(users)[0]!;
    // Update last login
    await adminDb.ref(`users/${existingUser.uid}/lastLoginAt`).set(new Date().toISOString());
    return existingUser;
  }

  // Create new user
  const uid = uuidv4();
  const now = new Date().toISOString();

  const newUser: User = {
    uid,
    email: input.channel === "email" ? fieldValue : null,
    phone: input.channel === "phone" ? fieldValue : null,
    displayName: input.displayName?.trim() || fieldValue,
    role: input.role ?? "CUSTOMER",
    approvalStatus: null, // only STORE_MANAGER needs approval
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
}): Promise<User | null> {
  if (input.ownerUid) {
    const existing = await getUser(input.ownerUid);
    if (!existing) throw new Error("Selected owner user was not found");
    return existing;
  }

  const email = input.email?.toLowerCase().trim();
  if (email) {
    return findOrCreateUser({
      channel: "email",
      destination: email,
      displayName: input.displayName,
      role: "CUSTOMER",
    });
  }

  const phone = input.phone?.trim();
  if (phone) {
    return findOrCreateUser({
      channel: "phone",
      destination: phone,
      displayName: input.displayName,
      role: "CUSTOMER",
    });
  }

  return null;
}

// ─── Build Session Data ──────────────────────────────────────

export async function buildSessionData(user: User): Promise<SessionData> {
  // Get store memberships
  const membershipsSnap = await adminDb.ref(`userStoreMemberships/${user.uid}`).get();
  const storeIds: string[] = [];

  if (membershipsSnap.exists()) {
    const memberships = membershipsSnap.val() as Record<string, unknown>;
    storeIds.push(...Object.keys(memberships));
  }

  return {
    uid: user.uid,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    storeIds,
    approvalStatus: user.approvalStatus,
  };
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
