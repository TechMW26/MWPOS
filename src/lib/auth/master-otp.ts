import { timingSafeEqual } from "node:crypto";

function configuredMasterOtp(): string {
  return (process.env.LOGIN_MASTER_OTP || process.env.MASTER_OTP || "").trim();
}

export function isMasterOtpEnabled(): boolean {
  return process.env.ENABLE_MASTER_OTP?.trim().toLowerCase() === "true" && /^\d{6}$/.test(configuredMasterOtp());
}

export function verifyMasterOtp(candidate: string): boolean {
  if (!isMasterOtpEnabled() || !/^\d{6}$/.test(candidate)) return false;
  const expected = Buffer.from(configuredMasterOtp(), "utf8");
  const received = Buffer.from(candidate, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
