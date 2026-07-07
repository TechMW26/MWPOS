import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAreasForCity } from "@/lib/indian-districts";

interface PostalOffice {
  Name?: string;
  District?: string;
  State?: string;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  if (!state || !city) return NextResponse.json([]);

  const localAreas = getAreasForCity(state, city);
  const areas = new Set(localAreas);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(city)}`, {
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const postOffices = (data?.[0]?.PostOffice || []) as PostalOffice[];
      for (const office of postOffices) {
        if (office.State !== state || office.District !== city || !office.Name) continue;
        areas.add(office.Name.replace(/\s+/g, " ").trim());
      }
    }
  } catch {
    // Local data and client fallback keep the form usable.
  }

  return NextResponse.json(Array.from(areas).sort());
}
