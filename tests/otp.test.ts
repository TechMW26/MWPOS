import { describe, it, expect } from "vitest";
import { hashOtpCode, generateOtpCode } from "@/lib/auth/otp-utils";

describe("OTP Service", () => {
  it("generates a 6-digit code", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes codes consistently", () => {
    const hash1 = hashOtpCode("123456");
    const hash2 = hashOtpCode("123456");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different codes", () => {
    const hash1 = hashOtpCode("123456");
    const hash2 = hashOtpCode("654321");
    expect(hash1).not.toBe(hash2);
  });
});
