import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { assignProductToStoreSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ message: "storeId required" }, { status: 400 });
  const snap = await adminDb.ref("storeCatalog/" + storeId).once("value");
  if (!snap.exists()) return NextResponse.json([]);
  const entries = snap.val();
  const productIds = Object.keys(entries).filter(k => entries[k].isAvailable);
  if (!productIds.length) return NextResponse.json([]);
  const productsSnap = await adminDb.ref("products").once("value");
  const allProducts = productsSnap.val() || {};
  const skusSnap = await adminDb.ref("productSkus").once("value");
  const allSkus = skusSnap.val() || {};
  const result = productIds.map(pid => {
    const product = allProducts[pid] || {};
    const skus = Object.values(allSkus).filter((s: any) => s.productId === pid);
    return { ...product, skus };
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = assignProductToStoreSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    const now = new Date().toISOString();
    await adminDb.ref("storeCatalog/" + parsed.data.storeId + "/" + parsed.data.productId).set({
      productId: parsed.data.productId, storeId: parsed.data.storeId, isAvailable: true, addedBy: session.uid, addedAt: now,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
