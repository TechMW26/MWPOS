import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { listStores, createStore, updateStore } from "@/lib/services/store-service";
import { createStoreSchema } from "@/lib/validation/schemas";
import { adminDb } from "@/lib/db/admin";
import type { UserDistributorMembership } from "@/types/models";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestedType = searchParams.get("type");
  const type = (requestedType === "CUSTOMER" ? "DISTRIBUTOR" : requestedType) as "DISTRIBUTION" | "DISTRIBUTOR" | null;
  const mine = searchParams.get("mine") === "1";

  let stores = await listStores(type ?? undefined);
  if (session.role === "ASM") {
    stores = stores.filter((store) => Boolean(session.districtId && store.districtId === session.districtId));
  } else if (session.role === "C_AND_F") {
    const usersSnap = await adminDb.ref("users").get();
    const users = (usersSnap.val() as Record<string, { role: string; cfId?: string | null; districtId?: string | null }> | null) || {};
    const districtIds = new Set(Object.values(users).filter((user) => user.role === "ASM" && user.cfId === session.uid).map((user) => user.districtId).filter(Boolean));
    stores = stores.filter((store) => store.ownerUid === session.uid || store.managerUid === session.uid || Boolean(store.districtId && districtIds.has(store.districtId)));
  } else if (session.role === "DISTRIBUTOR") {
    const ids = session.distributorIds.length ? session.distributorIds : session.storeIds;
    stores = stores.filter((store) => ids.includes(store.id) || store.ownerUid === session.uid);
  }
  if (mine) {
    return NextResponse.json(stores.filter((store) => store.ownerUid === session.uid || session.storeIds.includes(store.id)));
  }
  return NextResponse.json(stores);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createStoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const isAdmin = session.role === "SUPERADMIN" || session.role === "ADMIN";
    if (!isAdmin && !["ASM", "DISTRIBUTOR"].includes(session.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (!isAdmin && parsed.data.type !== "DISTRIBUTOR") {
      return NextResponse.json({ message: "Only administrators can create distribution warehouses" }, { status: 403 });
    }
    if (session.role === "ASM" && (!session.districtId || parsed.data.districtId !== session.districtId)) {
      return NextResponse.json({ message: "ASMs can only create distributors in their assigned district" }, { status: 403 });
    }

    const store = await createStore(session.role === "DISTRIBUTOR" ? { ...parsed.data, ownerUid: session.uid } : parsed.data, session);
    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to create store" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "ADMIN", "SUPERADMIN");

  try {
    const body = await request.json();
    const { storeId, ...updates } = body;

    if (!storeId) {
      return NextResponse.json({ message: "storeId required" }, { status: 400 });
    }

    // Validate approvalStatus if provided
    if (updates.approvalStatus && !["APPROVED", "REJECTED"].includes(updates.approvalStatus)) {
      return NextResponse.json({ message: "Invalid approvalStatus" }, { status: 400 });
    }

    // Clean allowed fields
    const allowed: Record<string, unknown> = {};
    const editableFields = ["name", "districtId", "address", "city", "state", "pincode", "phone", "email", "gstin", "ownerUid", "managerUid", "approvalStatus", "isActive"];
    for (const key of editableFields) {
      if (key in updates) allowed[key] = updates[key];
    }

    await updateStore(storeId, allowed, session);

    // Sync manager membership
    if (updates.managerUid !== undefined) {
      const storeSnap = await adminDb.ref("stores/" + storeId).once("value");
      const store = storeSnap.val() as { managerUid?: string | null };

      // Remove old manager membership
      const membersSnap = await adminDb.ref("storeMembers/" + storeId).once("value");
      if (membersSnap.exists()) {
        const members = membersSnap.val() as Record<string, { role: string }>;
        for (const [uid, m] of Object.entries(members)) {
          if (m.role === "MANAGER" && uid !== updates.managerUid) {
            await adminDb.ref("storeMembers/" + storeId + "/" + uid).remove();
            await adminDb.ref("userStoreMemberships/" + uid + "/" + storeId).remove();
          }
        }
      }

      // Add new manager membership
      if (updates.managerUid && typeof updates.managerUid === "string") {
        const now = new Date().toISOString();
        const membership = { uid: updates.managerUid, storeId, role: "MANAGER", joinedAt: now };
        await adminDb.ref("storeMembers/" + storeId + "/" + updates.managerUid).set(membership);
        await adminDb.ref("userStoreMemberships/" + updates.managerUid + "/" + storeId).set(membership);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN");

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");
    if (!storeId) return NextResponse.json({ message: "storeId required" }, { status: 400 });

    await adminDb.ref("stores/" + storeId).remove();
    await adminDb.ref("distributors/" + storeId).remove();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
