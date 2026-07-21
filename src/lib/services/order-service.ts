// ============================================================
// Order Service — B2B Order lifecycle management
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { reserveInventory, releaseInventoryReservation, fulfillFromReserved, receiveInventory } from "./inventory-service";
import type { KhataLedgerEntry, Order, OrderItem, OrderStatusChange, Distributor, User } from "@/types/models";
import type { OrderPaymentMode, OrderPaymentProofType, OrderStatus } from "@/types";
import type { SessionData } from "@/types/models";
import { writeAuditLog } from "./audit-service";
import { sendOrderApprovalNotification } from "@/lib/notifications/order-notification";
import { notifyOrderParticipants } from "@/lib/notifications/order-events";

interface CreateOrderInput {
  distributorId: string;
  sourceStoreId: string; // distribution store (C&F's warehouse)
  asmId: string;
  items: Array<{ skuId: string; productId: string; quantity: number }>;
  paymentMode?: OrderPaymentMode;
  paymentProofType?: OrderPaymentProofType | null;
  paymentProofUrl?: string | null;
  paymentProofFileName?: string | null;
  paymentProofMimeType?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}

interface OrderResult {
  orderId: string;
  status: OrderStatus;
  notificationDelivery?: { sent: boolean; devices: number };
}

// ─── Get product/SKU prices from server (never trust client) ─

type SkuPricing = {
  productId: string;
  productName: string;
  sku: string;
  sellingPrice: number;
  taxRate: number;
  taxType: string;
};

function finiteNumber(value: unknown, fallback: number | null = null): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSkuPricing(skuId: string, sku: any, product: any): SkuPricing {
  const productId = typeof sku.productId === "string" && sku.productId ? sku.productId : null;
  if (!productId) throw new Error(`SKU ${skuId} is missing a product link`);

  const sellingPrice = finiteNumber(sku.sellingPrice);
  if (!sellingPrice || sellingPrice <= 0) throw new Error(`SKU ${sku.sku || skuId} has an invalid selling price`);

  const taxRate = Math.min(100, Math.max(0, finiteNumber(sku.taxRate, 0) ?? 0));

  return {
    productId,
    productName: product?.name ?? sku.sku ?? "Unknown",
    sku: sku.sku ?? skuId,
    sellingPrice: Math.round(sellingPrice),
    taxRate,
    taxType: sku.taxType ?? "NONE",
  };
}

async function getSkuPricing(skuId: string): Promise<SkuPricing | null> {
  const skuSnap = await adminDb.ref(`productSkus/${skuId}`).get();
  if (!skuSnap.exists()) return null;
  const sku = skuSnap.val();
  const productSnap = await adminDb.ref(`products/${sku.productId}`).get();
  return buildSkuPricing(skuId, sku, productSnap.exists() ? productSnap.val() : null);
}

async function getSkuPricingMap(skuIds: string[]): Promise<Map<string, SkuPricing>> {
  const uniqueSkuIds = Array.from(new Set(skuIds));
  const skuEntries = await Promise.all(uniqueSkuIds.map(async (skuId) => {
    const skuSnap = await adminDb.ref(`productSkus/${skuId}`).get();
    return skuSnap.exists() ? [skuId, skuSnap.val()] as const : null;
  }));
  const skus = skuEntries.filter((entry): entry is readonly [string, any] => Boolean(entry));
  const productIds = Array.from(new Set(skus.map(([, sku]) => sku.productId).filter(Boolean)));
  const productEntries = await Promise.all(productIds.map(async (productId) => {
    const productSnap = await adminDb.ref(`products/${productId}`).get();
    return [productId, productSnap.exists() ? productSnap.val() : null] as const;
  }));
  const productsById = new Map(productEntries);
  const pricingBySkuId = new Map<string, SkuPricing>();

  for (const [skuId, sku] of skus) {
    pricingBySkuId.set(skuId, buildSkuPricing(skuId, sku, productsById.get(sku.productId)));
  }

  return pricingBySkuId;
}

