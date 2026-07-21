import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      uid: session.uid,
      email: session.email,
      phone: session.phone,
      displayName: session.displayName,
      role: session.role,
      approvalStatus: session.approvalStatus,
      districtId: session.districtId,
      locations: session.locations ?? [],
      cfId: session.cfId,
    },
  });
}
