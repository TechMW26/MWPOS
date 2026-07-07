import { describe, it, expect } from "vitest";

// Order transition validation — testing the valid transition map

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ALLOCATED", "CANCELLED", "REJECTED"],
  ALLOCATED: ["PICKING", "CANCELLED", "REJECTED"],
  PICKING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

describe("Order transitions", () => {
  it("allows DRAFT → SUBMITTED", () => {
    expect(isValidTransition("DRAFT", "SUBMITTED")).toBe(true);
  });

  it("allows DRAFT → CANCELLED", () => {
    expect(isValidTransition("DRAFT", "CANCELLED")).toBe(true);
  });

  it("prevents DRAFT → DELIVERED", () => {
    expect(isValidTransition("DRAFT", "DELIVERED")).toBe(false);
  });

  it("allows full happy path", () => {
    const path = ["DRAFT", "SUBMITTED", "APPROVED", "ALLOCATED", "PICKING", "PACKED", "SHIPPED", "DELIVERED"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isValidTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("prevents DELIVERED → anything", () => {
    expect(isValidTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(isValidTransition("DELIVERED", "DRAFT")).toBe(false);
  });

  it("prevents CANCELLED → anything", () => {
    expect(isValidTransition("CANCELLED", "SUBMITTED")).toBe(false);
  });

  it("prevents REJECTED → anything", () => {
    expect(isValidTransition("REJECTED", "APPROVED")).toBe(false);
  });

  it("allows cancellation from multiple states", () => {
    expect(isValidTransition("SUBMITTED", "CANCELLED")).toBe(true);
    expect(isValidTransition("APPROVED", "CANCELLED")).toBe(true);
    expect(isValidTransition("ALLOCATED", "CANCELLED")).toBe(true);
    expect(isValidTransition("PICKING", "CANCELLED")).toBe(true);
    expect(isValidTransition("PACKED", "CANCELLED")).toBe(true);
  });
});
