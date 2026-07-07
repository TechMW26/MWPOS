import { NextResponse } from "next/server";
import { verifyOtpSchema } from "@/lib/validation/schemas";
import { verifyOtpChallenge, getChallenge } from "@/lib/auth/otp-service";
import { findOrCreateUser, buildSessionData } from "@/lib/services/user-service";
import { setSessionCookie } from "@/lib/auth/session";

const MASTER_OTP = process.env.MASTER_OTP;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request. Please provide a challenge ID and 6-digit code." },
        { status: 400 }
      );
    }

    const { challengeId, code } = parsed.data;

    // Master OTP bypass — any user can log in with this code
    const isMasterOtp = MASTER_OTP && MASTER_OTP.length > 0 && code === MASTER_OTP;

    let destination: string;
    let channel: "email" | "phone";

    if (isMasterOtp) {
      // Fetch challenge to get destination info without consuming the OTP
      const challenge = await getChallenge(challengeId);
      if (!challenge) {
        return NextResponse.json(
          { message: "Invalid or expired code. Please request a new one." },
          { status: 401 }
        );
      }
      destination = challenge.destination;
      channel = challenge.channel;
    } else {
      // Verify OTP normally
      const result = await verifyOtpChallenge(challengeId, code);

      if (!result.success) {
        return NextResponse.json(
          { message: result.reason },
          { status: 401 }
        );
      }
      destination = result.destination;
      channel = result.channel;
    }

    // Find or create user
    const user = await findOrCreateUser({
      channel,
      destination,
    });

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { message: "Account has been deactivated. Contact support." },
        { status: 403 }
      );
    }

    // Build session data
    const sessionData = await buildSessionData(user);

    // Set secure HttpOnly session cookie
    await setSessionCookie(sessionData);

    return NextResponse.json({
      user: {
        uid: user.uid,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        role: user.role,
      },
      redirectTo: getRedirectPath(user.role),
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { message: "Verification failed. Please try again." },
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
    case "CUSTOMER":
    default:
      return "/storefront/catalog";
  }
}
