import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { districtMatchesTerritory, requireRole, territoryMatchesResource } from "@/lib/auth/authorization";
import { adminDb } from "@/lib/db/admin";
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

  const snap = await adminDb.ref("stores").orderByChild("type").equalTo("DISTRIBUTOR").once("value");
  const all = (snap.val() as Record<string, Distributor> | null) || {};

  let distributors = Object.values(all).filter((d) => d.isActive);

  if (asm) {
    distributors = distributors.filter((distributor) => territoryMatchesResource(asm, distributor.districtId));
  } else if (requestedDistrictId) {
    distributors = distributors.filter((distributor) => districtMatchesTerritory(requestedDistrictId, distributor.districtId));
  }

  // Filter for specific distributor IDs
  if (session.role === "DISTRIBUTOR") {
    const ids = session.distributorIds.length ? session.distributorIds : session.storeIds;
    distributors = distributors.filter((d) => ids.includes(d.id));
  } else if (session.role === "C_AND_F") {
    const usersSnap = await adminDb.ref("users").get();
    const users = (usersSnap.val() as Record<string, User> | null) || {};
    const asms = Object.values(users).filter((user) => user.role === "ASM" && user.cfId === session.uid);
    const ordersSnap = await adminDb.ref("orders").orderByChild("cfId").equalTo(session.uid).get();
    const orderDistributorIds = new Set(Object.values((ordersSnap.val() as Record<string, { distributorId: string }> | null) || {}).map((order) => order.distributorId));
    distributors = distributors.filter((distributor) => asms.some((asm) => territoryMatchesResource(asm, distributor.districtId)) || orderDistributorIds.has(distributor.id));
  }

  return NextResponse.json(distributors);
}
