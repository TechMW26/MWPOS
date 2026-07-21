import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/authorization";
import { listUsers, updateUserRole, updateApprovalStatus, createUser, findUserByPhone } from "@/lib/services/user-service";
import { updateUserSchema } from "@/lib/validation/schemas";
import { adminDb } from "@/lib/db/admin";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin-auth";
import type { User } from "@/types/models";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") as string | null;
  const approvalStatus = searchParams.get("approvalStatus") as string | null;
  let users = await listUsers({ role: role as never, approvalStatus: approvalStatus as never });
  if (session.role === "C_AND_F") {
    users = users.filter((user) => user.uid === session.uid || (user.role === "ASM" && user.cfId === session.uid));
  } else if (session.role === "ASM") {
    users = users.filter((user) => user.uid === session.uid || user.uid === session.cfId);
  } else if (session.role === "DISTRIBUTOR") {
    users = users.filter((user) => user.uid === session.uid);
  }
  return NextResponse.json(users.map(({ uid, email, phone, displayName, role, approvalStatus, isActive, districtId, locations, cfId, createdAt, lastLoginAt }) => ({ uid, email, phone, displayName, role, approvalStatus, isActive, districtId, locations, cfId, createdAt, lastLoginAt })));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN");

  try {
    const body = await request.json();
    const { email, phone, displayName, role, districtId, locations } = body;

    if (!phone) return NextResponse.json({ message: "Phone number required" }, { status: 400 });
    if (!role) return NextResponse.json({ message: "Role required" }, { status: 400 });

    const user = await createUser({
      email: email || null,
      phone,
      displayName: displayName || phone,
      role,
      districtId: districtId || null,
      locations: locations || undefined,
      createdByRole: session.role,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  requireRole(session, "SUPERADMIN");
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
    if (parsed.data.email !== undefined) {
      updates.email = parsed.data.email;
    }
    if (parsed.data.phone !== undefined) {
      if (!parsed.data.phone) throw new Error("Phone number cannot be removed");
      const phone = normalizePhoneNumber(parsed.data.phone);
      const duplicateUser = await findUserByPhone(phone);
      if (duplicateUser && duplicateUser.uid !== parsed.data.uid) {
        throw new Error("A user with this phone already exists");
      }

      const userSnap = await adminDb.ref(`users/${parsed.data.uid}`).get();
      if (!userSnap.exists()) throw new Error("User not found");
      const user = userSnap.val() as User;
      const firebaseAuth = getFirebaseAdminAuth();
      let firebaseUid = user.firebaseUid;
      if (firebaseUid) {
        await firebaseAuth.updateUser(firebaseUid, { phoneNumber: phone });
      } else {
        try {
          firebaseUid = (await firebaseAuth.getUserByPhoneNumber(phone)).uid;
        } catch (error) {
          const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
          if (code !== "auth/user-not-found") throw error;
          firebaseUid = (await firebaseAuth.createUser({ phoneNumber: phone, displayName: user.displayName })).uid;
        }
        updates.firebaseUid = firebaseUid;
      }
      updates.phone = phone;
    }
    if (parsed.data.districtId !== undefined) {
      updates.districtId = parsed.data.districtId;
    }
    if (parsed.data.cfId !== undefined) {
      updates.cfId = parsed.data.cfId;
    }
    if (parsed.data.avatarUrl !== undefined) {
      updates.avatarUrl = parsed.data.avatarUrl;
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

    const userSnap = await adminDb.ref(`users/${uid}`).get();
    const user = userSnap.exists() ? userSnap.val() as User : null;
    if (user?.firebaseUid) {
      await getFirebaseAdminAuth().deleteUser(user.firebaseUid);
    }
    await adminDb.ref(`users/${uid}`).remove();
    await adminDb.ref(`userStoreMemberships/${uid}`).remove();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
