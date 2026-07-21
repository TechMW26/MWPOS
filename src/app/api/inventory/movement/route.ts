import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/authorization";
import { inventoryMovementSchema } from "@/lib/validation/schemas";
import { createInventoryMovement } from "@/lib/services/inventory-service";
import { canAccessStore } from "@/lib/auth/store-access";
import { writeAuditLog } from "@/lib/services/audit-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canManageInventory(session)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const parsed = inventoryMovementSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    if (!(await canAccessStore(session, parsed.data.storeId))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const result = await createInventoryMovement({ ...parsed.data, performedBy: session.uid });
    await writeAuditLog({
      actorId: session.uid,
      action: "INVENTORY_MOVEMENT",
      entityType: "INVENTORY",
      entityId: `${parsed.data.storeId}:${parsed.data.skuId}`,
      after: { movementId: result.movementId, movementType: parsed.data.movementType, quantity: parsed.data.quantity },
    }).catch((auditError) => console.error("[Inventory] Audit log failed:", auditError));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
