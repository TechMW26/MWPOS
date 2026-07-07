import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireStoreAccess, canManageInventory } from "@/lib/auth/authorization";
import { inventoryMovementSchema } from "@/lib/validation/schemas";
import { createInventoryMovement } from "@/lib/services/inventory-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canManageInventory(session)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const parsed = inventoryMovementSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    requireStoreAccess(session, parsed.data.storeId);
    const result = await createInventoryMovement({ ...parsed.data, performedBy: session.uid });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