async function getCfIdForDistributor(distributor: Distributor): Promise<string | null> {
  if (!distributor.districtId) return null;
  const snap = await adminDb.ref("users").orderByChild("role").equalTo("ASM").once("value");
  if (!snap.exists()) return null;
  const users = Object.values(snap.val() as Record<string, User>);
  return users.find((user) => user.isActive && user.approvalStatus === "APPROVED" && user.districtId === distributor.districtId && user.cfId)?.cfId ?? null;
}

// ─── Create Order (ASM places for a Distributor) ─────────────

export async function createOrder(input: CreateOrderInput, session: SessionData): Promise<OrderResult> {
  // Check idempotency
  const idemSnap = await adminDb.ref(`idempotencyKeys/order/${input.idempotencyKey}`).get();
  if (idemSnap.exists()) {
    return { orderId: idemSnap.val().orderId, status: "DRAFT" };
  }

  // Verify distributor exists and caller can order for it
  const distSnap = await adminDb.ref(`stores/${input.distributorId}`).get();
  if (!distSnap.exists()) throw new Error("Distributor not found");
  const distributor = distSnap.val() as Distributor;

  if (session.role === "ASM" && session.districtId && distributor.districtId !== session.districtId) {
    throw new Error("Distributor is not in your assigned district");
  }
  if (session.role === "DISTRIBUTOR" && !session.distributorIds.includes(input.distributorId) && !session.storeIds.includes(input.distributorId)) {
    throw new Error("Distributor is not linked to your account");
  }
  if (session.role === "C_AND_F") {
    const asmsSnap = await adminDb.ref("users").orderByChild("role").equalTo("ASM").get();
    const asms = Object.values((asmsSnap.val() as Record<string, User> | null) || {});
    const allowedDistricts = new Set(asms.filter((asm) => asm.cfId === session.uid && asm.isActive).map((asm) => asm.districtId).filter(Boolean));
    if (!distributor.districtId || !allowedDistricts.has(distributor.districtId)) throw new Error("Distributor is not assigned to your C&F account");
  }

  const placedByDistributor = session.role === "DISTRIBUTOR";
  const placedByCf = session.role === "C_AND_F";

  // Get C&F assignment
  let cfId: string | null = null;
  if (session.role === "ASM" && session.cfId) {
    cfId = session.cfId;
  } else if (placedByCf) {
    cfId = session.uid;
  } else if (placedByDistributor) {
    cfId = session.cfId ?? await getCfIdForDistributor(distributor);
    if (!cfId) throw new Error("No C&F is assigned to this distributor's district");
  }

  const orderId = uuidv4();
  const now = new Date().toISOString();
  const initialStatusHistoryId = uuidv4();

  // Build order items with server-verified pricing
  const orderItems: Record<string, OrderItem> = {};
  let subtotalPaise = 0;
  let taxPaise = 0;
  const pricingBySkuId = await getSkuPricingMap(input.items.map((item) => item.skuId));

  for (const item of input.items) {
    const pricing = pricingBySkuId.get(item.skuId);
    if (!pricing) throw new Error(`SKU ${item.skuId} not found`);

    const lineTotal = pricing.sellingPrice * item.quantity;
    const lineTax = Math.round(lineTotal * pricing.taxRate / 100);

    const itemId = uuidv4();
    orderItems[itemId] = {
      orderId,
      skuId: item.skuId,
      productId: pricing.productId,
      productName: pricing.productName,
      sku: pricing.sku,
      quantity: item.quantity,
      unitPricePaise: pricing.sellingPrice,
      taxRate: pricing.taxRate,
      taxPaise: lineTax,
      discountPaise: 0,
      totalPaise: lineTotal,
    };

    subtotalPaise += lineTotal;
    taxPaise += lineTax;
  }

  const totalPaise = subtotalPaise + taxPaise;
  const paymentMode = input.paymentMode ?? "PAY_LATER";
  const paymentProvider = paymentMode === "PAY_LATER" ? "KHATA" : input.paymentProofType === "CHEQUE" ? "CHEQUE" : input.paymentProofType === "ONLINE" ? "ONLINE" : "RAZORPAY";
  const khataEntryId = paymentMode === "PAY_LATER" ? uuidv4() : null;
  const initialStatus: OrderStatus = placedByDistributor || placedByCf ? "PENDING_CF_APPROVAL" : "PENDING_OTP";

  const initialStatusChange: OrderStatusChange = {
    from: null,
    to: initialStatus,
    changedBy: session.uid,
    changedAt: now,
    notes: placedByCf ? "Direct order created by C&F" : placedByDistributor ? "Order created by distributor — awaiting C&F approval" : "Order created by ASM — awaiting distributor OTP verification",
  };

  const order: Order = {
    id: orderId,
    distributorId: input.distributorId,
    sourceStoreId: input.sourceStoreId,
    asmId: input.asmId,
    placedByUid: session.uid,
    otpStatus: placedByDistributor || placedByCf ? "VERIFIED" : "PENDING",
    otpRequestId: null,
    otpExpiresAt: null,
    otpChannel: null,
    otpDestination: null,
    cfId,
    cfApprovalStatus: cfId || placedByDistributor ? "PENDING" : "NOT_REQUIRED",
    paymentMode,
    paymentProvider,
    paymentProofType: input.paymentProofType ?? null,
    paymentProofUrl: input.paymentProofUrl ?? null,
    paymentProofFileName: input.paymentProofFileName ?? null,
    paymentProofMimeType: input.paymentProofMimeType ?? null,
    paymentReference: input.paymentReference ?? null,
    paymentStatus: paymentMode === "PAY_LATER" ? "CREDIT_DUE" : input.paymentProofType === "ONLINE" ? "COMPLETED" : "PENDING",
    paidAmountPaise: paymentMode === "UPFRONT" && input.paymentProofType === "ONLINE" ? totalPaise : 0,
    khataEntryId,
    status: initialStatus,
    subtotalPaise,
    taxPaise,
    discountPaise: 0,
    totalPaise,
    notes: input.notes ?? null,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    statusHistory: { [initialStatusHistoryId]: initialStatusChange },
  };

  // Write order and items atomically
  const updates: Record<string, unknown> = {
    [`orders/${orderId}`]: order,
    [`ordersByDistributor/${input.distributorId}/${orderId}`]: {
      orderId, status: initialStatus, totalPaise, createdAt: now,
    },
    [`ordersByStatus/${initialStatus}/${orderId}`]: {
      orderId, distributorId: input.distributorId, createdAt: now,
    },
    [`idempotencyKeys/order/${input.idempotencyKey}`]: { orderId, createdAt: now },
  };

  // Add each item
  for (const [itemId, item] of Object.entries(orderItems)) {
    updates[`orders/${orderId}/items/${itemId}`] = item;
  }

  if ((placedByDistributor || placedByCf) && paymentMode === "PAY_LATER" && khataEntryId) {
    const balanceSnap = await adminDb.ref(`khataBalances/${input.distributorId}/balancePaise`).get();
    const currentBalance = balanceSnap.exists() ? finiteNumber(balanceSnap.val(), 0) ?? 0 : 0;
    const balanceAfter = currentBalance + totalPaise;
    const khataEntry: KhataLedgerEntry = {
      id: khataEntryId,
      storeId: input.distributorId,
      orderId,
      type: "DEBIT",
      amountPaise: totalPaise,
      balanceAfterPaise: balanceAfter,
      notes: input.notes ?? "Order placed on khata",
      createdBy: session.uid,
      createdAt: now,
    };
    updates[`khataLedger/${input.distributorId}/${khataEntryId}`] = khataEntry;
    updates[`khataBalances/${input.distributorId}`] = {
      storeId: input.distributorId,
      balancePaise: balanceAfter,
      updatedAt: now,
    };
  }

  await adminDb.ref().update(updates);

  await writeAuditLog({
    actorId: session.uid,
    action: "ORDER_CREATED",
    entityType: "ORDER",
    entityId: orderId,
    after: { status: initialStatus, distributorId: input.distributorId, asmId: input.asmId, totalPaise },
  }).catch((error) => console.error("[Order] Failed to write creation audit log:", error));

  let notificationDelivery: OrderResult["notificationDelivery"];
  if (!placedByDistributor && !placedByCf) {
    notificationDelivery = await sendOrderApprovalNotification({
      orderId,
      distributor,
      items: Object.values(orderItems),
      totalPaise,
    });
  }

  // Notify C&F if assigned
  if (cfId) {
    try {
      const cfSnap = await adminDb.ref(`users/${cfId}`).get();
      if (cfSnap.exists() && cfSnap.val().email) {
        const { sendNotificationEmail } = await import("@/lib/mail/mailer");
        await sendNotificationEmail({
          to: cfSnap.val().email,
          subject: `Pending Order #${orderId.slice(0, 8)}`,
          title: placedByDistributor ? "New Order Awaiting Approval" : "New Order Awaiting OTP",
          message: placedByDistributor
            ? `A new order of ${formatAmount(totalPaise)} has been placed by ${distributor.name} and is ready for your approval.`
            : `A new order of ${formatAmount(totalPaise)} for ${distributor.name} is pending distributor OTP verification. You'll be notified when it's ready for your approval.`,
        });
      }
    } catch (e) { console.error('[Order] CF notification failed:', e); }
  }

  return { orderId, status: initialStatus, notificationDelivery };
}

