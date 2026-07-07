import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/db/admin";
import { verifyPassword } from "@/lib/auth/password";
import { buildSessionData } from "@/lib/services/user-service";
import { setSessionCookie } from "@/lib/auth/session";
import type { User } from "@/types/models";

const passwordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = passwordLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request. Email and password required." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const snapshot = await adminDb
      .ref("users")
      .orderByChild("email")
      .equalTo(normalizedEmail)
      .once("value");

    if (!snapshot.exists()) {
      // Don't reveal whether account exists
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const users = snapshot.val() as Record<string, User & { hashedPassword?: string }>;
    const user = Object.values(users)[0]!;

    // Check if user has password auth enabled
    if (!user.hashedPassword) {
      return NextResponse.json(
        { message: "Password login is not enabled for this account. Use OTP." },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, user.hashedPassword)) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { message: "Account has been deactivated." },
        { status: 403 }
      );
    }

    // Build session data
    const sessionData = await buildSessionData(user);

    // Set secure HttpOnly session cookie
    await setSessionCookie(sessionData);

    // Update last login
    await adminDb.ref(`users/${user.uid}/lastLoginAt`).set(new Date().toISOString());

    return NextResponse.json({
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      redirectTo: getRedirectPath(user.role),
    });
  } catch (error) {
    console.error("Password login error:", error);
    return NextResponse.json(
      { message: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}

function getRedirectPath(role: string): string {
  switch (role) {
    case "SUPERADMIN":
      return "/superadmin/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    case "STORE_MANAGER":
      return "/manager/dashboard";
    default:
      return "/storefront/catalog";
  }
}
