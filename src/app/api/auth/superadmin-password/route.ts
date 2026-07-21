import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { setSessionCookie } from "@/lib/auth/session";
import { redirectPathForRole } from "@/lib/auth/authorization";
import { buildSessionData, findOrCreateUserByPhone, findUserByPhone } from "@/lib/services/user-service";
import { adminDb } from "@/lib/db/admin";
import { writeAuditLog } from "@/lib/services/audit-service";

const loginSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(1).max(200),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function matchesSecret(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function rateLimitKey(request: Request, phone: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${forwardedFor}:${phone}`;
}

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Invalid phone or password" }, { status: 401 });

    const configuredPhone = process.env.SEED_SUPERADMIN_PHONE;
    const configuredPassword = process.env.SUPERADMIN_PASSWORD;
    if (!configuredPhone || !configuredPassword) {
      console.error("Superadmin password login is not configured");
      return NextResponse.json({ message: "Superadmin login is unavailable" }, { status: 503 });
    }

    const phone = normalizePhoneNumber(parsed.data.phone);
    const expectedPhone = normalizePhoneNumber(configuredPhone);
    const key = rateLimitKey(request, phone);
    const now = Date.now();
    const current = attempts.get(key);
    if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
      return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
    }

    if (phone !== expectedPhone || !matchesSecret(parsed.data.password, configuredPassword)) {
      attempts.set(key, current && current.resetAt > now
        ? { count: current.count + 1, resetAt: current.resetAt }
        : { count: 1, resetAt: now + WINDOW_MS });
      return NextResponse.json({ message: "Invalid phone or password" }, { status: 401 });
    }

    let user = await findUserByPhone(phone);
    if (!user) {
      user = await findOrCreateUserByPhone({ phone, role: "SUPERADMIN", displayName: "MW-POS Superadmin" });
    }
    if (!user.isActive) return NextResponse.json({ message: "Account has been deactivated" }, { status: 403 });
    if (user.role !== "SUPERADMIN") {
      const previousRole = user.role;
      const updatedAt = new Date().toISOString();
      await adminDb.ref(`users/${user.uid}`).update({ role: "SUPERADMIN", approvalStatus: null, updatedAt });
      user = { ...user, role: "SUPERADMIN", approvalStatus: null, updatedAt };
      await writeAuditLog({
        actorId: user.uid,
        action: "ROLE_CHANGED",
        entityType: "USER",
        entityId: user.uid,
        before: { role: previousRole },
        after: { role: "SUPERADMIN", source: "configured-superadmin-login" },
      }).catch((auditError) => console.error("Superadmin provisioning audit failed:", auditError));
    }

    attempts.delete(key);
    await setSessionCookie(await buildSessionData(user));
    return NextResponse.json({ redirectTo: redirectPathForRole(user.role) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Superadmin password login failed:", error);
    return NextResponse.json({ message: "Invalid phone or password" }, { status: 401 });
  }
}
