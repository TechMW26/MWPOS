import assert from "node:assert/strict";
import test from "node:test";

import { districtMatchesTerritory, districtTerritoryKey } from "@/lib/auth/authorization";
import { validateRtdbUpdate, validateRtdbValue } from "@/lib/db/rtdb-validation";
import {
  addCartItem,
  calculateCartTotals,
  getCartQuantityLabel,
  setCartItemQuantity,
  type OrderCartItem,
} from "@/lib/cart/order-cart";
import { validateFirebaseOrderIdentity, validateOrderTransition } from "@/lib/orders/workflow";
import { createOrderSchema } from "@/lib/validation/schemas";

test("RTDB validation accepts a single order payload containing its items", () => {
  assert.doesNotThrow(() => validateRtdbUpdate({
    "orders/order-1": {
      id: "order-1",
      items: { "item-1": { skuId: "sku-1", quantity: 2 } },
    },
    "ordersByStatus/PENDING_CF_APPROVAL/order-1": { orderId: "order-1" },
  }));
});

test("RTDB validation rejects overlapping parent and child PATCH paths", () => {
  assert.throws(
    () => validateRtdbUpdate({
      "orders/order-1": { id: "order-1" },
      "orders/order-1/items/item-1": { skuId: "sku-1" },
    }),
    /overlapping firebase update paths/i
  );
});

test("RTDB validation rejects invalid keys and non-JSON-safe values", () => {
  assert.throws(() => validateRtdbValue({ "bad.key": true }), /invalid firebase key/i);
  assert.throws(() => validateRtdbValue({ missing: undefined }), /undefined/i);
  assert.throws(() => validateRtdbValue({ total: Number.NaN }), /finite/i);
});

test("territory matching is district-wide and state-safe", () => {
  assert.equal(districtMatchesTerritory("Madhya Pradesh|Bhopal|Ward 1", "madhya pradesh| bhopal |Ward 55"), true);
  assert.equal(districtMatchesTerritory("Madhya Pradesh|Bhopal", "Madhya Pradesh|Indore"), false);
  assert.equal(districtMatchesTerritory("Madhya Pradesh|Bhopal", "Rajasthan|Bhopal"), false);
  assert.equal(districtTerritoryKey(" Madhya Pradesh | Bhopal | Ward 8 "), "madhya pradesh|bhopal");
  assert.equal(districtTerritoryKey("Bhopal"), null);
});

test("order input rejects duplicate SKUs and unsafe quantities", () => {
  const base = {
    distributorId: "dist-1",
    paymentMode: "PAY_LATER" as const,
    idempotencyKey: "order_attempt_1",
  };
  assert.equal(createOrderSchema.safeParse({
    ...base,
    items: [{ skuId: "sku-1", productId: "product-1", quantity: 1 }],
  }).success, true);
  assert.equal(createOrderSchema.safeParse({ ...base, items: [] }).success, false);
  assert.equal(createOrderSchema.safeParse({
    ...base,
    items: [
      { skuId: "sku-1", productId: "product-1", quantity: 1 },
      { skuId: "sku-1", productId: "product-1", quantity: 2 },
    ],
  }).success, false);
  assert.equal(createOrderSchema.safeParse({
    ...base,
    items: [{ skuId: "sku-1", productId: "product-1", quantity: 100_001 }],
  }).success, false);
});

test("order workflow permits only declared transitions", () => {
  assert.doesNotThrow(() => validateOrderTransition("PENDING_CF_APPROVAL", "CF_APPROVED"));
  assert.doesNotThrow(() => validateOrderTransition("PENDING_CF_APPROVAL", "CF_REJECTED"));
  assert.throws(() => validateOrderTransition("DELIVERED", "CANCELLED"), /invalid order transition/i);
  assert.throws(() => validateOrderTransition("PENDING_OTP", "SHIPPED"), /invalid order transition/i);
});

test("Firebase distributor OTP identity checks UID, phone, and freshness", () => {
  const valid = {
    firebaseUid: "firebase-user-1",
    firebasePhone: "+91 80764 84222",
    firebaseAuthTime: 9_900,
    sessionUid: "session-user-1",
    sessionPhone: "8076484222",
    linkedFirebaseUid: "firebase-user-1",
    distributorPhone: "+918076484222",
    nowSeconds: 10_000,
  };
  assert.doesNotThrow(() => validateFirebaseOrderIdentity(valid));
  assert.throws(
    () => validateFirebaseOrderIdentity({ ...valid, distributorPhone: "+919999999999" }),
    /does not match this distributor/i
  );
  assert.throws(
    () => validateFirebaseOrderIdentity({ ...valid, firebaseUid: "attacker", linkedFirebaseUid: "another-user" }),
    /does not match this session/i
  );
  assert.throws(
    () => validateFirebaseOrderIdentity({ ...valid, firebaseAuthTime: 9_000 }),
    /expired/i
  );
});

test("cart calculations keep boxes, loose pieces, totals, and merges consistent", () => {
  const product: OrderCartItem = {
    skuId: "sku-1",
    productId: "product-1",
    productName: "MX Powder",
    sku: "MX_TEST",
    unit: "piece",
    piecesPerBox: 12,
    quantity: 12,
    unitPrice: 35_000,
    taxRate: 18,
  };
  assert.equal(getCartQuantityLabel(product), "1 box");
  assert.equal(getCartQuantityLabel({ quantity: 25, piecesPerBox: 12 }), "2 boxes + 1 piece");

  const merged = addCartItem(addCartItem([], product), { ...product, quantity: 2 });
  assert.equal(merged[0]?.quantity, 14);
  assert.deepEqual(calculateCartTotals(merged), {
    lineCount: 1,
    itemCount: 14,
    subtotal: 490_000,
    tax: 88_200,
    total: 578_200,
  });
  assert.deepEqual(setCartItemQuantity(merged, "sku-1", 0), []);
});
