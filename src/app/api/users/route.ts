import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { listUsers, updateUserRole, updateApprovalStatus } from "@/lib/services/user-service";
import { updateUserSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") as string | null;
  const approvalStatus = searchParams.get("approvalStatus") as string | null;
  const users = await listUsers({ role: role as never, approvalStatus: approvalStatus as never });
  return NextResponse.json(users.map(({ uid, email, phone, displayName, role, approvalStatus, isActive, createdAt, lastLoginAt }) => ({ uid, email, phone, displayName, role, approvalStatus, isActive, createdAt, lastLoginAt })));
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    if (parsed.data.role) {
      requireRole(session, "SUPERADMIN");
      await updateUserRole(parsed.data.uid, parsed.data.role, session);
    }
    if (parsed.data.approvalStatus) {
      requireRole(session, "SUPERADMIN");
      await updateApprovalStatus(parsed.data.uid, parsed.data.approvalStatus, session);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
