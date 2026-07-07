// ============================================================
// OTP Provider Abstraction
// ============================================================

export interface OtpProvider {
  requestOtp(input: {
    channel: "email" | "phone";
    destination: string;
    code: string;
    challengeId: string;
  }): Promise<void>;
}

// ─── Mock OTP Provider (Development) ─────────────────────────

export class MockOtpProvider implements OtpProvider {
  async requestOtp(input: {
    channel: "email" | "phone";
    destination: string;
    code: string;
    challengeId: string;
  }): Promise<void> {
    // In mock mode, log the OTP to console for development
    console.log(`
╔══════════════════════════════════════════╗
║  MOCK OTP — Use this code to login     ║
║  Channel   : ${input.channel.padEnd(27)}║
║  Destination: ${input.destination.padEnd(27)}║
║  Code      : ${input.code.padEnd(27)}║
║  Challenge : ${input.challengeId.padEnd(27)}║
╚══════════════════════════════════════════╝
    `);
  }
}

// ─── Email OTP Provider ──────────────────────────────────────

export class EmailOtpProvider implements OtpProvider {
  async requestOtp(input: {
    channel: "email" | "phone";
    destination: string;
    code: string;
    challengeId: string;
  }): Promise<void> {
    if (input.channel !== "email") {
      throw new Error("EmailOtpProvider only supports email channel");
    }

    // Use the shared mailer with cached transporter
    const { sendOtpEmail } = await import("../mail/mailer");
    await sendOtpEmail(input.destination, input.code);
  }
}

// ─── Vobiz OTP Provider (Disabled — awaiting contract) ───────

export class VobizOtpProvider implements OtpProvider {
  async requestOtp(_input: {
    channel: "email" | "phone";
    destination: string;
    code: string;
    challengeId: string;
  }): Promise<void> {
    throw new Error(
      "Vobiz OTP provider is not yet configured. Set VOBIZ_API_KEY and VOBIZ_API_URL environment variables once the generic OTP API contract is confirmed."
    );
  }
}

// ─── Provider Factory ────────────────────────────────────────

let cachedProvider: OtpProvider | null = null;

export function getOtpProvider(): OtpProvider {
  if (cachedProvider) return cachedProvider;

  const provider = process.env.OTP_PROVIDER ?? "mock";

  switch (provider) {
    case "email":
      cachedProvider = new EmailOtpProvider();
      break;
    case "vobiz":
      cachedProvider = new VobizOtpProvider();
      break;
    case "mock":
    default:
      cachedProvider = new MockOtpProvider();
      break;
  }

  return cachedProvider;
}
