import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { districtMatchesTerritory } from "@/lib/auth/authorization";
import { adminDb } from "@/lib/db/admin";
import { listStores } from "@/lib/services/store-service";
import type { Product, ProductSku } from "@/types/models";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeType = searchParams.get("storeType") === "DISTRIBUTION" ? "DISTRIBUTION" : "DISTRIBUTOR";
  const mine = searchParams.get("mine") === "1";

  const [skuSnap, productSnap, stores] = await Promise.all([
    adminDb.ref("productSkus").once("value"),
    adminDb.ref("products").once("value"),
    listStores(storeType),
  ]);

  const visibleStores = stores.filter((store) => {
    if (!store.isActive || store.approvalStatus !== "APPROVED") return false;
    if (mine) return store.ownerUid === session.uid || session.storeIds.includes(store.id) || session.distributorIds.includes(store.id);
    if (session.role === "ASM") return districtMatchesTerritory(session.districtId, store.districtId);
    if (session.role === "C_AND_F") return false;
    return true;
  });

  if (session.role === "C_AND_F" && !mine) {
    const usersSnap = await adminDb.ref("users").get();
    const users = (usersSnap.val() as Record<string, { role?: string; cfId?: string | null; districtId?: string | null }> | null) || {};
    const districts = Object.values(users)
      .filter((user) => user.role === "ASM" && user.cfId === session.uid)
      .map((user) => user.districtId)
      .filter((districtId): districtId is string => Boolean(districtId));
    visibleStores.push(...stores.filter((store) =>
      store.isActive
      && store.approvalStatus === "APPROVED"
      && districts.some((districtId) => districtMatchesTerritory(districtId, store.districtId))
    ));
  }

  const products = productSnap.exists() ? Object.values(productSnap.val() as Record<string, Product>) : [];
  const activeProducts = products.filter((product) => product.isActive !== false);
  const activeProductIds = new Set(activeProducts.map((product) => product.id));
  const skus = skuSnap.exists() ? Object.values(skuSnap.val() as Record<string, ProductSku>) : [];
  const activeSkus = skus.filter((sku) => sku.isActive !== false && activeProductIds.has(sku.productId));
  const productIdsWithSkus = new Set(activeSkus.map((sku) => sku.productId));

  return NextResponse.json({
    skus: activeSkus,
    products: activeProducts.filter((product) => productIdsWithSkus.has(product.id)),
    stores: visibleStores,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
