import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDashboard } from "@/lib/services/dashboard-service";
import type { OrderStatus } from "@/types";

const ALLOWED_DAYS = new Set([7, 30, 90, 365]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const params = new URL(request.url).searchParams;
    const requestedDays = Number(params.get("days") || 30);
    const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 30;
    const data = await getDashboard(session, {
      days,
      distributorId: params.get("distributorId") || undefined,
      asmId: params.get("asmId") || undefined,
      status: (params.get("status") || undefined) as OrderStatus | undefined,
      search: params.get("search")?.slice(0, 100) || undefined,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Dashboard] Failed to load:", error);
    return NextResponse.json({ message: "Unable to load dashboard data" }, { status: 500 });
  }
}
