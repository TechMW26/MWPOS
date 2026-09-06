import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { districtMatchesTerritory, requireRole, territoryIds } from "@/lib/auth/authorization";
import { adminDb } from "@/lib/db/admin";
import { listStores, listStoresByDistricts, listStoresByIds } from "@/lib/services/store-service";
import type { Distributor, User } from "@/types/models";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestedDistrictId = searchParams.get("districtId");
  const asmUid = searchParams.get("asmUid");
  let asm: Pick<User, "districtId" | "locations"> | null = session.role === "ASM" ? session : null;

  if (asmUid) {
    requireRole(session, "ADMIN", "SUPERADMIN");
    const asmSnap = await adminDb.ref(`users/${asmUid}`).get();
    if (!asmSnap.exists() || (asmSnap.val() as User).role !== "ASM") {
      return NextResponse.json({ message: "ASM not found" }, { status: 404 });
    }
    asm = asmSnap.val() as User;
  }

  let distributors: Distributor[];
  if (asm) {
    distributors = await listStoresByDistricts(territoryIds(asm), "DISTRIBUTOR") as Distributor[];
  } else if (session.role === "DISTRIBUTOR") {
    const ids = session.distributorIds.length ? session.distributorIds : session.storeIds;
    distributors = await listStoresByIds(ids, "DISTRIBUTOR") as Distributor[];
  } else if (session.role === "C_AND_F") {
    const [usersSnap, ordersSnap] = await Promise.all([
      adminDb.ref("users").orderByChild("cfId").equalTo(session.uid).get(),
      adminDb.ref("orders").orderByChild("cfId").equalTo(session.uid).get(),
    ]);
    const asms = Object.values((usersSnap.val() as Record<string, User> | null) || {})
      .filter((user) => user.role === "ASM");
    const orderDistributorIds = Array.from(new Set(
      Object.values((ordersSnap.val() as Record<string, { distributorId: string }> | null) || {})
        .map((order) => order.distributorId)
    ));
    const [territoryStores, orderedStores] = await Promise.all([
      listStoresByDistricts(asms.flatMap((user) => territoryIds(user)), "DISTRIBUTOR"),
      listStoresByIds(orderDistributorIds, "DISTRIBUTOR"),
    ]);
    distributors = Array.from(new Map([...territoryStores, ...orderedStores].map((store) => [store.id, store])).values()) as Distributor[];
  } else {
    distributors = await listStores("DISTRIBUTOR") as Distributor[];
  }
  distributors = distributors.filter((d) => d.isActive);

  if (requestedDistrictId) {
    distributors = distributors.filter((distributor) => districtMatchesTerritory(requestedDistrictId, distributor.districtId));
  }

  // Filter for specific distributor IDs
  if (session.role === "DISTRIBUTOR") {
    const ids = session.distributorIds.length ? session.distributorIds : session.storeIds;
    distributors = distributors.filter((d) => ids.includes(d.id));
  }

  return NextResponse.json(distributors);
}