function formatAmount(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

// ─── Submit Order ────────────────────────────────────────────

export async function submitOrder(orderId: string, session: SessionData): Promise<OrderResult> {
  return transitionOrder(orderId, "OTP_VERIFIED", session, null);
}

// ─── Approve Order (reserves inventory) ──────────────────────

export async function approveOrder(orderId: string, session: SessionData, notes?: string | null): Promise<OrderResult> {
  const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
  if (!orderSnap.exists()) throw new Error("Order not found");
  const order = orderSnap.val() as Order;

  if (!["PENDING_CF_APPROVAL", "OTP_VERIFIED"].includes(order.status)) {
    throw new Error(`Cannot approve order in status: ${order.status}`);
  }

  // Reserve inventory for each item
  const itemsSnap = await adminDb.ref(`orders/${orderId}/items`).get();
  const items = itemsSnap.val() as Record<string, OrderItem> | null;

  if (items) {
    for (const item of Object.values(items)) {
      await reserveInventory({
        storeId: order.sourceStoreId,
        skuId: item.skuId,
        orderId,
        quantity: item.quantity,
        idempotencyKey: `approve-${orderId}-${item.skuId}`,
        performedBy: session.uid,
      });
    }
  }

  return transitionOrder(orderId, "CF_APPROVED", session, notes);
}

// ─── Transition Order ────────────────────────────────────────

export async function transitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  session: SessionData,
  notes?: string | null
): Promise<OrderResult> {
  const orderRef = adminDb.ref(`orders/${orderId}`);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists()) throw new Error("Order not found");

  const order = orderSnap.val() as Order;
  const fromStatus = order.status;
  const now = new Date().toISOString();
  const statusHistoryId = uuidv4();

  // Validate transition
  validateOrderTransition(fromStatus, toStatus);

  const statusChange: OrderStatusChange = {
    from: fromStatus,
    to: toStatus,
    changedBy: session.uid,
    changedAt: now,
    notes: notes ?? null,
  };

  const updates: Record<string, unknown> = {
    [`orders/${orderId}/status`]: toStatus,
    [`orders/${orderId}/updatedAt`]: now,
    [`orders/${orderId}/statusHistory/${statusHistoryId}`]: statusChange,
    [`ordersByDistributor/${order.distributorId}/${orderId}/status`]: toStatus,
  };

  if (toStatus === "CF_APPROVED") updates[`orders/${orderId}/cfApprovalStatus`] = "APPROVED";
  if (toStatus === "CF_REJECTED") updates[`orders/${orderId}/cfApprovalStatus`] = "REJECTED";

  // Remove from old status index, add to new
  updates[`ordersByStatus/${fromStatus}/${orderId}`] = null;
  updates[`ordersByStatus/${toStatus}/${orderId}`] = {
    orderId,
    distributorId: order.distributorId,
    createdAt: now,
  };

  await adminDb.ref().update(updates);

  await writeAuditLog({
    actorId: session.uid,
    action: "ORDER_STATUS_CHANGE",
    entityType: "ORDER",
    entityId: orderId,
    before: { status: fromStatus },
    after: { status: toStatus, notes: notes ?? null },
  }).catch((error) => console.error("[Order] Failed to write transition audit log:", error));

  await notifyOrderParticipants({ ...order, status: toStatus }, toStatus, session.uid)
    .catch((error) => console.error("[Order] Failed to notify participants:", error));

  return { orderId, status: toStatus };
}

