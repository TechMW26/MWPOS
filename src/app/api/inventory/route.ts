import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDistributorAccess } from "@/lib/auth/authorization";
import { getStoreInventory } from "@/lib/services/inventory-service";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ message: "storeId required" }, { status: 400 });
  try { requireDistributorAccess(session, storeId); } catch { return NextResponse.json({ message: "Forbidden" }, { status: 403 }); }
  const inventory = await getStoreInventory(storeId);
  return NextResponse.json(Object.values(inventory));
}
