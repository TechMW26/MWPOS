import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import type { Distributor } from "@/types/models";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestedDistrictId = searchParams.get("districtId");
  const districtId = session.role === "ASM" && session.districtId ? session.districtId : requestedDistrictId;

  const snap = await adminDb.ref("stores").orderByChild("type").equalTo("DISTRIBUTOR").once("value");
  const all = (snap.val() as Record<string, Distributor> | null) || {};

  let distributors = Object.values(all).filter((d) => d.isActive);

  if (districtId) {
    distributors = distributors.filter((d) => d.districtId === districtId);
  }

  // Filter for specific distributor IDs
  if (session.role === "DISTRIBUTOR") {
    const ids = session.distributorIds.length ? session.distributorIds : session.storeIds;
    distributors = distributors.filter((d) => ids.includes(d.id));
  } else if (session.role === "C_AND_F") {
    const usersSnap = await adminDb.ref("users").get();
    const users = (usersSnap.val() as Record<string, { role: string; cfId?: string | null; districtId?: string | null }> | null) || {};
    const districtIds = new Set(Object.values(users).filter((user) => user.role === "ASM" && user.cfId === session.uid).map((user) => user.districtId).filter((id): id is string => Boolean(id)));
    const ordersSnap = await adminDb.ref("orders").orderByChild("cfId").equalTo(session.uid).get();
    const orderDistributorIds = new Set(Object.values((ordersSnap.val() as Record<string, { distributorId: string }> | null) || {}).map((order) => order.distributorId));
    distributors = distributors.filter((distributor) => districtIds.has(distributor.districtId) || orderDistributorIds.has(distributor.id));
  }

  return NextResponse.json(distributors);
}
