import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import { districtTerritoryKey } from "@/lib/auth/authorization";
import { adminDb } from "@/lib/db/admin";
import { approveOrder, createOrder, getOrder } from "@/lib/services/order-service";
import type { SessionData } from "@/types/models";

const EMULATOR_URL = "http://127.0.0.1:9000";
const DISTRICT = "Madhya Pradesh|Bhopal|Ward 7";

const distributorSession: SessionData = {
  uid: "distributor-user",
  email: null,
  phone: "+918000000001",
  displayName: "Test Distributor",
  role: "DISTRIBUTOR",
  storeIds: ["dist-1"],
  distributorIds: ["dist-1"],
  districtId: null,
  cfId: "cf-user",
  approvalStatus: "APPROVED",
};

const asmSession: SessionData = {
  uid: "asm-user",
  email: null,
  phone: "+918000000002",
  displayName: "Test ASM",
  role: "ASM",
  storeIds: [],
  distributorIds: [],
  districtId: "Madhya Pradesh|Bhopal|Ward 99",
  locations: [{ districtId: "Madhya Pradesh|Bhopal|Ward 99" } as never],
  cfId: "cf-user",
  approvalStatus: "APPROVED",
};

const cfSession: SessionData = {
  uid: "cf-user",
  email: null,
  phone: "+918000000003",
  displayName: "Test C&F",
  role: "C_AND_F",
  storeIds: [],
  distributorIds: [],
  districtId: null,
  cfId: null,
  approvalStatus: "APPROVED",
};

function input(idempotencyKey: string) {
  return {
    distributorId: "dist-1",
    sourceStoreId: null,
    asmId: "",
    assignedCfId: "cf-user",
    paymentMode: "UPFRONT" as const,
    paymentProofType: "ONLINE" as const,
    paymentProofUrl: "https://example.test/payment-proof.jpg",
    paymentProofFileName: "payment-proof.jpg",
    paymentProofMimeType: "image/jpeg",
    paymentReference: "TXN-1",
    items: [{ skuId: "sku-1", productId: "product-1", quantity: 2 }],
    notes: "Integration test order",
    idempotencyKey,
  };
}

before(() => {
  assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, "127.0.0.1:9000", "Run this test against the local RTDB emulator");
  assert.equal(process.env.FIREBASE_DATABASE_URL ?? process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, EMULATOR_URL);
});

beforeEach(async () => {
  await adminDb.ref().set(null);
  const now = new Date().toISOString();
  await adminDb.ref().update({
    "stores/dist-1": {
      id: "dist-1",
      name: "Test Distributor",
      type: "DISTRIBUTOR",
      districtId: DISTRICT,
      territoryKey: districtTerritoryKey(DISTRICT),
      ownerUid: distributorSession.uid,
      managerUid: null,
      logoUrl: null,
      address: "1 Test Street",
      city: "Bhopal",
      state: "Madhya Pradesh",
      pincode: "462001",
      phone: distributorSession.phone,
      email: null,
      gstin: null,
      approvalStatus: "APPROVED",
      isActive: true,
      createdBy: "admin",
      createdAt: now,
      updatedAt: now,
    },
    "products/product-1": {
      id: "product-1",
      name: "MX Powder",
      description: "",
      categoryId: "powders",
      brand: "MW",
      imageUrl: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    "productSkus/sku-1": {
      id: "sku-1",
      productId: "product-1",
      sku: "MX_TEST",
      barcode: null,
      unit: "piece",
      piecesPerBox: 12,
      mrp: 40_000,
      sellingPrice: 35_000,
      costPrice: 30_000,
      taxType: "GST",
      taxRate: 18,
      hsnCode: null,
      weightGrams: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  });
});

after(async () => {
  await adminDb.ref().set(null);
});

test("distributor order is atomic, priced by the server, indexed, and idempotent", async () => {
  const first = await createOrder(input("dist-order-1"), distributorSession);
  assert.equal(first.status, "PENDING_CF_APPROVAL");

  const order = await getOrder(first.orderId);
  assert.ok(order);
  assert.equal(order.totalPaise, 82_600);
  assert.equal(Object.values(order.items ?? {}).length, 1);
  assert.equal(Object.values(order.items ?? {})[0]?.quantity, 2);
  assert.equal((await adminDb.ref(`ordersByDistributor/dist-1/${first.orderId}`).get()).exists(), true);
  assert.equal((await adminDb.ref(`ordersByStatus/PENDING_CF_APPROVAL/${first.orderId}`).get()).exists(), true);
  assert.equal((await adminDb.ref("idempotencyKeys/order/dist-order-1").get()).val().orderId, first.orderId);

  const repeated = await createOrder(input("dist-order-1"), distributorSession);
  assert.equal(repeated.orderId, first.orderId);
  const orders = (await adminDb.ref("orders").get()).val() as Record<string, unknown>;
  assert.equal(Object.keys(orders).length, 1);
});

test("simultaneous duplicate submissions create exactly one order", async () => {
  const [first, second] = await Promise.all([
    createOrder(input("concurrent-order"), distributorSession),
    createOrder(input("concurrent-order"), distributorSession),
  ]);
  assert.equal(first.orderId, second.orderId);
  const orders = (await adminDb.ref("orders").get()).val() as Record<string, unknown>;
  assert.equal(Object.keys(orders).length, 1);
});

test("inactive distributors and inactive SKUs fail before an order is written", async () => {
  await adminDb.ref("stores/dist-1/isActive").set(false);
  await assert.rejects(() => createOrder(input("inactive-dist"), distributorSession), /not active and approved/i);
  assert.equal((await adminDb.ref("orders").get()).exists(), false);

  await adminDb.ref("stores/dist-1/isActive").set(true);
  await adminDb.ref("productSkus/sku-1/isActive").set(false);
  await assert.rejects(() => createOrder(input("inactive-sku"), distributorSession), /inactive/i);
  assert.equal((await adminDb.ref("orders").get()).exists(), false);
});

test("ASM district access ignores ward but rejects a different district", async () => {
  const sameDistrict = await createOrder({ ...input("asm-same-district"), asmId: asmSession.uid }, asmSession);
  assert.equal(sameDistrict.status, "PENDING_OTP");
  assert.equal((await getOrder(sameDistrict.orderId))?.otpStatus, "PENDING");

  await assert.rejects(
    () => createOrder({ ...input("asm-wrong-district"), asmId: asmSession.uid }, {
      ...asmSession,
      districtId: "Madhya Pradesh|Indore|Ward 1",
      locations: [],
    }),
    /not in your assigned district/i
  );
});

test("C&F approval remains possible without a configured warehouse", async () => {
  const created = await createOrder(input("cf-no-warehouse"), distributorSession);
  const approved = await approveOrder(created.orderId, cfSession, "Approved in integration test");
  assert.equal(approved.status, "CF_APPROVED");
  const order = await getOrder(created.orderId);
  assert.equal(order?.sourceStoreId ?? null, null);
  assert.equal(order?.cfApprovalStatus, "APPROVED");
  const approvalHistory = Object.values(order?.statusHistory ?? {}).find((entry) => entry.to === "CF_APPROVED");
  assert.match(approvalHistory?.notes ?? "", /reservation skipped/i);
});