// ─── Cancel Order (releases reservations) ────────────────────

export async function cancelOrder(orderId: string, session: SessionData, notes?: string | null): Promise<OrderResult> {
  const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
  if (!orderSnap.exists()) throw new Error("Order not found");
  const order = orderSnap.val() as Order;

  // Release reservations if order was approved/allocated
  if (["CF_APPROVED", "APPROVED", "ALLOCATED", "PICKING", "PACKED"].includes(order.status)) {
    const itemsSnap = await adminDb.ref(`orders/${orderId}/items`).get();
    const items = itemsSnap.val() as Record<string, OrderItem> | null;

    if (items) {
      for (const item of Object.values(items)) {
        try {
          await releaseInventoryReservation({
            storeId: order.sourceStoreId,
            skuId: item.skuId,
            orderId,
            performedBy: session.uid,
          });
        } catch {
          // Reservation might not exist — continue
        }
      }
    }
  }

  return transitionOrder(orderId, "CANCELLED", session, notes);
}

// ─── Reject Order ────────────────────────────────────────────

export async function rejectOrder(orderId: string, session: SessionData, notes?: string | null): Promise<OrderResult> {
  const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
  if (!orderSnap.exists()) throw new Error("Order not found");
  const order = orderSnap.val() as Order;

  // Release reservations if any
  if (["CF_APPROVED", "APPROVED", "ALLOCATED", "PICKING", "PACKED"].includes(order.status)) {
    const itemsSnap = await adminDb.ref(`orders/${orderId}/items`).get();
    const items = itemsSnap.val() as Record<string, OrderItem> | null;
    if (items) {
      for (const item of Object.values(items)) {
        try {
          await releaseInventoryReservation({
            storeId: order.sourceStoreId,
            skuId: item.skuId,
            orderId,
            performedBy: session.uid,
          });
        } catch {
          // continue
        }
      }
    }
  }

  return transitionOrder(orderId, "REJECTED", session, notes);
}

