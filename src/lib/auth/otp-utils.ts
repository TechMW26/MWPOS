import { createHash, randomBytes } from "crypto";

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateChallengeId(): string {
  return randomBytes(16).toString("hex");
}
