import type { SessionData } from "@/types/models";
import type { UserRole } from "@/types";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requireRole(session: SessionData, ...roles: UserRole[]): void {
  if (!roles.includes(session.role)) {
    throw new AuthorizationError(`Access denied. Required role: ${roles.join(" or ")}`);
  }
}

export function requireStoreAccess(session: SessionData, storeId: string): void {
  // SUPERADMIN and ADMIN have access to all stores
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return;

  // STORE_MANAGER and CUSTOMER must have membership
  if (!session.storeIds.includes(storeId)) {
    throw new AuthorizationError("Access denied. You do not have access to this store.");
  }
}

export function canCreateCustomerStore(session: SessionData): boolean {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return true;
  if (session.role === "STORE_MANAGER" && session.approvalStatus === "APPROVED") return true;
  return false;
}

export function canApproveStoreManager(session: SessionData): boolean {
  return session.role === "SUPERADMIN";
}

export function canManageRoles(session: SessionData): boolean {
  return session.role === "SUPERADMIN";
}

export function canTransitionOrder(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN" || session.role === "STORE_MANAGER";
}

export function canViewAuditLogs(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN";
}

export function canManageInventory(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN" || session.role === "STORE_MANAGER";
}

export function canAccessPos(session: SessionData): boolean {
  // CUSTOMER can access POS only for their store
  return true; // All authenticated users can access POS for stores they have access to
}

export function redirectPathForRole(role: UserRole): string {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    case "STORE_MANAGER":
      return "/manager/dashboard";
    case "CUSTOMER":
      return "/storefront/catalog";
  }
}
