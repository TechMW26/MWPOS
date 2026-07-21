import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import type { Order, OrderItem } from "@/types/models";
import { writeAuditLog } from "@/lib/services/audit-service";
import { v4 as uuidv4 } from "uuid";

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

    if (!orderId || !skuId || !newQuantity || !reason) {
      return NextResponse.json({ message: "orderId, skuId, newQuantity, and reason are required" }, { status: 400 });
    }

    if (typeof newQuantity !== "number" || newQuantity < 1 || !Number.isInteger(newQuantity)) {
      return NextResponse.json({ message: "newQuantity must be a positive integer" }, { status: 400 });
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

    // Cannot edit delivered/cancelled/rejected orders
    if (["DELIVERED", "CANCELLED", "REJECTED", "CF_REJECTED"].includes(order.status)) {
      return NextResponse.json({ message: "Cannot edit quantities on a finalized order" }, { status: 400 });
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

    // Recalculate totals
    const newLineTotal = item.unitPricePaise * newQuantity;
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
    const now = new Date().toISOString();
    const editHistoryId = uuidv4();

    const updates: Record<string, unknown> = {
      [`orders/${orderId}/items/${itemKey}`]: updatedItem,
      [`orders/${orderId}/subtotalPaise`]: newSubtotal,
      [`orders/${orderId}/taxPaise`]: newTax,
      [`orders/${orderId}/totalPaise`]: newTotal,
      [`orders/${orderId}/updatedAt`]: now,
      [`orders/${orderId}/editHistory/${editHistoryId}`]: {
        editedBy: session.uid,
        editedByRole: session.role,
        skuId,
        oldQuantity,
        newQuantity,
        oldTotal: order.totalPaise,
        newTotal,
        reason,
        editedAt: now,
      },
    };

    await adminDb.ref().update(updates);
    await writeAuditLog({
      actorId: session.uid,
      action: "ORDER_UPDATED",
      entityType: "ORDER",
      entityId: orderId,
      before: { skuId, quantity: oldQuantity, totalPaise: order.totalPaise },
      after: { skuId, quantity: newQuantity, totalPaise: newTotal, reason },
    }).catch((auditError) => console.error("[EditItem] Audit log failed:", auditError));

    return NextResponse.json({ success: true, newTotal, item: updatedItem });
  } catch (error) {
    console.error("[EditItem] Failed:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
