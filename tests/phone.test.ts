import { describe, expect, it } from "vitest";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/auth/phone";

describe("Phone number normalization", () => {
  it("normalizes Indian local numbers to E.164", () => {
    expect(normalizePhoneNumber("98765 43210")).toBe("+919876543210");
  });

  it("preserves valid international E.164 numbers", () => {
    expect(normalizePhoneNumber("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("normalizes an Indian country code without a plus", () => {
    expect(normalizePhoneNumber("91-98765-43210")).toBe("+919876543210");
  });

  it("rejects malformed and underspecified numbers", () => {
    expect(() => normalizePhoneNumber("12345")).toThrow();
    expect(() => normalizePhoneNumber("+91-call-me")).toThrow();
    expect(isValidPhoneNumber("not-a-phone")).toBe(false);
  });
});
