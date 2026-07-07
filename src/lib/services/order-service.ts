// ============================================================
// Order Service — B2B Order lifecycle management
// ============================================================

import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";
import { reserveInventory, releaseInventoryReservation, fulfillFromReserved, receiveInventory } from "./inventory-service";
import { generateOtpCode, hashOtpCode } from "@/lib/auth/otp-utils";
import { getOtpProvider } from "@/lib/auth/otp-provider";
import type { KhataLedgerEntry, Order, OrderApprovalRequest, OrderItem, OrderStatusChange, Store } from "@/types/models";
import type { OrderPaymentMode } from "@/types";
import type { OrderStatus } from "@/types";
import type { SessionData } from "@/types/models";

interface CreateOrderInput {
  customerStoreId: string;
  sourceStoreId: string; // distribution store
  customerId: string;
  items: Array<{ skuId: string; productId: string; quantity: number }>;
  paymentMode?: OrderPaymentMode;
  notes?: string | null;
  idempotencyKey: string;
}

interface OrderResult {
  orderId: string;
  status: OrderStatus;
}

// ─── Get product/SKU prices from server (never trust client) ─

async function getSkuPricing(skuId: string): Promise<{
  productId: string;
  productName: string;
  sku: string;
  sellingPrice: number;
  taxRate: number;
  taxType: string;
} | null> {
  const skuSnap = await adminDb.ref(`productSkus/${skuId}`).get();
  if (!skuSnap.exists()) return null;
  const sku = skuSnap.val();
  const productSnap = await adminDb.ref(`products/${sku.productId}`).get();
  return {
    productId: sku.productId,
    productName: productSnap.val()?.name ?? "Unknown",
    sku: sku.sku,
    sellingPrice: sku.sellingPrice,
    taxRate: sku.taxRate,
    taxType: sku.taxType,
  };
}

