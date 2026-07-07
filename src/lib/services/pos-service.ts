// ============================================================
// POS Service — Sale, Return, Register management
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { createInventoryMovement } from "./inventory-service";
import type { Sale, SaleItem, Return, ReturnItem, RegisterSession, Payment } from "@/types/models";
import type { SessionData } from "@/types/models";

// ─── Create Sale ─────────────────────────────────────────────

interface CreateSaleInput {
  storeId: string;
  registerSessionId: string;
  customerId: string | null;
  items: Array<{ skuId: string; quantity: number }>;
  paymentMethod: "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";
  discountPaise: number;
  idempotencyKey: string;
}

export async function createSale(input: CreateSaleInput, session: SessionData): Promise<Sale> {
  // Check idempotency
  const idemSnap = await adminDb.ref(`idempotencyKeys/sale/${input.idempotencyKey}`).get();
  if (idemSnap.exists()) {
    throw new Error("Sale already processed");
  }

  // Verify register session is open
  const regSessionSnap = await adminDb.ref(`registerSessions/${input.storeId}/${input.registerSessionId}`).get();
  if (!regSessionSnap.exists()) throw new Error("Register session not found");
  const regSession = regSessionSnap.val() as RegisterSession;
  if (regSession.status !== "OPEN") throw new Error("Register session is closed");

  const saleId = uuidv4();
  const now = new Date().toISOString();

  let subtotalPaise = 0;
  let taxPaise = 0;
  const saleItems: Record<string, SaleItem> = {};

  // Get SKU pricing from server and deduct inventory
  for (const item of input.items) {
    const skuSnap = await adminDb.ref(`productSkus/${item.skuId}`).get();
    if (!skuSnap.exists()) throw new Error(`SKU ${item.skuId} not found`);
    const sku = skuSnap.val();
    const productSnap = await adminDb.ref(`products/${sku.productId}`).get();
    const productName = productSnap.val()?.name ?? "Unknown";

    const lineTotal = sku.sellingPrice * item.quantity;
    const lineTax = Math.round(lineTotal * sku.taxRate / 100);

    subtotalPaise += lineTotal;
    taxPaise += lineTax;

    const itemId = uuidv4();
    saleItems[itemId] = {
      saleId,
      skuId: item.skuId,
      productId: sku.productId,
      productName,
      sku: sku.sku,
      quantity: item.quantity,
      unitPricePaise: sku.sellingPrice,
      taxRate: sku.taxRate,
      taxPaise: lineTax,
      discountPaise: 0,
      totalPaise: lineTotal,
    };

    // Deduct inventory
    await createInventoryMovement({
      storeId: input.storeId,
      skuId: item.skuId,
      movementType: "SALE",
      quantity: -item.quantity,
      referenceType: "SALE",
      referenceId: saleId,
      idempotencyKey: `${input.idempotencyKey}-${item.skuId}`,
      performedBy: session.uid,
    });
  }

  const totalPaise = subtotalPaise + taxPaise - input.discountPaise;

  const sale: Sale = {
    id: saleId,
    storeId: input.storeId,
    registerSessionId: input.registerSessionId,
    customerId: input.customerId ?? null,
    subtotalPaise,
    taxPaise,
    discountPaise: input.discountPaise,
    totalPaise,
    paymentMethod: input.paymentMethod,
    paymentStatus: "COMPLETED",
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    createdBy: session.uid,
  };

  const payment: Payment = {
    id: uuidv4(),
    saleId,
    orderId: null,
    amountPaise: totalPaise,
    method: input.paymentMethod,
    status: "COMPLETED",
    reference: null,
    paidAt: now,
    customerId: input.customerId ?? null,
  };

  const updates: Record<string, unknown> = {
    [`sales/${saleId}`]: sale,
    [`salesByStore/${input.storeId}/${saleId}`]: {
      saleId,
      totalPaise,
      paymentMethod: input.paymentMethod,
      createdAt: now,
    },
    [`payments/${payment.id}`]: payment,
    [`idempotencyKeys/sale/${input.idempotencyKey}`]: { saleId, createdAt: now },
  };

  for (const [itemId, item] of Object.entries(saleItems)) {
    updates[`sales/${saleId}/items/${itemId}`] = item;
  }

  // Update register session expected cash
  if (input.paymentMethod === "CASH") {
    updates[`registerSessions/${input.storeId}/${input.registerSessionId}/expectedCashPaise`] =
      (regSession.expectedCashPaise ?? 0) + totalPaise;
  }

  await adminDb.ref().update(updates);

  return sale;
}

