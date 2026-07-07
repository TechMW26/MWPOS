import { createHash } from "crypto";

export function hashPassword(password: string): string {
  const salt = require("crypto").randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + password).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const computedHash = createHash("sha256").update(salt + password).digest("hex");
  return computedHash === hash;
}
