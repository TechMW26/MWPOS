import { afterEach, describe, expect, it } from "vitest";
import { isMasterOtpEnabled, verifyMasterOtp } from "@/lib/auth/master-otp";

const originalEnabled = process.env.ENABLE_MASTER_OTP;
const originalOtp = process.env.LOGIN_MASTER_OTP;

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.ENABLE_MASTER_OTP;
  else process.env.ENABLE_MASTER_OTP = originalEnabled;
  if (originalOtp === undefined) delete process.env.LOGIN_MASTER_OTP;
  else process.env.LOGIN_MASTER_OTP = originalOtp;
});

describe("master OTP", () => {
  it("accepts only the configured six-digit code when explicitly enabled", () => {
    process.env.ENABLE_MASTER_OTP = "true";
    process.env.LOGIN_MASTER_OTP = "151207";
    expect(isMasterOtpEnabled()).toBe(true);
    expect(verifyMasterOtp("151207")).toBe(true);
    expect(verifyMasterOtp("151208")).toBe(false);
  });

  it("stays disabled by default and rejects malformed configuration", () => {
    process.env.ENABLE_MASTER_OTP = "false";
    process.env.LOGIN_MASTER_OTP = "151207";
    expect(verifyMasterOtp("151207")).toBe(false);
    process.env.ENABLE_MASTER_OTP = "true";
    process.env.LOGIN_MASTER_OTP = "123";
    expect(isMasterOtpEnabled()).toBe(false);
  });
});
