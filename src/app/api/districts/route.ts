import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { listDistricts, createDistrict } from "@/lib/services/district-service";
import { createDistrictSchema } from "@/lib/validation/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const districts = await listDistricts();
  return NextResponse.json(districts);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN", "ADMIN");

  try {
    const body = await request.json();
    const parsed = createDistrictSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const district = await createDistrict(parsed.data, session);
    return NextResponse.json(district, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
