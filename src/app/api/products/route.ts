import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import { createProductSchema, createSkuSchema } from "@/lib/validation/schemas";
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
