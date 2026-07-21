import { timingSafeEqual } from "node:crypto";

export function isMasterOtpEnabled(): boolean {
  return process.env.ENABLE_MASTER_OTP === "true" && /^\d{6}$/.test(process.env.LOGIN_MASTER_OTP || "");
}

export function verifyMasterOtp(candidate: string): boolean {
  if (!isMasterOtpEnabled() || !/^\d{6}$/.test(candidate)) return false;
  const expected = Buffer.from(process.env.LOGIN_MASTER_OTP!, "utf8");
  const received = Buffer.from(candidate, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
