import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { createProductSchema } from "@/lib/validation/schemas";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const snap = await adminDb.ref("products").once("value");
  if (!snap.exists()) return NextResponse.json([]);
  return NextResponse.json(Object.values(snap.val()));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    const id = uuidv4();
    const now = new Date().toISOString();
    const product = { id, ...parsed.data, imageUrl: parsed.data.imageUrl ?? null, isActive: true, createdAt: now, updatedAt: now };
    await adminDb.ref("products/" + id).set(product);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id || typeof id !== "string") return NextResponse.json({ message: "Product id required" }, { status: 400 });
    const parsed = createProductSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });

    const snap = await adminDb.ref("products/" + id).once("value");
    if (!snap.exists()) return NextResponse.json({ message: "Product not found" }, { status: 404 });

    const now = new Date().toISOString();
    const updated = { ...snap.val(), ...parsed.data, imageUrl: parsed.data.imageUrl ?? snap.val().imageUrl ?? null, updatedAt: now };
    await adminDb.ref("products/" + id).update(updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
