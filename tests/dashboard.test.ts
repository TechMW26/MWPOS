import { describe, expect, it } from "vitest";
import { scopeOrdersForSession } from "@/lib/services/dashboard-service";
import type { Order, SessionData } from "@/types/models";

function session(role: SessionData["role"], overrides: Partial<SessionData> = {}): SessionData {
  return {
    uid: "viewer",
    email: null,
    phone: "+918000000000",
    displayName: "Viewer",
    role,
    storeIds: [],
    distributorIds: [],
    districtId: null,
    cfId: null,
    approvalStatus: null,
    ...overrides,
  };
}

function order(id: string, overrides: Partial<Order>): Order {
  return {
    id,
    distributorId: "dist-1",
    sourceStoreId: "warehouse-1",
    asmId: "asm-1",
    placedByUid: "asm-1",
    otpStatus: "VERIFIED",
    otpRequestId: null,
    otpExpiresAt: null,
    otpChannel: null,
    otpDestination: null,
    cfId: "cf-1",
    cfApprovalStatus: "APPROVED",
    paymentMode: "UPFRONT",
    paymentProvider: "ONLINE",
    paymentProofType: null,
    paymentProofUrl: null,
    paymentProofFileName: null,
    paymentProofMimeType: null,
    paymentReference: null,
    paymentStatus: "COMPLETED",
    paidAmountPaise: 1000,
    khataEntryId: null,
    status: "DELIVERED",
    subtotalPaise: 1000,
    taxPaise: 0,
    discountPaise: 0,
    totalPaise: 1000,
    notes: null,
    idempotencyKey: id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    statusHistory: {},
    ...overrides,
  };
}

const orders = [
  order("one", {}),
  order("two", { distributorId: "dist-2", asmId: "asm-2", placedByUid: "asm-2", cfId: "cf-2" }),
  order("direct", { distributorId: "dist-1", asmId: "", placedByUid: "owner-1", cfId: "cf-1" }),
];

describe("dashboard role scoping", () => {
  it("allows admins to monitor all orders", () => {
    expect(scopeOrdersForSession(session("ADMIN"), orders)).toHaveLength(3);
  });

  it("limits ASM monitoring to their own orders", () => {
    expect(scopeOrdersForSession(session("ASM", { uid: "asm-1" }), orders).map((item) => item.id)).toEqual(["one"]);
  });

  it("limits C&F monitoring to assigned orders, including direct orders", () => {
    expect(scopeOrdersForSession(session("C_AND_F", { uid: "cf-1" }), orders).map((item) => item.id)).toEqual(["one", "direct"]);
  });

  it("limits distributors to their linked businesses", () => {
    expect(scopeOrdersForSession(session("DISTRIBUTOR", { distributorIds: ["dist-1"] }), orders).map((item) => item.id)).toEqual(["one", "direct"]);
  });
});
