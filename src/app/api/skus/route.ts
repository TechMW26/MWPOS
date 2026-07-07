import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { createSkuSchema } from "@/lib/validation/schemas";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const snap = await adminDb.ref("productSkus").once("value");
  if (!snap.exists()) return NextResponse.json([]);
  return NextResponse.json(Object.values(snap.val()));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = createSkuSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });

    // If id is provided, update existing SKU
    if (body.id && typeof body.id === "string") {
      const snap = await adminDb.ref("productSkus/" + body.id).once("value");
      if (!snap.exists()) return NextResponse.json({ message: "SKU not found" }, { status: 404 });
      const now = new Date().toISOString();
      const updated = { ...snap.val(), ...parsed.data, updatedAt: now };
      await adminDb.ref("productSkus/" + body.id).update(updated);
      return NextResponse.json(updated);
    }

    // Create new SKU
    const id = uuidv4();
    const now = new Date().toISOString();
    const sku = { id, ...parsed.data, barcode: parsed.data.barcode ?? null, hsnCode: parsed.data.hsnCode ?? null, weightGrams: parsed.data.weightGrams ?? null, isActive: true, createdAt: now, updatedAt: now };
    await adminDb.ref("productSkus/" + id).set(sku);
    return NextResponse.json(sku, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
