import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { listUsers, updateUserRole, updateApprovalStatus, createUser } from "@/lib/services/user-service";
import { updateUserSchema } from "@/lib/validation/schemas";
import { adminDb } from "@/lib/db/admin";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") as string | null;
  const approvalStatus = searchParams.get("approvalStatus") as string | null;
  const users = await listUsers({ role: role as never, approvalStatus: approvalStatus as never });
  return NextResponse.json(users.map(({ uid, email, phone, displayName, role, approvalStatus, isActive, createdAt, lastLoginAt }) => ({ uid, email, phone, displayName, role, approvalStatus, isActive, createdAt, lastLoginAt })));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN");

  try {
    const body = await request.json();
    const { email, phone, displayName, role } = body;

    if (!email && !phone) return NextResponse.json({ message: "Email or phone required" }, { status: 400 });
    if (!role) return NextResponse.json({ message: "Role required" }, { status: 400 });

    const user = await createUser({
      email: email || null,
      phone: phone || null,
      displayName: displayName || email || phone,
      role,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (parsed.data.role) {
      requireRole(session, "SUPERADMIN");
      await updateUserRole(parsed.data.uid, parsed.data.role, session);
    }
    if (parsed.data.approvalStatus) {
      requireRole(session, "SUPERADMIN");
      await updateApprovalStatus(parsed.data.uid, parsed.data.approvalStatus, session);
    }
    if (parsed.data.displayName) {
      updates.displayName = parsed.data.displayName;
    }
    if (parsed.data.isActive !== undefined) {
      updates.isActive = parsed.data.isActive;
    }

    if (Object.keys(updates).length > 1) {
      await adminDb.ref(`users/${parsed.data.uid}`).update(updates);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN");

  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ message: "User uid required" }, { status: 400 });
    if (uid === session.uid) return NextResponse.json({ message: "Cannot delete yourself" }, { status: 400 });

    await adminDb.ref(`users/${uid}`).remove();
    await adminDb.ref(`userStoreMemberships/${uid}`).remove();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
