/**
 * SMTP Mail Service Test Script
 * Run with: npx tsx --env-file=.env.local scripts/test-mail.ts <email>
 */

async function main() {
  const { sendOtpEmail, sendWelcomeEmail, sendNotificationEmail } = await import("../src/lib/mail/mailer");

  const TEST_EMAIL = process.argv[2];
  if (!TEST_EMAIL) {
    console.error("❌ Usage: npx tsx scripts/test-mail.ts <test-email-address>");
    process.exit(1);
  }

  console.log(`\n📧 Testing SMTP mail service → ${TEST_EMAIL}\n`);
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`   SMTP_FROM: ${process.env.SMTP_FROM}\n`);

  // ─── Test 1: OTP Email ─────────────────────────────────────
  console.log("1/3  Sending OTP email...");
  try {
    await sendOtpEmail(TEST_EMAIL, "123456");
    console.log("   ✅ OTP email sent\n");
  } catch (err) {
    console.error("   ❌ OTP email failed:", err instanceof Error ? err.message : err, "\n");
  }

  // ─── Test 2: Welcome Email ─────────────────────────────────
  console.log("2/3  Sending Welcome email...");
  try {
    await sendWelcomeEmail(TEST_EMAIL, "Test User");
    console.log("   ✅ Welcome email sent\n");
  } catch (err) {
    console.error("   ❌ Welcome email failed:", err instanceof Error ? err.message : err, "\n");
  }

  // ─── Test 3: Notification Email ────────────────────────────
  console.log("3/3  Sending Notification email...");
  try {
    await sendNotificationEmail({
      to: TEST_EMAIL,
      subject: "Test Notification",
      title: "This is a test alert",
      message: "Hello! This is a test notification from MW-POS.\n\nIf you received this, the SMTP mail service is working correctly.",
    });
    console.log("   ✅ Notification email sent\n");
  } catch (err) {
    console.error("   ❌ Notification email failed:", err instanceof Error ? err.message : err, "\n");
  }

  console.log("🎉 Mail test complete. Check the inbox for", TEST_EMAIL);
}

main().catch(console.error);
