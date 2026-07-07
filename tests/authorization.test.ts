import { describe, it, expect } from "vitest";
import {
  requireRole,
  requireStoreAccess,
  canCreateCustomerStore,
  canApproveStoreManager,
  AuthorizationError,
} from "@/lib/auth/authorization";
import type { SessionData } from "@/types/models";

const superadmin: SessionData = {
  uid: "sa1", email: "sa@test.com", phone: null,
  displayName: "Super Admin", role: "SUPERADMIN",
  storeIds: [], approvalStatus: null,
};

const admin: SessionData = {
  uid: "a1", email: "a@test.com", phone: null,
  displayName: "Admin", role: "ADMIN",
  storeIds: [], approvalStatus: null,
};

const approvedManager: SessionData = {
  uid: "m1", email: "m@test.com", phone: null,
  displayName: "Manager", role: "STORE_MANAGER",
  storeIds: ["store1"], approvalStatus: "APPROVED",
};

const pendingManager: SessionData = {
  uid: "m2", email: "m2@test.com", phone: null,
  displayName: "Pending Manager", role: "STORE_MANAGER",
  storeIds: ["store1"], approvalStatus: "PENDING",
};

const customer: SessionData = {
  uid: "c1", email: "c@test.com", phone: null,
  displayName: "Customer", role: "CUSTOMER",
  storeIds: ["store1"], approvalStatus: null,
};

describe("Authorization", () => {
  describe("requireRole", () => {
    it("allows SUPERADMIN for SUPERADMIN", () => {
      expect(() => requireRole(superadmin, "SUPERADMIN")).not.toThrow();
    });

    it("denies CUSTOMER for ADMIN role", () => {
      expect(() => requireRole(customer, "ADMIN")).toThrow(AuthorizationError);
    });
  });

  describe("requireStoreAccess", () => {
    it("allows SUPERADMIN to any store", () => {
      expect(() => requireStoreAccess(superadmin, "any-store")).not.toThrow();
    });

    it("allows ADMIN to any store", () => {
      expect(() => requireStoreAccess(admin, "any-store")).not.toThrow();
    });

    it("denies CUSTOMER to non-member store", () => {
      expect(() => requireStoreAccess(customer, "other-store")).toThrow(AuthorizationError);
    });

    it("allows CUSTOMER to own store", () => {
      expect(() => requireStoreAccess(customer, "store1")).not.toThrow();
    });
  });

  describe("canCreateCustomerStore", () => {
    it("SUPERADMIN can create", () => expect(canCreateCustomerStore(superadmin)).toBe(true));
    it("ADMIN can create", () => expect(canCreateCustomerStore(admin)).toBe(true));
    it("APPROVED manager can create", () => expect(canCreateCustomerStore(approvedManager)).toBe(true));
    it("PENDING manager cannot create", () => expect(canCreateCustomerStore(pendingManager)).toBe(false));
    it("CUSTOMER cannot create", () => expect(canCreateCustomerStore(customer)).toBe(false));
  });

  describe("canApproveStoreManager", () => {
    it("only SUPERADMIN can approve", () => {
      expect(canApproveStoreManager(superadmin)).toBe(true);
      expect(canApproveStoreManager(admin)).toBe(false);
      expect(canApproveStoreManager(approvedManager)).toBe(false);
    });
  });
});
