import { adminDb } from "@/lib/db/admin";
import type { OtpChallenge } from "@/types/models";
import { generateChallengeId, hashOtpCode } from "./otp-utils";

export { generateOtpCode, hashOtpCode, generateChallengeId } from "./otp-utils";

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;

export async function createOtpChallenge(input: {
  destination: string;
  channel: "email" | "phone";
  code: string;
  ipAddress: string;
}): Promise<OtpChallenge> {
  const id = generateChallengeId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const challenge: OtpChallenge = {
    id,
    destination: input.destination,
    channel: input.channel,
    hashedCode: hashOtpCode(input.code),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    verifiedAt: null,
    ipAddress: input.ipAddress,
  };

  await adminDb.ref(`otpChallenges/${id}`).set(challenge);
  return challenge;
}

export async function verifyOtpChallenge(
  challengeId: string,
  code: string
): Promise<{ success: true; destination: string; channel: "email" | "phone" } | { success: false; reason: string }> {
  const ref = adminDb.ref(`otpChallenges/${challengeId}`);
  const snapshot = await ref.get();

  if (!snapshot.exists()) {
    return { success: false, reason: "Invalid or expired code. Please request a new one." };
  }

  const challenge = snapshot.val() as OtpChallenge;

  // Check expiry
  if (new Date(challenge.expiresAt) < new Date()) {
    await ref.remove();
    return { success: false, reason: "Code has expired. Please request a new one." };
  }

  // Check attempts
  if (challenge.attempts >= challenge.maxAttempts) {
    await ref.remove();
    return { success: false, reason: "Too many attempts. Please request a new code." };
  }

  // Increment attempts
  await ref.child("attempts").transaction((current: number) => (current ?? 0) + 1);

  // Verify hash
  if (hashOtpCode(code) !== challenge.hashedCode) {
    return { success: false, reason: "Invalid code. Please try again." };
  }

  // Mark verified and clean up
  await ref.child("verifiedAt").set(new Date().toISOString());
  // Remove the challenge after successful verification
  await ref.remove();

  return {
    success: true,
    destination: challenge.destination,
    channel: challenge.channel,
  };
}

export async function checkResendCooldown(
  destination: string,
  channel: "email" | "phone"
): Promise<{ allowed: boolean; waitSeconds: number }> {
  const COOLDOWN_SECONDS = 30;

  // Find the most recent challenge for this destination
  const snapshot = await adminDb
    .ref("otpChallenges")
    .orderByChild("destination")
    .equalTo(destination)
    .once("value");

  if (!snapshot.exists()) {
    return { allowed: true, waitSeconds: 0 };
  }

  const challenges = snapshot.val() as Record<string, OtpChallenge>;
  const recentChallenge = Object.values(challenges)
    .filter((c) => c.channel === channel)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!recentChallenge) {
    return { allowed: true, waitSeconds: 0 };
  }

  const elapsed = (Date.now() - new Date(recentChallenge.createdAt).getTime()) / 1000;
  const remaining = COOLDOWN_SECONDS - elapsed;

  if (remaining <= 0) {
    return { allowed: true, waitSeconds: 0 };
  }

  return { allowed: false, waitSeconds: Math.ceil(remaining) };
}
