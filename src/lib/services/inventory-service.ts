// ============================================================
// Inventory Service — RTDB Transaction-based stock management
// All quantities are integers. Never allows negative stock.
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import type { InventoryBalance, InventoryLedgerEntry } from "@/types/models";
import type { InventoryMovementType } from "@/types";

interface MovementInput {
  storeId: string;
  skuId: string;
  movementType: InventoryMovementType;
  quantity: number; // positive = inbound, negative = outbound
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  performedBy: string;
  notes?: string | null;
}

interface InventoryResult {
  movementId: string;
  onHandBefore: number;
  onHandAfter: number;
  reservedBefore: number;
  reservedAfter: number;
}

// ─── Check idempotency ───────────────────────────────────────

async function checkIdempotency(scope: string, key: string): Promise<boolean> {
  const snapshot = await adminDb.ref(`idempotencyKeys/${scope}/${key}`).get();
  return snapshot.exists();
}

async function markIdempotency(scope: string, key: string, movementId: string): Promise<void> {
  await adminDb.ref(`idempotencyKeys/${scope}/${key}`).set({
    movementId,
    createdAt: new Date().toISOString(),
  });
}

// ─── Ensure balance node exists ──────────────────────────────

async function ensureBalance(storeId: string, skuId: string): Promise<void> {
  const ref = adminDb.ref(`inventoryBalances/${storeId}/${skuId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists()) {
    await ref.set({
      storeId,
      skuId,
      onHand: 0,
      reserved: 0,
      available: 0,
      reorderThreshold: 10,
      reorderQuantity: 50,
      lastCountedAt: null,
      updatedAt: new Date().toISOString(),
    } satisfies InventoryBalance);
  }
}

// ─── Core Movement ───────────────────────────────────────────

export async function createInventoryMovement(input: MovementInput): Promise<InventoryResult> {
  // Check idempotency
  const idemScope = `inventory:${input.storeId}:${input.skuId}`;
  const alreadyProcessed = await checkIdempotency(idemScope, input.idempotencyKey);
  if (alreadyProcessed) {
    const existing = await adminDb.ref(`idempotencyKeys/${idemScope}/${input.idempotencyKey}`).get();
    throw new Error(`Idempotent: already processed as ${existing.val().movementId}`);
  }

  await ensureBalance(input.storeId, input.skuId);

  const movementId = uuidv4();
  const balanceRef = adminDb.ref(`inventoryBalances/${input.storeId}/${input.skuId}`);

  // Perform atomic transaction on the balance node
  const result = await balanceRef.transaction((current: InventoryBalance | null) => {
    if (!current) return current; // shouldn't happen after ensureBalance

    const newOnHand = current.onHand + input.quantity;

    // Never allow negative stock
    if (newOnHand < 0) {
      return; // abort transaction — returns undefined to abort
    }

    // Never allow reserved > onHand
    if (current.reserved > newOnHand) {
      return; // abort
    }

    return {
      ...current,
      onHand: newOnHand,
      available: newOnHand - current.reserved,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!result.committed) {
    throw new Error(
      `Inventory movement failed: insufficient stock for ${input.skuId} in store ${input.storeId}. ` +
      `Requested change: ${input.quantity}`
    );
  }

  const snapshot = result.snapshot;
  const balance = snapshot.val() as InventoryBalance;

  // Write immutable ledger entry
  const ledgerEntry: InventoryLedgerEntry = {
    movementId,
    storeId: input.storeId,
    skuId: input.skuId,
    movementType: input.movementType,
    quantity: input.quantity,
    onHandBefore: balance.onHand - input.quantity,
    onHandAfter: balance.onHand,
    reservedBefore: balance.reserved,
    reservedAfter: balance.reserved,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    idempotencyKey: input.idempotencyKey,
    performedBy: input.performedBy,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    adminDb.ref(`inventoryLedger/${input.storeId}/${movementId}`).set(ledgerEntry),
    adminDb.ref(`inventoryMovementsBySku/${input.storeId}/${input.skuId}/${movementId}`).set(ledgerEntry),
    markIdempotency(idemScope, input.idempotencyKey, movementId),
  ]);

  return {
    movementId,
    onHandBefore: balance.onHand - input.quantity,
    onHandAfter: balance.onHand,
    reservedBefore: balance.reserved,
    reservedAfter: balance.reserved,
  };
}

// ─── Reserve Inventory ───────────────────────────────────────

export async function reserveInventory(input: {
  storeId: string;
  skuId: string;
  orderId: string;
  quantity: number;
  idempotencyKey: string;
  performedBy: string;
}): Promise<void> {
  await ensureBalance(input.storeId, input.skuId);

  const balanceRef = adminDb.ref(`inventoryBalances/${input.storeId}/${input.skuId}`);

  const result = await balanceRef.transaction((current: InventoryBalance | null) => {
    if (!current) return current;

    if (current.available < input.quantity) {
      return; // abort — insufficient available stock
    }

    const newReserved = current.reserved + input.quantity;
    const newAvailable = current.onHand - newReserved;

    if (newAvailable < 0) {
      return; // abort — shouldn't happen, but safety check
    }

    return {
      ...current,
      reserved: newReserved,
      available: newAvailable,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!result.committed) {
    throw new Error(
      `Failed to reserve ${input.quantity} of SKU ${input.skuId} in store ${input.storeId}. ` +
      `Insufficient available stock.`
    );
  }

  // Create reservation record
  await adminDb.ref(`stockReservations/${input.storeId}/${input.skuId}/${input.orderId}`).set({
    storeId: input.storeId,
    skuId: input.skuId,
    orderId: input.orderId,
    quantity: input.quantity,
    reservedAt: new Date().toISOString(),
    releasedAt: null,
  });
}

// ─── Release Reservation ─────────────────────────────────────

export async function releaseInventoryReservation(input: {
  storeId: string;
  skuId: string;
  orderId: string;
  performedBy: string;
}): Promise<void> {
  const reservationRef = adminDb.ref(`stockReservations/${input.storeId}/${input.skuId}/${input.orderId}`);
  const reservationSnap = await reservationRef.get();

  if (!reservationSnap.exists()) {
    throw new Error(`No reservation found for order ${input.orderId}, SKU ${input.skuId}`);
  }

  const reservation = reservationSnap.val() as { quantity: number; releasedAt: string | null };
  if (reservation.releasedAt) {
    throw new Error("Reservation already released");
  }

  const balanceRef = adminDb.ref(`inventoryBalances/${input.storeId}/${input.skuId}`);

  const result = await balanceRef.transaction((current: InventoryBalance | null) => {
    if (!current) return current;

    const newReserved = Math.max(0, current.reserved - reservation.quantity);
    return {
      ...current,
      reserved: newReserved,
      available: current.onHand - newReserved,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!result.committed) {
    throw new Error("Failed to release inventory reservation");
  }

  await reservationRef.child("releasedAt").set(new Date().toISOString());
}

// ─── Fulfill from reserved (decrease onHand and reserved) ────

export async function fulfillFromReserved(input: {
  storeId: string;
  skuId: string;
  orderId: string;
  quantity: number;
  idempotencyKey: string;
  performedBy: string;
}): Promise<InventoryResult> {
  await ensureBalance(input.storeId, input.skuId);

  const idemScope = `fulfill:${input.storeId}:${input.skuId}`;
  const alreadyProcessed = await checkIdempotency(idemScope, input.idempotencyKey);
  if (alreadyProcessed) {
    const existing = await adminDb.ref(`idempotencyKeys/${idemScope}/${input.idempotencyKey}`).get();
    throw new Error(`Idempotent: already fulfilled as ${existing.val().movementId}`);
  }

  const movementId = uuidv4();
  const balanceRef = adminDb.ref(`inventoryBalances/${input.storeId}/${input.skuId}`);

  const result = await balanceRef.transaction((current: InventoryBalance | null) => {
    if (!current) return current;

    const newOnHand = current.onHand - input.quantity;
    const newReserved = Math.max(0, current.reserved - input.quantity);

    if (newOnHand < 0 || newReserved < 0) {
      return; // abort
    }

    return {
      ...current,
      onHand: newOnHand,
      reserved: newReserved,
      available: newOnHand - newReserved,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!result.committed) {
    throw new Error(`Failed to fulfill ${input.quantity} of SKU ${input.skuId}`);
  }

  const snapshot = result.snapshot;
  const balance = snapshot.val() as InventoryBalance;

  const ledgerEntry: InventoryLedgerEntry = {
    movementId,
    storeId: input.storeId,
    skuId: input.skuId,
    movementType: "ORDER_FULFILLMENT",
    quantity: -input.quantity,
    onHandBefore: balance.onHand + input.quantity,
    onHandAfter: balance.onHand,
    reservedBefore: balance.reserved + input.quantity,
    reservedAfter: balance.reserved,
    referenceType: "ORDER",
    referenceId: input.orderId,
    idempotencyKey: input.idempotencyKey,
    performedBy: input.performedBy,
    notes: null,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    adminDb.ref(`inventoryLedger/${input.storeId}/${movementId}`).set(ledgerEntry),
    adminDb.ref(`inventoryMovementsBySku/${input.storeId}/${input.skuId}/${movementId}`).set(ledgerEntry),
    markIdempotency(idemScope, input.idempotencyKey, movementId),
    adminDb.ref(`stockReservations/${input.storeId}/${input.skuId}/${input.orderId}/releasedAt`).set(new Date().toISOString()),
  ]);

  return {
    movementId,
    onHandBefore: balance.onHand + input.quantity,
    onHandAfter: balance.onHand,
    reservedBefore: balance.reserved + input.quantity,
    reservedAfter: balance.reserved,
  };
}

// ─── Receive Inventory ───────────────────────────────────────

export async function receiveInventory(input: MovementInput): Promise<InventoryResult> {
  if (input.quantity <= 0) {
    throw new Error("Receive quantity must be positive");
  }
  return createInventoryMovement(input);
}

// ─── Adjust Inventory ────────────────────────────────────────

export async function adjustInventory(input: MovementInput): Promise<InventoryResult> {
  return createInventoryMovement({
    ...input,
    movementType: "ADJUSTMENT",
  });
}

// ─── Transfer Inventory ──────────────────────────────────────

export async function transferInventory(input: {
  fromStoreId: string;
  toStoreId: string;
  skuId: string;
  quantity: number;
  referenceId: string;
  idempotencyKey: string;
  performedBy: string;
  notes?: string | null;
}): Promise<{ outMovementId: string; inMovementId: string }> {
  // Transfer out
  const outResult = await createInventoryMovement({
    storeId: input.fromStoreId,
    skuId: input.skuId,
    movementType: "TRANSFER_OUT",
    quantity: -input.quantity,
    referenceType: "TRANSFER",
    referenceId: input.referenceId,
    idempotencyKey: `${input.idempotencyKey}-out`,
    performedBy: input.performedBy,
    notes: input.notes,
  });

  // Transfer in
  const inResult = await createInventoryMovement({
    storeId: input.toStoreId,
    skuId: input.skuId,
    movementType: "TRANSFER_IN",
    quantity: input.quantity,
    referenceType: "TRANSFER",
    referenceId: input.referenceId,
    idempotencyKey: `${input.idempotencyKey}-in`,
    performedBy: input.performedBy,
    notes: input.notes,
  });

  return {
    outMovementId: outResult.movementId,
    inMovementId: inResult.movementId,
  };
}

// ─── Get Balance ─────────────────────────────────────────────

export async function getInventoryBalance(storeId: string, skuId: string): Promise<InventoryBalance | null> {
  const snapshot = await adminDb.ref(`inventoryBalances/${storeId}/${skuId}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() as InventoryBalance;
}

// ─── Get Store Inventory ─────────────────────────────────────

export async function getStoreInventory(storeId: string): Promise<Record<string, InventoryBalance>> {
  const snapshot = await adminDb.ref(`inventoryBalances/${storeId}`).get();
  if (!snapshot.exists()) return {};
  return snapshot.val() as Record<string, InventoryBalance>;
}
