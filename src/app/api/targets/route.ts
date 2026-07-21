import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/db/admin";
import type { Order, RevenueTarget, User } from "@/types/models";

const REVENUE_STATUSES = new Set(["CF_APPROVED", "APPROVED", "ALLOCATED", "PICKING", "PACKED", "SHIPPED", "DELIVERED"]);

function currentMonth() { return new Date().toISOString().slice(0, 7); }
function validMonth(value: string) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }

function withProgress(target: RevenueTarget, orders: Order[]) {
  const achievedPaise = orders.filter((order) => order.asmId === target.asmUid && order.createdAt.startsWith(target.month) && REVENUE_STATUSES.has(order.status))
    .reduce((sum, order) => sum + Math.max(0, order.totalPaise || 0), 0);
  return { ...target, achievedPaise, remainingPaise: Math.max(0, target.targetPaise - achievedPaise), progressPercent: target.targetPaise > 0 ? Math.min(100, Math.round((achievedPaise / target.targetPaise) * 100)) : 0 };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["ASM", "ADMIN", "SUPERADMIN", "C_AND_F"].includes(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const month = new URL(request.url).searchParams.get("month") || currentMonth();
  if (!validMonth(month)) return NextResponse.json({ message: "Invalid month" }, { status: 400 });
  const [targetsSnap, ordersSnap, usersSnap] = await Promise.all([adminDb.ref(`revenueTargets/${month}`).get(), adminDb.ref("orders").get(), adminDb.ref("users").get()]);
  const targets = Object.values((targetsSnap.val() as Record<string, RevenueTarget> | null) || {});
  const orders = Object.values((ordersSnap.val() as Record<string, Order> | null) || {});
  const users = (usersSnap.val() as Record<string, User> | null) || {};
  let visible = targets;
  if (session.role === "ASM") visible = targets.filter((target) => target.asmUid === session.uid);
  if (session.role === "C_AND_F") visible = targets.filter((target) => users[target.asmUid]?.cfId === session.uid);
  return NextResponse.json({ month, targets: visible.map((target) => ({ ...withProgress(target, orders), asmName: users[target.asmUid]?.displayName || "Unknown ASM" })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "SUPERADMIN"].includes(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { asmUid?: string; month?: string; targetRupees?: number } | null;
  const asmUid = body?.asmUid?.trim() || "";
  const month = body?.month || currentMonth();
  const targetRupees = Number(body?.targetRupees);
  if (!asmUid || !validMonth(month) || !Number.isFinite(targetRupees) || targetRupees <= 0 || targetRupees > 1_000_000_000) return NextResponse.json({ message: "ASM, valid month and positive target are required" }, { status: 400 });
  const userSnap = await adminDb.ref(`users/${asmUid}`).get();
  if (!userSnap.exists() || (userSnap.val() as User).role !== "ASM") return NextResponse.json({ message: "ASM not found" }, { status: 404 });
  const ref = adminDb.ref(`revenueTargets/${month}/${asmUid}`);
  const existing = await ref.get();
  const now = new Date().toISOString();
  const target: RevenueTarget = { id: `${month}_${asmUid}`, asmUid, month, targetPaise: Math.round(targetRupees * 100), createdBy: existing.exists() ? (existing.val() as RevenueTarget).createdBy : session.uid, createdAt: existing.exists() ? (existing.val() as RevenueTarget).createdAt : now, updatedAt: now };
  const notificationId = uuidv4();
  await adminDb.ref().update({
    [`revenueTargets/${month}/${asmUid}`]: target,
    [`notifications/${asmUid}/${notificationId}`]: { id: notificationId, uid: asmUid, title: "Monthly revenue target assigned", body: `Your ${new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} target is ₹${targetRupees.toLocaleString("en-IN")}.`, type: "INFO", read: false, link: "/asm/targets", createdAt: now },
  });
  return NextResponse.json(target, { status: existing.exists() ? 200 : 201 });
}
