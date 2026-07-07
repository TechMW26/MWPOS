// ============================================================
// MW-POS Database Seed Script
// Seeds: demo users, stores, products, SKUs, catalog, inventory
// Run: npm run seed
// ============================================================

import { loadEnvConfig } from "@next/env";
import { createHash, randomBytes } from "crypto";

loadEnvConfig(process.cwd());

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + password).digest("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  const { adminDb } = await import("../src/lib/db/admin");

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
  const superadminUid = "superadmin-001";

  const superadminPassword = hashPassword("Admin@login2025");

  const users = {
    [superadminUid]: {
      uid: superadminUid,
      email: "aviraj.sharma@mushroomworldgroup.com",
      phone: null,
      displayName: "Aviraj Sharma",
      role: "SUPERADMIN",
      approvalStatus: null,
      isActive: true,
      avatarUrl: null,
      hashedPassword: superadminPassword,
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
  console.log("  Email:    aviraj.sharma@mushroomworldgroup.com");
  console.log("  Password: Admin@login2025");
}

seed().catch(console.error).finally(() => process.exit());
