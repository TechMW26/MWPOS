import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { adminDb } from "@/lib/db/admin";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const snap = await adminDb.ref("systemSettings").once("value");
  return NextResponse.json(snap.val() || {});
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN");
  try {
    const body = await request.json();
    await adminDb.ref("systemSettings").update(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
