import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { listStores, createStore } from "@/lib/services/store-service";
import { createStoreSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "DISTRIBUTION" | "CUSTOMER" | null;
  const mine = searchParams.get("mine") === "1";

  const stores = await listStores(type ?? undefined);
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

    const store = await createStore(parsed.data, session);
    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to create store" }, { status: 500 });
  }
}