// ─── Create Order ────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput, _session: SessionData): Promise<OrderResult> {
  // Check idempotency
  const idemSnap = await adminDb.ref(`idempotencyKeys/order/${input.idempotencyKey}`).get();
  if (idemSnap.exists()) {
    return { orderId: idemSnap.val().orderId, status: "DRAFT" };
  }

  const orderId = uuidv4();
  const now = new Date().toISOString();
  const storeSnap = await adminDb.ref(`stores/${input.customerStoreId}`).get();
  const customerStore = storeSnap.exists() ? (storeSnap.val() as Store) : null;
  const requiresOwnerApproval = Boolean(
    customerStore?.ownerUid &&
      customerStore.ownerUid !== input.customerId &&
      _session.role === "STORE_MANAGER"
  );
  const approvalRequestId = requiresOwnerApproval ? uuidv4() : null;
  const initialOrderStatus: OrderStatus = requiresOwnerApproval ? "PENDING_OWNER_APPROVAL" : "DRAFT";

  // Build order items with server-verified pricing
  const orderItems: Record<string, OrderItem> = {};
  let subtotalPaise = 0;
  let taxPaise = 0;

  for (const item of input.items) {
    const pricing = await getSkuPricing(item.skuId);
    if (!pricing) {
      throw new Error(`SKU ${item.skuId} not found`);
    }

    const lineTotal = pricing.sellingPrice * item.quantity;
    const lineTax = Math.round(lineTotal * pricing.taxRate / 100);
    const lineSubtotal = lineTotal;

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

    subtotalPaise += lineSubtotal;
    taxPaise += lineTax;
  }

  const totalPaise = subtotalPaise + taxPaise;
  const paymentMode = input.paymentMode ?? "PAY_LATER";
  const khataEntryId = paymentMode === "PAY_LATER" ? uuidv4() : null;

  const initialStatus: OrderStatusChange = {
    from: null,
    to: initialOrderStatus,
    changedBy: input.customerId,
    changedAt: now,
    notes: null,
  };

  const order: Order = {
    id: orderId,
    customerStoreId: input.customerStoreId,
    sourceStoreId: input.sourceStoreId,
    customerId: input.customerId,
    placedByUid: input.customerId,
    ownerApprovalStatus: requiresOwnerApproval ? "PENDING" : "NOT_REQUIRED",
    ownerApprovalRequestId: approvalRequestId,
    paymentMode,
    paymentProvider: paymentMode === "UPFRONT" ? "RAZORPAY" : "KHATA",
    paymentStatus: paymentMode === "UPFRONT" ? "PENDING" : "CREDIT_DUE",
    paidAmountPaise: 0,
    khataEntryId,
    status: initialOrderStatus,
    subtotalPaise,
    taxPaise,
    discountPaise: 0,
    totalPaise,
    notes: input.notes ?? null,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    statusHistory: { [now]: initialStatus },
  };

  // Write order and items atomically
  const updates: Record<string, unknown> = {
    [`orders/${orderId}`]: order,
    [`ordersByStore/${input.customerStoreId}/${orderId}`]: {
      orderId,
      status: initialOrderStatus,
      totalPaise,
      createdAt: now,
    },
    [`ordersByStatus/${initialOrderStatus}/${orderId}`]: {
      orderId,
      storeId: input.customerStoreId,
      createdAt: now,
    },
    [`idempotencyKeys/order/${input.idempotencyKey}`]: { orderId, createdAt: now },
  };

  // Add each item
  for (const [itemId, item] of Object.entries(orderItems)) {
    updates[`orders/${orderId}/items/${itemId}`] = item;
  }

  if (requiresOwnerApproval && customerStore?.ownerUid && approvalRequestId) {
    const destination = customerStore.email ?? customerStore.phone ?? null;
    const channel = customerStore.email ? "email" : customerStore.phone ? "phone" : "app";
    const otp = destination ? generateOtpCode() : null;
    const approvalRequest: OrderApprovalRequest = {
      id: approvalRequestId,
      orderId,
      storeId: input.customerStoreId,
      ownerUid: customerStore.ownerUid,
      requestedByUid: input.customerId,
      channel,
      destination,
      hashedOtp: otp ? hashOtpCode(otp) : null,
      status: "PENDING",
      expiresAt: otp ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
      createdAt: now,
      respondedAt: null,
    };
    updates[`orderApprovalRequests/${approvalRequestId}`] = approvalRequest;
    updates[`notifications/${customerStore.ownerUid}/${approvalRequestId}`] = {
      id: approvalRequestId,
      uid: customerStore.ownerUid,
      title: "Order approval required",
      body: `Approve order ${orderId} for ${customerStore.name}`,
      type: "WARNING",
      read: false,
      createdAt: now,
      actionUrl: `/storefront/orders?approval=${approvalRequestId}`,
    };

    if (otp && destination && channel !== "app") {
      await getOtpProvider().requestOtp({
        channel,
        destination,
        code: otp,
        challengeId: approvalRequestId,
      });
    }
  }

  if (paymentMode === "PAY_LATER" && khataEntryId) {
    const balanceSnap = await adminDb.ref(`khataBalances/${input.customerStoreId}/balancePaise`).get();
    const currentBalance = balanceSnap.exists() ? Number(balanceSnap.val()) : 0;
    const balanceAfter = currentBalance + totalPaise;
    const khataEntry: KhataLedgerEntry = {
      id: khataEntryId,
      storeId: input.customerStoreId,
      orderId,
      type: "DEBIT",
      amountPaise: totalPaise,
      balanceAfterPaise: balanceAfter,
      notes: input.notes ?? "Order placed on khata",
      createdBy: input.customerId,
      createdAt: now,
    };
    updates[`khataLedger/${input.customerStoreId}/${khataEntryId}`] = khataEntry;
    updates[`khataBalances/${input.customerStoreId}`] = {
      storeId: input.customerStoreId,
      balancePaise: balanceAfter,
      updatedAt: now,
    };
  }

  await adminDb.ref().update(updates);

  // Send notification emails
  try {
    const { sendNotificationEmail } = await import("@/lib/mail/mailer");

    // Notify store owner
    if (customerStore?.email) {
      await sendNotificationEmail({ to: customerStore.email, subject: `New Order #${orderId.slice(0, 8)}`, title: 'New Order Placed', message: `A new order of ${formatAmount(totalPaise)} has been placed for ${customerStore.name}. View it at ${process.env.NEXT_PUBLIC_APP_URL || ''}/storefront/orders` });
    }
    // Notify store manager
    if (customerStore?.managerUid) {
      const mgrSnap = await adminDb.ref(`users/${customerStore.managerUid}`).get();
      if (mgrSnap.exists() && mgrSnap.val().email) {
        await sendNotificationEmail({ to: mgrSnap.val().email, subject: `New Order #${orderId.slice(0, 8)}`, title: 'New Order Placed', message: `A new order of ${formatAmount(totalPaise)} has been placed for ${customerStore.name}. View it at ${process.env.NEXT_PUBLIC_APP_URL || ''}/manager/orders` });
      }
    }
    // Notify admin
    const adminSnap = await adminDb.ref("users").orderByChild("role").equalTo("ADMIN").once("value");
    if (adminSnap.exists()) {
      const admins = Object.values(adminSnap.val() as Record<string, any>);
      for (const admin of admins) {
        if (admin.email) {
          await sendNotificationEmail({ to: admin.email, subject: `New Order #${orderId.slice(0, 8)}`, title: 'New Order Placed', message: `Order of ${formatAmount(totalPaise)} placed for ${customerStore?.name || input.customerStoreId}. Payment: ${paymentMode === 'PAY_LATER' ? 'Khata' : 'Upfront'}` });
        }
      }
    }
  } catch (e) { console.error('[Order] Notification email failed:', e); }

  return { orderId, status: initialOrderStatus };
}

