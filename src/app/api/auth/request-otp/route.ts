import { NextResponse } from "next/server";
import { requestOtpSchema } from "@/lib/validation/schemas";
import { generateOtpCode, createOtpChallenge, checkResendCooldown } from "@/lib/auth/otp-service";
import { getOtpProvider } from "@/lib/auth/otp-provider";
import { getClientIp } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request. Please provide a valid email or phone." },
        { status: 400 }
      );
    }

    const { channel, destination } = parsed.data;
    const ip = getClientIp(request);

    // Check resend cooldown — but don't reveal if destination exists
    const cooldown = await checkResendCooldown(destination, channel);
    if (!cooldown.allowed) {
      return NextResponse.json(
        { message: `Please wait ${cooldown.waitSeconds} seconds before requesting a new code.` },
        { status: 429 }
      );
    }

    // Generate OTP
    const code = generateOtpCode();

    // Create challenge in RTDB
    const challenge = await createOtpChallenge({
      destination,
      channel,
      code,
      ipAddress: ip,
    });

    // Send OTP via configured provider
    const provider = getOtpProvider();
    await provider.requestOtp({
      channel,
      destination,
      code,
      challengeId: challenge.id,
    });

    // Always return the same response — no account enumeration
    return NextResponse.json({
      challengeId: challenge.id,
      message: "Verification code sent.",
    });
  } catch (error) {
    console.error("Request OTP error:", error);
    return NextResponse.json(
      { message: "Unable to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
