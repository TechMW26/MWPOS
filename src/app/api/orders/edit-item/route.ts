import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import type { Distributor, Order, OrderItem } from "@/types/models";
import { writeAuditLog } from "@/lib/services/audit-service";
import { v4 as uuidv4 } from "uuid";
import { requiresDistributorReapproval } from "@/lib/orders/workflow";
import { sendOrderApprovalNotification } from "@/lib/notifications/order-notification";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // Only C&F can edit order quantities
  if (session.role !== "C_AND_F" && session.role !== "SUPERADMIN" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Only C&F/Admin can edit order quantities" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { orderId, skuId, newQuantity, reason } = body;

    if (!orderId || !skuId || newQuantity == null || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json({ message: "orderId, skuId, newQuantity, and reason are required" }, { status: 400 });
    }

    if (typeof newQuantity !== "number" || newQuantity < 1 || newQuantity > 100_000 || !Number.isInteger(newQuantity)) {
      return NextResponse.json({ message: "newQuantity must be an integer between 1 and 100,000" }, { status: 400 });
    }
    if (reason.trim().length > 500) {
      return NextResponse.json({ message: "Reason must be 500 characters or fewer" }, { status: 400 });
    }

    // Get the order
    const orderSnap = await adminDb.ref(`orders/${orderId}`).get();
    if (!orderSnap.exists()) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    const order = orderSnap.val() as Order;

    if (session.role === "C_AND_F" && order.cfId !== session.uid) {
      return NextResponse.json({ message: "This order is not assigned to your C&F account" }, { status: 403 });
    }

    const editableStatuses = ["PENDING_OTP", "OTP_VERIFIED", "PENDING_CF_APPROVAL"];
    if (!editableStatuses.includes(order.status)) {
      return NextResponse.json({ message: "Quantities can only be edited before C&F approval" }, { status: 400 });
    }
    if (session.role === "C_AND_F" && order.status !== "PENDING_CF_APPROVAL") {
      return NextResponse.json({ message: "C&F can only edit an order while it is awaiting C&F approval" }, { status: 400 });
    }
    if (order.paymentMode === "UPFRONT" && order.paymentStatus === "COMPLETED") {
      return NextResponse.json({ message: "A completed paid order cannot be repriced; cancel it and create a corrected order" }, { status: 409 });
    }

    // Find the item
    const itemsSnap = await adminDb.ref(`orders/${orderId}/items`).get();
    const items = itemsSnap.val() as Record<string, OrderItem> | null;
    if (!items) {
      return NextResponse.json({ message: "No items found on this order" }, { status: 404 });
    }

    // Find the item by skuId
    const itemEntry = Object.entries(items).find(([, item]) => item.skuId === skuId);
    if (!itemEntry) {
      return NextResponse.json({ message: "Item not found in this order" }, { status: 404 });
    }

    const [itemKey, item] = itemEntry;
    const oldQuantity = item.quantity;
    if (oldQuantity === newQuantity) {
      return NextResponse.json({ message: "Choose a quantity different from the current quantity" }, { status: 400 });
    }

    // Recalculate totals
    const newLineTotal = item.unitPricePaise * newQuantity;
    if (!Number.isSafeInteger(newLineTotal)) {
      return NextResponse.json({ message: "Quantity is too large" }, { status: 400 });
    }
    const newLineTax = Math.round(newLineTotal * item.taxRate / 100);

    const updatedItem: OrderItem = {
      ...item,
      quantity: newQuantity,
      taxPaise: newLineTax,
      totalPaise: newLineTotal,
    };

    // Recalculate order totals
    let newSubtotal = 0;
    let newTax = 0;
    const updatedItems: Record<string, OrderItem> = {};

    for (const [key, it] of Object.entries(items)) {
      if (key === itemKey) {
        updatedItems[key] = updatedItem;
        newSubtotal += newLineTotal;
        newTax += newLineTax;
      } else {
        updatedItems[key] = it;
        newSubtotal += it.unitPricePaise * it.quantity;
        newTax += it.taxPaise;
      }
    }

    const newTotal = newSubtotal + newTax;
    if (![newSubtotal, newTax, newTotal].every(Number.isSafeInteger)) {
      return NextResponse.json({ message: "Updated order total is too large" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const editHistoryId = uuidv4();
    const requiresReapproval = requiresDistributorReapproval(order);
    const nextStatus = requiresReapproval ? "PENDING_OTP" : order.status;

    const updates: Record<string, unknown> = {
      [`orders/${orderId}/items/${itemKey}`]: updatedItem,
      [`orders/${orderId}/subtotalPaise`]: newSubtotal,
      [`orders/${orderId}/taxPaise`]: newTax,
      [`orders/${orderId}/totalPaise`]: newTotal,
      [`orders/${orderId}/updatedAt`]: now,
      [`ordersByDistributor/${order.distributorId}/${orderId}/totalPaise`]: newTotal,
      [`orders/${orderId}/editHistory/${editHistoryId}`]: {
        editedBy: session.uid,
        editedByRole: session.role,
        skuId,
        oldQuantity,
        newQuantity,
        oldTotal: order.totalPaise,
        newTotal,
        reason: reason.trim(),
        distributorReapprovalRequired: requiresReapproval,
        editedAt: now,
      },
    };

    if (requiresReapproval) {
      const statusHistoryId = uuidv4();
      Object.assign(updates, {
        [`orders/${orderId}/status`]: nextStatus,
        [`orders/${orderId}/otpStatus`]: "PENDING",
        [`orders/${orderId}/otpRequestId`]: null,
        [`orders/${orderId}/otpExpiresAt`]: null,
        [`orders/${orderId}/otpChannel`]: null,
        [`orders/${orderId}/otpDestination`]: null,
        [`orders/${orderId}/otpVerifiedAt`]: null,
        [`orders/${orderId}/otpVerifiedBy`]: null,
        [`orders/${orderId}/cfApprovalStatus`]: order.cfId ? "PENDING" : "NOT_REQUIRED",
        [`orders/${orderId}/statusHistory/${statusHistoryId}`]: {
          from: order.status,
          to: nextStatus,
          changedBy: session.uid,
          changedAt: now,
          notes: "Order quantity changed after approval; fresh distributor Firebase OTP required",
        },
        [`ordersByDistributor/${order.distributorId}/${orderId}/status`]: nextStatus,
        [`ordersByStatus/${order.status}/${orderId}`]: null,
        [`ordersByStatus/${nextStatus}/${orderId}`]: {
          orderId,
          distributorId: order.distributorId,
          createdAt: order.createdAt,
        },
      });

      if (order.paymentMode === "PAY_LATER" && order.khataEntryId) {
        const ledgerPath = `khataLedger/${order.distributorId}/${order.khataEntryId}`;
        const [ledgerSnap, balanceSnap] = await Promise.all([
          adminDb.ref(ledgerPath).get(),
          adminDb.ref(`khataBalances/${order.distributorId}/balancePaise`).get(),
        ]);
        if (ledgerSnap.exists()) {
          const debitedAmount = Number(ledgerSnap.val()?.amountPaise);
          const currentBalance = Number(balanceSnap.val());
          if (!balanceSnap.exists() || !Number.isSafeInteger(debitedAmount) || !Number.isSafeInteger(currentBalance)) {
            return NextResponse.json({ message: "Khata balance data is invalid; order was not changed" }, { status: 409 });
          }
          updates[ledgerPath] = null;
          updates[`khataBalances/${order.distributorId}`] = {
            storeId: order.distributorId,
            balancePaise: currentBalance - debitedAmount,
            updatedAt: now,
          };
        }
      }
    }

    await adminDb.ref().update(updates);
    await writeAuditLog({
      actorId: session.uid,
      action: "ORDER_UPDATED",
      entityType: "ORDER",
      entityId: orderId,
      before: { skuId, quantity: oldQuantity, totalPaise: order.totalPaise },
      after: { skuId, quantity: newQuantity, totalPaise: newTotal, reason: reason.trim(), distributorReapprovalRequired: requiresReapproval },
    }).catch((auditError) => console.error("[EditItem] Audit log failed:", auditError));

    let notificationDelivery: { sent: boolean; devices: number } | undefined;
    if (requiresReapproval) {
      const distributorSnap = await adminDb.ref(`stores/${order.distributorId}`).get();
      if (distributorSnap.exists()) {
        notificationDelivery = await sendOrderApprovalNotification({
          orderId,
          distributor: distributorSnap.val() as Distributor,
          items: Object.values(updatedItems),
          totalPaise: newTotal,
        });
      }
    }

    return NextResponse.json({ success: true, newTotal, item: updatedItem, status: nextStatus, requiresDistributorApproval: requiresReapproval, notificationDelivery });
  } catch (error) {
    console.error("[EditItem] Failed:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
