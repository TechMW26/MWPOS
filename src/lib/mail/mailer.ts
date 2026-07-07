import nodemailer, { type Transporter } from "nodemailer";

// ─── Transporter Factory ─────────────────────────────────────

async function getTransporter(): Promise<Transporter | null> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[SMTP] Not configured — emails will be logged to console only");
    return null;
  }

  // Always create a fresh transporter to avoid stale connections
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    await transporter.verify();
    console.info(`[SMTP] Connected to ${host} as ${user}`);
    return transporter;
  } catch (err) {
    console.error(`[SMTP] Connection failed for ${user}@${host}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function getFrom(): string {
  return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "MW-POS <noreply@mxpos.app>";
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MW-POS";

function wrapHtml(title: string, body: string): string {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 8px;color:#2563eb">${APP_NAME}</h2>
    <h3 style="margin:0 0 16px;font-weight:600;color:#1e293b">${title}</h3>
    ${body}
    <hr style="margin:24px 0 0;border:none;border-top:1px solid #e2e8f0" />
    <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">
      This is an automated message from ${APP_NAME}. Please do not reply to this email.
    </p>
  </div>
  `;
}

// ─── Public API ──────────────────────────────────────────────

/** Deliver a login OTP by email. Falls back to console log when SMTP is not configured or fails. */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const transporter = await getTransporter();

  if (!transporter) {
    console.log(`\n📧 [OTP] Code for ${to}: ${otp} (SMTP not available)\n`);
    return;
  }

  const from = getFrom();

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Your ${APP_NAME} verification code`,
      text: `Your verification code is ${otp}. It expires in 5 minutes.`,
      html: wrapHtml(
        "Verify your sign-in",
        `<p style="margin:0 0 16px;font-size:14px;color:#334155">Use the code below to complete your sign in to ${APP_NAME}.</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:16px;background:#eff6ff;border-radius:12px;color:#1e40af">${otp}</div>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b">This code expires in 5 minutes. If you didn't request it, you can ignore this email.</p>`
      ),
    });
    console.info(`[OTP] Code sent to ${to}`);
  } catch (err) {
    console.error(`[OTP] Failed to send email to ${to}:`, err instanceof Error ? err.message : err);
    console.log(`\n📧 [OTP] FALLBACK — Code for ${to}: ${otp}\n`);
  }
}

/** Send a welcome / onboarding email to a newly registered user. */
export async function sendWelcomeEmail(to: string, displayName: string): Promise<void> {
  let transporter: Transporter | null;
  try {
    transporter = await getTransporter();
  } catch {
    console.warn(`[MAIL] Skipping welcome email to ${to} — SMTP unavailable`);
    return;
  }

  if (!transporter) {
    console.info(`[MAIL] (no SMTP configured) Welcome email skipped for ${to}`);
    return;
  }

  const from = getFrom();
  const name = displayName || to;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Welcome to ${APP_NAME}!`,
      text: `Hi ${name},\n\nWelcome to ${APP_NAME}! Your account has been created successfully.\n\nYou can now sign in and start using the platform.\n\n— The ${APP_NAME} Team`,
      html: wrapHtml(
        `Welcome, ${name}!`,
        `<p style="margin:0 0 12px;font-size:14px;color:#334155">Your account has been created successfully on ${APP_NAME}.</p>
        <p style="margin:0 0 12px;font-size:14px;color:#334155">You can now sign in and start using the platform.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Go to ${APP_NAME}</a>`
      ),
    });
    console.info(`[MAIL] Welcome email sent to ${to}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send welcome email to ${to}:`, err instanceof Error ? err.message : err);
  }
}

/** Send a generic notification / alert email. */
export async function sendNotificationEmail(input: {
  to: string;
  subject: string;
  title: string;
  message: string;
}): Promise<void> {
  let transporter: Transporter | null;
  try {
    transporter = await getTransporter();
  } catch {
    console.warn(`[MAIL] Skipping notification to ${input.to} — SMTP unavailable`);
    return;
  }

  if (!transporter) {
    console.info(`[MAIL] (no SMTP configured) Notification skipped for ${input.to}: ${input.subject}`);
    return;
  }

  const from = getFrom();

  try {
    await transporter.sendMail({
      from,
      to: input.to,
      subject: `[${APP_NAME}] ${input.subject}`,
      text: `${input.message}`,
      html: wrapHtml(
        input.title,
        `<p style="margin:0 0 12px;font-size:14px;color:#334155;white-space:pre-wrap">${input.message}</p>`
      ),
    });
    console.info(`[MAIL] Notification sent to ${input.to}: ${input.subject}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send notification to ${input.to}:`, err instanceof Error ? err.message : err);
  }
}
