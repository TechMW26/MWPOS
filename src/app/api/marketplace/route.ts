import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { territoryIds, territoryMatchesResource } from "@/lib/auth/authorization";
import { adminDb } from "@/lib/db/admin";
import { listStores, listStoresByDistricts, listStoresByIds } from "@/lib/services/store-service";
import type { Product, ProductSku, SessionData, Store, User } from "@/types/models";

async function marketplaceStores(
  session: SessionData,
  storeType: "DISTRIBUTION" | "DISTRIBUTOR",
  mine: boolean
): Promise<Store[]> {
  if (session.role === "DISTRIBUTOR") {
    return listStoresByIds(
      session.distributorIds.length ? session.distributorIds : session.storeIds,
      storeType
    );
  }
  if (session.role === "ASM") {
    return listStoresByDistricts(territoryIds(session), storeType);
  }
  if (session.role === "C_AND_F") {
    if (mine) return listStoresByIds(session.storeIds, storeType);
    const asmsSnap = await adminDb.ref("users").orderByChild("cfId").equalTo(session.uid).get();
    const asms = Object.values((asmsSnap.val() as Record<string, User> | null) ?? {})
      .filter((user) => user.role === "ASM" && user.isActive && user.approvalStatus === "APPROVED");
    return listStoresByDistricts(asms.flatMap((asm) => territoryIds(asm)), storeType);
  }
  return listStores(storeType);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeType = searchParams.get("storeType") === "DISTRIBUTION" ? "DISTRIBUTION" : "DISTRIBUTOR";
  const mine = searchParams.get("mine") === "1";

  const [skuSnap, productSnap, stores] = await Promise.all([
    adminDb.ref("productSkus").once("value"),
    adminDb.ref("products").once("value"),
    marketplaceStores(session, storeType, mine),
  ]);

  const visibleStores = stores.filter((store) => {
    if (!store.isActive || store.approvalStatus !== "APPROVED") return false;
    if (mine) return store.ownerUid === session.uid || session.storeIds.includes(store.id) || session.distributorIds.includes(store.id);
    if (session.role === "ASM") return territoryMatchesResource(session, store.districtId);
    return true;
  });

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
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}