// ─── Fulfill Order (ship from distribution) ──────────────────

export async function fulfillOrder(
  orderId: string,
  session: SessionData,
  trackingNumber?: string | null,
  carrier?: string | null
): Promise<OrderResult> {
  const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
  if (!orderSnap.exists()) throw new Error("Order not found");
  const order = orderSnap.val() as Order;

  if (order.status !== "PACKED") {
    throw new Error(`Cannot fulfill order in status: ${order.status}`);
  }

  const itemsSnap = await adminDb.ref(`orders/${orderId}/items`).get();
  const items = itemsSnap.val() as Record<string, OrderItem> | null;

  if (items) {
    for (const item of Object.values(items)) {
      await fulfillFromReserved({
        storeId: order.sourceStoreId,
        skuId: item.skuId,
        orderId,
        quantity: item.quantity,
        idempotencyKey: `fulfill-${orderId}-${item.skuId}`,
        performedBy: session.uid,
      });
    }
  }

  // Update fulfillment record
  const fulfillmentUpdates: Record<string, unknown> = {
    [`fulfillments/${orderId}/status`]: "SHIPPED",
    [`fulfillments/${orderId}/shippedBy`]: session.uid,
    [`fulfillments/${orderId}/shippedAt`]: new Date().toISOString(),
  };
  if (trackingNumber) fulfillmentUpdates[`fulfillments/${orderId}/trackingNumber`] = trackingNumber;
  if (carrier) fulfillmentUpdates[`fulfillments/${orderId}/carrier`] = carrier;

  await adminDb.ref().update(fulfillmentUpdates);

  return transitionOrder(orderId, "SHIPPED", session, null);
}

