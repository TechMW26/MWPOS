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

export function requireDistrictAccess(session: SessionData, districtId: string): void {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return;
  if (session.districtId === districtId) return;
  throw new AuthorizationError("Access denied. You do not have access to this district.");
}

export function requireDistributorAccess(session: SessionData, distributorId: string): void {
  if (session.role === "SUPERADMIN" || session.role === "ADMIN") return;
  if (session.distributorIds.includes(distributorId)) return;
  throw new AuthorizationError("Access denied. You do not have access to this distributor.");
}

export function canAssignDistributors(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN" || session.role === "ASM";
}

export function canApproveAsm(session: SessionData): boolean {
  return session.role === "SUPERADMIN";
}

export function canManageRoles(session: SessionData): boolean {
  return session.role === "SUPERADMIN";
}

export function canCreateOrder(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN" || session.role === "ASM";
}

export function canTransitionOrder(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN" || session.role === "C_AND_F";
}

export function canApproveOrder(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN" || session.role === "C_AND_F";
}

export function canViewAuditLogs(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN";
}

export function canManageInventory(session: SessionData): boolean {
  return session.role === "SUPERADMIN" || session.role === "ADMIN" || session.role === "C_AND_F";
}

export function canAccessPos(session: SessionData): boolean {
  return true;
}

export function redirectPathForRole(role: UserRole): string {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    case "ASM":
      return "/asm/dashboard";
    case "C_AND_F":
      return "/cf/dashboard";
    case "DISTRIBUTOR":
      return "/storefront/dashboard";
    default:
      return "/storefront/catalog";
  }
}
