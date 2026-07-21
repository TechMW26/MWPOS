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
  if (territoryMatchesResource(session, districtId)) return;
  throw new AuthorizationError("Access denied. You do not have access to this district.");
}

export function territoryIds(owner: Pick<SessionData, "districtId" | "locations">): string[] {
  const configuredLocations = (owner.locations ?? [])
    .map((location) => location.districtId)
    .filter((districtId): districtId is string => Boolean(districtId));
  return configuredLocations.length > 0
    ? Array.from(new Set(configuredLocations))
    : owner.districtId ? [owner.districtId] : [];
}

export function territoryMatchesResource(
  owner: Pick<SessionData, "districtId" | "locations">,
  resourceId: string | null | undefined
): boolean {
  return territoryIds(owner).some((districtId) => districtMatchesTerritory(districtId, resourceId));
}

export function districtMatchesTerritory(assignedId: string | null | undefined, resourceId: string | null | undefined): boolean {
  if (!assignedId || !resourceId) return false;
  if (assignedId === resourceId) return true;

  const assigned = assignedId.split("|").map((part) => part.trim());
  const resource = resourceId.split("|").map((part) => part.trim());
  if (assigned.length < 3 || resource.length < 3) return false;

  const assignedCity = assigned.length >= 4 ? assigned[2] : null;
  const resourceCity = resource.length >= 4 ? resource[2] : null;
  return assigned[0] === resource[0]
    && assigned[1] === resource[1]
    && assigned.at(-1) === resource.at(-1)
    && (!assignedCity || !resourceCity || assignedCity === resourceCity);
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