function formatAmount(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

// ─── Submit Order ────────────────────────────────────────────

export async function submitOrder(orderId: string, session: SessionData): Promise<OrderResult> {
  return transitionOrder(orderId, "SUBMITTED", session, null);
}

// ─── Approve Order (reserves inventory) ──────────────────────

export async function approveOrder(orderId: string, session: SessionData, notes?: string | null): Promise<OrderResult> {
  const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
  if (!orderSnap.exists()) throw new Error("Order not found");
  const order = orderSnap.val() as Order;

  if (order.status !== "SUBMITTED") {
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

  return transitionOrder(orderId, "APPROVED", session, notes);
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
    [`orders/${orderId}/statusHistory/${now}`]: statusChange,
    [`ordersByStore/${order.customerStoreId}/${orderId}/status`]: toStatus,
  };

  // Remove from old status index, add to new
  updates[`ordersByStatus/${fromStatus}/${orderId}`] = null;
  updates[`ordersByStatus/${toStatus}/${orderId}`] = {
    orderId,
    storeId: order.customerStoreId,
    createdAt: now,
  };

  await adminDb.ref().update(updates);

  return { orderId, status: toStatus };
}

// ─── Cancel Order (releases reservations) ────────────────────

export async function cancelOrder(orderId: string, session: SessionData, notes?: string | null): Promise<OrderResult> {
  const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
  if (!orderSnap.exists()) throw new Error("Order not found");
  const order = orderSnap.val() as Order;

  // Release reservations if order was approved/allocated
  if (["APPROVED", "ALLOCATED", "PICKING", "PACKED"].includes(order.status)) {
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
  if (["APPROVED", "ALLOCATED", "PICKING", "PACKED"].includes(order.status)) {
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

  // Receive inventory into customer store
  const itemsSnap = await adminDb.ref(`orders/${orderId}/items`).get();
  const items = itemsSnap.val() as Record<string, OrderItem> | null;

  if (items) {
    for (const item of Object.values(items)) {
      await receiveInventory({
        storeId: order.customerStoreId,
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
  PENDING_OWNER_APPROVAL: ["SUBMITTED", "CANCELLED", "REJECTED"],
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ALLOCATED", "CANCELLED", "REJECTED"],
  ALLOCATED: ["PICKING", "CANCELLED", "REJECTED"],
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

// ─── Get Orders By Store ─────────────────────────────────────

export async function getOrdersByStore(storeId: string): Promise<Order[]> {
  const snapshot = await adminDb.ref(`ordersByStore/${storeId}`).get();
  if (!snapshot.exists()) return [];
  const entries = snapshot.val() as Record<string, { orderId: string }>;
  const orders: Order[] = [];
  for (const entry of Object.values(entries)) {
    const order = await getOrder(entry.orderId);
    if (order) orders.push(order);
  }
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
