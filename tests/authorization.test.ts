import { describe, it, expect } from "vitest";
import {
  requireRole,
  requireDistrictAccess,
  requireDistributorAccess,
  canAssignDistributors,
  canApproveAsm,
  AuthorizationError,
} from "@/lib/auth/authorization";
import type { SessionData } from "@/types/models";

const superadmin: SessionData = {
  uid: "sa1", email: "sa@test.com", phone: null,
  displayName: "Super Admin", role: "SUPERADMIN",
  storeIds: [], distributorIds: [], districtId: null, cfId: null, approvalStatus: null,
};

const admin: SessionData = {
  uid: "a1", email: "a@test.com", phone: null,
  displayName: "Admin", role: "ADMIN",
  storeIds: [], distributorIds: [], districtId: null, cfId: null, approvalStatus: null,
};

const approvedAsm: SessionData = {
  uid: "m1", email: "m@test.com", phone: null,
  displayName: "ASM", role: "ASM",
  storeIds: [], distributorIds: ["dist1"], districtId: "district1", cfId: "cf1", approvalStatus: "APPROVED",
};

const pendingAsm: SessionData = {
  uid: "m2", email: "m2@test.com", phone: null,
  displayName: "Pending ASM", role: "ASM",
  storeIds: [], distributorIds: ["dist1"], districtId: "district1", cfId: null, approvalStatus: "PENDING",
};

const cf: SessionData = {
  uid: "cf1", email: "cf@test.com", phone: null,
  displayName: "C&F", role: "C_AND_F",
  storeIds: [], distributorIds: [], districtId: null, cfId: null, approvalStatus: null,
};

describe("Authorization", () => {
  describe("requireRole", () => {
    it("allows SUPERADMIN for SUPERADMIN", () => {
      expect(() => requireRole(superadmin, "SUPERADMIN")).not.toThrow();
    });

    it("denies ASM for ADMIN role", () => {
      expect(() => requireRole(approvedAsm, "ADMIN")).toThrow(AuthorizationError);
    });
  });

  describe("requireDistrictAccess", () => {
    it("allows SUPERADMIN to any district", () => {
      expect(() => requireDistrictAccess(superadmin, "any-district")).not.toThrow();
    });

    it("allows ADMIN to any district", () => {
      expect(() => requireDistrictAccess(admin, "any-district")).not.toThrow();
    });

    it("denies ASM to non-assigned district", () => {
      expect(() => requireDistrictAccess(approvedAsm, "other-district")).toThrow(AuthorizationError);
    });

    it("allows ASM to own district", () => {
      expect(() => requireDistrictAccess(approvedAsm, "district1")).not.toThrow();
    });
  });

  describe("requireDistributorAccess", () => {
    it("SUPERADMIN can access any", () => {
      expect(() => requireDistributorAccess(superadmin, "any-dist")).not.toThrow();
    });

    it("denies unscoped C&F distributor access", () => {
      expect(() => requireDistributorAccess(cf, "any-dist")).toThrow(AuthorizationError);
    });

    it("ASM denied to non-owned distributor", () => {
      // ASM without matching distributorId should be denied
      expect(() => requireDistributorAccess(pendingAsm, "other-dist")).toThrow(AuthorizationError);
    });

    it("ASM allowed to own distributor", () => {
      expect(() => requireDistributorAccess(approvedAsm, "dist1")).not.toThrow();
    });
  });

  describe("canAssignDistributors", () => {
    it("SUPERADMIN can assign", () => expect(canAssignDistributors(superadmin)).toBe(true));
    it("ADMIN can assign", () => expect(canAssignDistributors(admin)).toBe(true));
    it("ASM can assign", () => expect(canAssignDistributors(approvedAsm)).toBe(true));
    it("C&F cannot assign", () => expect(canAssignDistributors(cf)).toBe(false));
  });

  describe("canApproveAsm", () => {
    it("only SUPERADMIN can approve", () => {
      expect(canApproveAsm(superadmin)).toBe(true);
      expect(canApproveAsm(admin)).toBe(false);
      expect(canApproveAsm(approvedAsm)).toBe(false);
    });
  });
});
