import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { listStores } from "@/lib/services/store-service";

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
    if (mine) return store.ownerUid === session.uid || session.storeIds.includes(store.id) || session.distributorIds.includes(store.id);
    if (session.role === "ASM" && session.districtId) return store.districtId === session.districtId;
    return true;
  });

  return NextResponse.json({
    skus: skuSnap.exists() ? Object.values(skuSnap.val()) : [],
    products: productSnap.exists() ? Object.values(productSnap.val()) : [],
    stores: visibleStores,
  });
}