// ─── Deliver Order (receive into customer store) ─────────────

export async function deliverOrder(orderId: string, session: SessionData): Promise<OrderResult> {
  const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
  if (!orderSnap.exists()) throw new Error("Order not found");
  const order = orderSnap.val() as Order;

  if (order.status !== "SHIPPED") {
    throw new Error(`Cannot deliver order in status: ${order.status}`);
  }

  // Receive inventory into distributor
  const itemsSnap = await adminDb.ref(`orders/${orderId}/items`).get();
  const items = itemsSnap.val() as Record<string, OrderItem> | null;

  if (items) {
    for (const item of Object.values(items)) {
      await receiveInventory({
        storeId: order.distributorId,
        skuId: item.skuId,
        movementType: "PURCHASE",
        quantity: item.quantity,
        referenceType: "ORDER",
        referenceId: orderId,
        idempotencyKey: `deliver-${orderId}-${item.skuId}`,
        performedBy: session.uid,
      });
    }
  }

  await adminDb.ref(`fulfillments/${orderId}`).update({
    deliveredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return transitionOrder(orderId, "DELIVERED", session, null);
}

// ─── Validate Transition ─────────────────────────────────────

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["PENDING_OTP", "CANCELLED"],
  PENDING_OTP: ["OTP_VERIFIED", "CANCELLED", "DRAFT"],
  OTP_VERIFIED: ["PENDING_CF_APPROVAL", "CF_APPROVED", "CANCELLED"],
  PENDING_CF_APPROVAL: ["CF_APPROVED", "CF_REJECTED", "CANCELLED"],
  CF_APPROVED: ["ALLOCATED", "CANCELLED"],
  CF_REJECTED: ["DRAFT"],
  ALLOCATED: ["PICKING", "CANCELLED"],
  PICKING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

function validateOrderTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new Error(`Invalid order transition: ${from} → ${to}`);
  }
}

// ─── Get Order ───────────────────────────────────────────────

export async function getOrder(orderId: string): Promise<Order | null> {
  const snapshot = await adminDb.ref(`orders/${orderId}`).get();
  if (!snapshot.exists()) return null;
  return snapshot.val() as Order;
}

// ─── Get Orders By Distributor ───────────────────────────────

export async function getOrdersByDistributor(distributorId: string): Promise<Order[]> {
  const directSnap = await adminDb.ref("orders").orderByChild("distributorId").equalTo(distributorId).once("value");
  if (directSnap.exists()) {
    const orders = Object.values(directSnap.val() as Record<string, Order>);
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const snapshot = await adminDb.ref(`ordersByDistributor/${distributorId}`).get();
  if (!snapshot.exists()) return [];
  const entries = snapshot.val() as Record<string, { orderId: string }>;
  const orders = (await Promise.all(Object.values(entries).map((entry) => getOrder(entry.orderId)))).filter((order): order is Order => Boolean(order));
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Get Orders By ASM ───────────────────────────────────────

export async function getOrdersByAsm(asmId: string): Promise<Order[]> {
  const snap = await adminDb.ref("orders").orderByChild("asmId").equalTo(asmId).once("value");
  if (!snap.exists()) return [];
  const orders = Object.values(snap.val() as Record<string, Order>);
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Get Orders By C&F ───────────────────────────────────────

export async function getOrdersByCf(cfId: string): Promise<Order[]> {
  const snap = await adminDb.ref("orders").orderByChild("cfId").equalTo(cfId).once("value");
  if (!snap.exists()) return [];
  const orders = Object.values(snap.val() as Record<string, Order>).filter((order) => order.otpStatus !== "PENDING");
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
