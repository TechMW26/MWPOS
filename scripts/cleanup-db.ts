// ============================================================
// DB Cleanup Script — Remove all data except superadmin
// Run: npx tsx scripts/cleanup-db.ts
// ============================================================

import { adminDb } from "../src/lib/db/admin";

async function cleanup() {
  console.log("🔍 Finding superadmin user...");

  const usersSnap = await adminDb.ref("users").once("value");
  const users = usersSnap.val() as Record<string, { email?: string; role?: string }> | null;

  if (!users) {
    console.log("❌ No users found in DB.");
    process.exit(1);
  }

  // Find superadmin
  let superadminUid: string | null = null;
  for (const [uid, user] of Object.entries(users)) {
    if (user.role === "SUPERADMIN") {
      superadminUid = uid;
      console.log(`✅ Found superadmin: ${user.email || uid}`);
      break;
    }
  }

  if (!superadminUid) {
    console.log("❌ No SUPERADMIN found. Aborting.");
    process.exit(1);
  }

  // Remove all users except superadmin
  console.log("🗑️  Removing non-superadmin users...");
  let userCount = 0;
  for (const uid of Object.keys(users)) {
    if (uid !== superadminUid) {
      await adminDb.ref(`users/${uid}`).remove();
      await adminDb.ref(`userStoreMemberships/${uid}`).remove();
      userCount++;
    }
  }
  console.log(`   Removed ${userCount} users`);

  // Remove all stores
  console.log("🗑️  Removing all stores...");
  const storesSnap = await adminDb.ref("stores").once("value");
  const stores = storesSnap.val();
  let storeCount = 0;
  if (stores) {
    for (const sid of Object.keys(stores)) {
      await adminDb.ref(`stores/${sid}`).remove();
      await adminDb.ref(`storeMembers/${sid}`).remove();
      storeCount++;
    }
  }
  await adminDb.ref("stores").remove();
  console.log(`   Removed ${storeCount} stores`);

  // Remove orders and related data
  console.log("🗑️  Removing all orders...");
  await adminDb.ref("orders").remove();
  await adminDb.ref("ordersByStore").remove();
  await adminDb.ref("ordersByDistributor").remove();
  await adminDb.ref("ordersByStatus").remove();
  await adminDb.ref("orderOtpRequests").remove();
  await adminDb.ref("idempotencyKeys").remove();
  console.log("   Orders cleared");

  // Remove inventory
  console.log("🗑️  Removing inventory...");
  await adminDb.ref("inventory").remove();
  await adminDb.ref("inventoryLedger").remove();
  console.log("   Inventory cleared");

  // Remove khata
  console.log("🗑️  Removing khata data...");
  await adminDb.ref("khataLedger").remove();
  await adminDb.ref("khataBalances").remove();
  console.log("   Khata cleared");

  // Remove cart data
  console.log("🗑️  Removing cart data...");
  await adminDb.ref("carts").remove();
  console.log("   Carts cleared");

  // Remove districts
  console.log("🗑️  Removing districts...");
  await adminDb.ref("districts").remove();
  console.log("   Districts cleared");

  // Remove notifications & audit logs
  console.log("🗑️  Removing notifications & audit logs...");
  await adminDb.ref("notifications").remove();
  await adminDb.ref("auditLogs").remove();
  console.log("   Notifications & audit logs cleared");

  console.log("\n✅ Database cleaned! Only superadmin remains.");
  console.log(`   Superadmin UID: ${superadminUid}`);
  process.exit(0);
}

cleanup().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
