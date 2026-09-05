import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createDistrict, listDistricts, updateDistrict } from "@/lib/services/district-service";
import { createDistrictSchema, updateDistrictSchema } from "@/lib/validation/schemas";

function canManageDistricts(role: string): boolean {
  return role === "SUPERADMIN" || role === "ADMIN";
}

function sameDistrict(
  left: { name: string; city: string; state: string },
  right: { name: string; city: string; state: string }
): boolean {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("en-IN");
  return normalize(left.name) === normalize(right.name)
    && normalize(left.city) === normalize(right.city)
    && normalize(left.state) === normalize(right.state);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";
    const districts = await listDistricts(includeInactive && canManageDistricts(session.role));
    return NextResponse.json(districts);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load districts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canManageDistricts(session.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = createDistrictSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Please check the district details", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const duplicate = (await listDistricts(true)).find((district) => sameDistrict(district, parsed.data));
    if (duplicate) {
      return NextResponse.json({ message: "This district already exists" }, { status: 409 });
    }

    const district = await createDistrict(parsed.data, session);
    return NextResponse.json(district, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create district" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canManageDistricts(session.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = updateDistrictSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Please check the district details", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;
    const current = (await listDistricts(true)).find((district) => district.id === id);
    if (!current) return NextResponse.json({ message: "District not found" }, { status: 404 });

    const candidate = {
      name: updates.name ?? current.name,
      city: updates.city ?? current.city,
      state: updates.state ?? current.state,
    };
    const duplicate = (await listDistricts(true)).find(
      (district) => district.id !== id && sameDistrict(district, candidate)
    );
    if (duplicate) {
      return NextResponse.json({ message: "This district already exists" }, { status: 409 });
    }

    const district = await updateDistrict(id, updates, session);
    return NextResponse.json(district);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update district" },
      { status: 500 }
    );
  }
}
