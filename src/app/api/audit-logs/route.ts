import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canViewAuditLogs } from "@/lib/auth/authorization";
import { getAuditLogs } from "@/lib/services/audit-service";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!canViewAuditLogs(session)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const action = searchParams.get("action") || undefined;
    const parsedLimit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 100;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
    const logs = await getAuditLogs({ entityType, action: action as never, limit });
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to load audit logs", error);
    return NextResponse.json([]);
  }
}
