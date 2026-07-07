import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST() {
  // In production, you would also revoke Firebase refresh tokens here
  await clearSession();
  return NextResponse.json({ success: true });
}
