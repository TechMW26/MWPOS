import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { setSessionCookie } from "@/lib/auth/session";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-auth";
import { buildSessionData, findOrCreateUserByPhone, findUserByPhone } from "@/lib/services/user-service";
import { redirectPathForRole } from "@/lib/auth/authorization";
import { verifyMasterOtp } from "@/lib/auth/master-otp";
import { adminDb } from "@/lib/db/admin";

const exchangeSchema = z.union([
  z.object({ idToken: z.string().min(1) }),
  z.object({ phone: z.string().min(8).max(20), otp: z.string().regex(/^\d{6}$/) }),
]);

const MASTER_ATTEMPT_WINDOW_MS = 15 * 60_000;
const MASTER_ATTEMPT_LIMIT = 10;
const memoryAttempts = new Map<string, { count: number; resetAt: number }>();
let warnedAboutRateLimitFallback = false;

export async function POST(request: Request) {
  try {
    const parsed = exchangeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Valid phone verification is required" }, { status: 400 });

    let phone: string;
    let firebaseUid: string | undefined;
    let masterLogin = false;
    if ("otp" in parsed.data) {
      phone = normalizePhoneNumber(parsed.data.phone);
      const allowed = await consumeMasterAttempt(request, phone);
      if (!allowed) return NextResponse.json({ message: "Too many master-code attempts. Try again later." }, { status: 429 });
      if (!verifyMasterOtp(parsed.data.otp)) {
        return NextResponse.json({ message: "Continue with Firebase verification", useFirebase: true }, { status: 422 });
      }
      // The master OTP must only ever unlock the configured superadmin phone.
      const superadminPhone = process.env.SEED_SUPERADMIN_PHONE
        ? normalizePhoneNumber(process.env.SEED_SUPERADMIN_PHONE)
        : null;
      if (!superadminPhone || phone !== superadminPhone) {
        return NextResponse.json({ message: "Continue with Firebase verification", useFirebase: true }, { status: 422 });
      }
      masterLogin = true;
    } else {
      const decodedToken = await getFirebaseAdminAuth().verifyIdToken(parsed.data.idToken, true);
      if (decodedToken.firebase.sign_in_provider !== "phone" || !decodedToken.phone_number) {
        return NextResponse.json({ message: "Phone verification is required" }, { status: 401 });
      }
      phone = normalizePhoneNumber(decodedToken.phone_number);
      firebaseUid = decodedToken.uid;
    }

    const user = masterLogin ? await findUserByPhone(phone) : await findOrCreateUserByPhone({ phone, firebaseUid });
    if (!user) return NextResponse.json({ message: "No account is registered for this phone number." }, { status: 404 });

    if (!user.isActive) {
      return NextResponse.json({ message: "Account has been deactivated. Contact support." }, { status: 403 });
    }

    await setSessionCookie(await buildSessionData(user));
    if (masterLogin) await clearMasterAttempts(request, phone);

    return NextResponse.json({
      user: {
        uid: user.uid,
        phone: user.phone,
        displayName: user.displayName,
        role: user.role,
      },
      redirectTo: redirectPathForRole(user.role),
    });
  } catch (error) {
    console.error("Firebase phone login failed:", error);
    return NextResponse.json(
      { message: "Phone verification failed. Please request a new code." },
      { status: 401 }
    );
  }
}

function attemptKey(request: Request, phone: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${forwarded}:${phone}`).digest("hex").slice(0, 32);
}

async function consumeMasterAttempt(request: Request, phone: string): Promise<boolean> {
  if (process.env.ENABLE_MASTER_OTP?.trim().toLowerCase() !== "true") return true;
  const key = attemptKey(request, phone);
  const now = Date.now();
  const current = memoryAttempts.get(key);
  const next = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + MASTER_ATTEMPT_WINDOW_MS }
    : { count: current.count + 1, resetAt: current.resetAt };
  memoryAttempts.set(key, next);
  if (memoryAttempts.size > 1_000) {
    for (const [entryKey, entry] of memoryAttempts) {
      if (entry.resetAt <= now) memoryAttempts.delete(entryKey);
    }
  }
  if (next.count > MASTER_ATTEMPT_LIMIT) return false;

  try {
    const ref = adminDb.ref(`authSecurity/masterOtpAttempts/${key}`);
    const result = await ref.transaction((stored: { count?: number; resetAt?: number } | null) => {
      if (!stored || !stored.resetAt || stored.resetAt <= now) return { count: 1, resetAt: now + MASTER_ATTEMPT_WINDOW_MS };
      return { count: (stored.count || 0) + 1, resetAt: stored.resetAt };
    });
    return Number(result.snapshot.val()?.count || 0) <= MASTER_ATTEMPT_LIMIT;
  } catch {
    if (!warnedAboutRateLimitFallback) {
      console.warn("Persistent master OTP rate limiting is unavailable; using the instance-local limiter.");
      warnedAboutRateLimitFallback = true;
    }
    return true;
  }
}

async function clearMasterAttempts(request: Request, phone: string): Promise<void> {
  const key = attemptKey(request, phone);
  memoryAttempts.delete(key);
  try {
    await adminDb.ref(`authSecurity/masterOtpAttempts/${key}`).remove();
  } catch {
    // A successful login must not be turned into an error by rate-limit cleanup.
  }
}
