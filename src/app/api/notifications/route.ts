import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import type { Notification } from "@/types/models";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
  const snap = await adminDb.ref(`notifications/${session.uid}`).get();
  const notifications = snap.exists() ? Object.values(snap.val() as Record<string, Notification>) : [];
  notifications.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return NextResponse.json({
    notifications: notifications.slice(0, limit),
    unreadCount: notifications.filter((notification) => !notification.read).length,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean };
  const snap = await adminDb.ref(`notifications/${session.uid}`).get();
  const records = (snap.val() as Record<string, Notification> | null) || {};
  const ids = body.all ? Object.keys(records).filter((id) => !records[id]?.read) : body.id && records[body.id] ? [body.id] : [];
  if (!body.all && !body.id) return NextResponse.json({ message: "Notification id required" }, { status: 400 });
  const updates = Object.fromEntries(ids.map((id) => [`notifications/${session.uid}/${id}/read`, true]));
  if (ids.length) await adminDb.ref().update(updates);
  return NextResponse.json({ success: true, updated: ids.length });
}