// ─── Process Return ──────────────────────────────────────────

interface CreateReturnInput {
  saleId: string;
  items: Array<{ skuId: string; quantity: number }>;
  reason: string;
  idempotencyKey: string;
}

export async function processReturn(input: CreateReturnInput, session: SessionData): Promise<Return> {
  const idemSnap = await adminDb.ref(`idempotencyKeys/return/${input.idempotencyKey}`).get();
  if (idemSnap.exists()) throw new Error("Return already processed");

  const saleSnap = await adminDb.ref(`sales/${input.saleId}`).get();
  if (!saleSnap.exists()) throw new Error("Sale not found");
  const sale = saleSnap.val() as Sale;

  const returnId = uuidv4();
  const now = new Date().toISOString();

  let totalRefundPaise = 0;

  for (const item of input.items) {
    const skuSnap = await adminDb.ref(`productSkus/${item.skuId}`).get();
    if (!skuSnap.exists()) throw new Error(`SKU ${item.skuId} not found`);
    const sku = skuSnap.val();

    const refundPaise = sku.sellingPrice * item.quantity;
    totalRefundPaise += refundPaise;

    // Return items to inventory
    await createInventoryMovement({
      storeId: sale.storeId,
      skuId: item.skuId,
      movementType: "RETURN",
      quantity: item.quantity,
      referenceType: "RETURN",
      referenceId: returnId,
      idempotencyKey: `${input.idempotencyKey}-${item.skuId}`,
      performedBy: session.uid,
    });

    // Create return item record
    await adminDb.ref(`returns/${returnId}/items/${item.skuId}`).set({
      returnId,
      saleItemSkuId: item.skuId,
      quantity: item.quantity,
      refundPaise,
    } satisfies ReturnItem);
  }

  const ret: Return = {
    id: returnId,
    saleId: input.saleId,
    storeId: sale.storeId,
    totalPaise: totalRefundPaise,
    reason: input.reason,
    status: "COMPLETED",
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    createdBy: session.uid,
  };

  // Create refund payment
  const refundPayment: Payment = {
    id: uuidv4(),
    saleId: input.saleId,
    orderId: null,
    amountPaise: -totalRefundPaise, // negative = refund
    method: sale.paymentMethod,
    status: "REFUNDED",
    reference: returnId,
    paidAt: now,
    customerId: sale.customerId,
  };

  await adminDb.ref().update({
    [`returns/${returnId}`]: ret,
    [`payments/${refundPayment.id}`]: refundPayment,
    [`idempotencyKeys/return/${input.idempotencyKey}`]: { returnId, createdAt: now },
  });

  return ret;
}

// ─── Open Register ───────────────────────────────────────────

export async function openRegister(
  storeId: string,
  registerId: string,
  openingFloatPaise: number,
  session: SessionData
): Promise<RegisterSession> {
  const sessionId = uuidv4();
  const now = new Date().toISOString();

  const registerSession: RegisterSession = {
    id: sessionId,
    registerId,
    storeId,
    openedBy: session.uid,
    openingFloatPaise,
    expectedCashPaise: openingFloatPaise,
    actualCashPaise: null,
    variancePaise: null,
    status: "OPEN",
    openedAt: now,
    closedAt: null,
    closedBy: null,
    notes: null,
  };

  await adminDb.ref(`registerSessions/${storeId}/${sessionId}`).set(registerSession);
  return registerSession;
}

// ─── Close Register ──────────────────────────────────────────

export async function closeRegister(
  storeId: string,
  sessionId: string,
  actualCashPaise: number,
  notes: string | null,
  session: SessionData
): Promise<RegisterSession> {
  const ref = adminDb.ref(`registerSessions/${storeId}/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists()) throw new Error("Register session not found");

  const regSession = snap.val() as RegisterSession;
  if (regSession.status !== "OPEN") throw new Error("Register already closed");

  const now = new Date().toISOString();
  const variancePaise = actualCashPaise - regSession.expectedCashPaise;

  const updates = {
    status: "CLOSED" as const,
    actualCashPaise,
    variancePaise,
    closedAt: now,
    closedBy: session.uid,
    notes,
  };

  await ref.update(updates);

  return { ...regSession, ...updates };
}

// ─── Get Sale ────────────────────────────────────────────────

export async function getSale(saleId: string): Promise<Sale | null> {
  const snap = await adminDb.ref(`sales/${saleId}`).get();
  if (!snap.exists()) return null;
  return snap.val() as Sale;
}
