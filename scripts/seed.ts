// ============================================================
// MW-POS Database Seed Script
// Seeds: demo users, stores, products, SKUs, catalog, inventory
// Run: npm run seed
// ============================================================

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function seed() {
  const { adminDb } = await import("../src/lib/db/admin");
  const { normalizePhoneNumber } = await import("../src/lib/auth/phone");
  const { getFirebaseAdminAuth } = await import("../src/lib/firebase/admin-auth");

  const configuredPhone = process.env.SEED_SUPERADMIN_PHONE;
  if (!configuredPhone) throw new Error("SEED_SUPERADMIN_PHONE must be set before seeding");
  const superadminPhone = normalizePhoneNumber(configuredPhone);
  const firebaseAuth = getFirebaseAdminAuth();
  let superadminUid: string;
  try {
    superadminUid = (await firebaseAuth.getUserByPhoneNumber(superadminPhone)).uid;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "auth/user-not-found") throw error;
    superadminUid = (await firebaseAuth.createUser({
      phoneNumber: superadminPhone,
      displayName: "MW-POS Superadmin",
    })).uid;
  }

  console.log("🌱 Seeding MW-POS database...\n");

  const now = new Date().toISOString();

  // Clear all existing data
  console.log("Clearing existing data...");
  const pathsToClear = [
    "users", "userStoreMemberships", "stores", "storeMembers",
    "products", "productSkus", "storeCatalog", "priceLists", "storePriceLists",
    "inventoryBalances", "inventoryLedger", "inventoryMovementsBySku",
    "carts", "orders", "ordersByStore", "ordersByStatus",
    "fulfillments", "stockReservations", "registers", "registerSessions",
    "sales", "salesByStore", "returns", "payments",
    "otpChallenges", "idempotencyKeys", "notifications", "auditLogs",
  ];
  for (const path of pathsToClear) {
    await adminDb.ref(path).set(null);
  }
  console.log("✅ Existing data cleared");

  // ─── Users ───────────────────────────────────────────────
  const users = {
    [superadminUid]: {
      uid: superadminUid,
      firebaseUid: superadminUid,
      email: null,
      phone: superadminPhone,
      displayName: "MW-POS Superadmin",
      role: "SUPERADMIN",
      approvalStatus: null,
      isActive: true,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    },
  };

  await adminDb.ref("users").set(users);
  console.log("✅ Superadmin user seeded");

  // ─── System Settings ─────────────────────────────────────
  await adminDb.ref("systemSettings").set({
    appName: "MW-POS",
    currency: "INR",
    defaultTaxRate: 18,
    lowStockThreshold: 10,
    otpExpiryMinutes: 5,
    otpResendCooldownSeconds: 30,
    maxOtpAttempts: 5,
    enableAppCheck: false,
  });
  console.log("✅ System settings seeded\n");

  console.log("🎉 Seed complete!\n");
  console.log("Superadmin login:");
  console.log(`  Phone: ${superadminPhone}`);
  console.log("  Authentication: Firebase SMS OTP");
}

seed().catch(console.error).finally(() => process.exit());
