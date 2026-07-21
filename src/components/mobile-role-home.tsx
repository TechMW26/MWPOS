"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  BasketIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ClipboardTextIcon,
  CrosshairIcon,
  PackageIcon,
  PresentationChartIcon,
  StorefrontIcon,
  ToteSimpleIcon,
  UserPlusIcon,
  type Icon,
} from "@phosphor-icons/react";
import { TargetProgress } from "@/components/target-progress";
import { formatCurrency } from "@/lib/utils";
import type { DashboardResponse } from "@/types/dashboard";

type MobileRole = "DISTRIBUTOR" | "ASM" | "C_AND_F";

const roleActions = {
  DISTRIBUTOR: [
    { label: "Buy products", detail: "Browse catalog & add quickly", href: "/storefront/marketplace", icon: StorefrontIcon, tone: "bg-blue-600" },
    { label: "Track orders", detail: "Approval and delivery status", href: "/storefront/orders", icon: ClipboardTextIcon, tone: "bg-violet-600" },
    { label: "Check stock", detail: "What is available now", href: "/storefront/inventory", icon: PackageIcon, tone: "bg-emerald-600" },
  ],
  ASM: [
    { label: "Place an order", detail: "Choose distributor and products", href: "/asm/pos", icon: BasketIcon, tone: "bg-blue-600" },
    { label: "Add distributor", detail: "Onboard a client in your area", href: "/asm/distributors?add=1", icon: UserPlusIcon, tone: "bg-emerald-600" },
    { label: "View target", detail: "Monthly revenue progress", href: "/asm/targets", icon: CrosshairIcon, tone: "bg-orange-500" },
  ],
  C_AND_F: [
    { label: "Approve orders", detail: "Review the pending queue", href: "/cf/orders", icon: CheckCircleIcon, tone: "bg-blue-600" },
    { label: "Place direct order", detail: "Create for a distributor", href: "/cf/place-order", icon: ToteSimpleIcon, tone: "bg-violet-600" },
    { label: "ASM performance", detail: "See assigned team activity", href: "/cf/asms", icon: PresentationChartIcon, tone: "bg-emerald-600" },
  ],
} satisfies Record<MobileRole, Array<{ label: string; detail: string; href: string; icon: Icon; tone: string }>>;

export function MobileRoleHome({ role }: { role: MobileRole }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard?days=30", { signal: controller.signal, cache: "no-store" }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Unable to load dashboard"); setData(payload); }).catch((loadError) => { if (loadError?.name !== "AbortError") setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard"); });
    return () => controller.abort();
  }, []);

  if (!data && !error) return <div className="flex min-h-[55vh] items-center justify-center text-muted-foreground"><CircleNotchIcon className="mr-2 h-5 w-5 animate-spin" weight="bold" />Loading your workspace</div>;
  if (!data) return <div className="rounded-[1.5rem] border bg-white p-8 text-center"><p className="font-bold">Dashboard unavailable</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>;
  const primaryNumber = role === "C_AND_F" ? data.metrics.pendingApprovals : role === "ASM" ? data.metrics.activeClients : data.metrics.orders;
  const primaryLabel = role === "C_AND_F" ? "Need approval" : role === "ASM" ? "Active distributors" : "Orders this month";

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-5 text-white shadow-xl">
      <p className="text-sm text-blue-100">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}</p>
      <h2 className="mt-0.5 truncate text-2xl font-black">{data.viewer.displayName}</h2>
      <div className="mt-5 flex items-end justify-between"><div><p className="text-4xl font-black">{primaryNumber}</p><p className="mt-1 text-sm text-blue-100">{primaryLabel}</p></div><div className="rounded-2xl bg-white/15 px-3 py-2 text-right backdrop-blur"><p className="text-xs text-blue-100">Order value</p><p className="font-bold">{formatCurrency(data.metrics.orderValuePaise)}</p></div></div>
    </section>

    {role === "ASM" && <TargetProgress compact />}

    <section><div className="mb-2 flex items-center justify-between px-1"><h3 className="font-bold">Quick actions</h3><span className="text-xs text-muted-foreground">Tap to start</span></div><div className="space-y-2">
      {roleActions[role].map((action) => <Link key={action.href} href={action.href} className="flex min-h-[76px] items-center gap-3 rounded-[1.4rem] border bg-white p-3 shadow-sm transition active:scale-[0.99]"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${action.tone}`}><action.icon className="h-6 w-6" weight="duotone" /></span><span className="min-w-0 flex-1"><span className="block font-bold">{action.label}</span><span className="block truncate text-sm text-muted-foreground">{action.detail}</span></span><CaretRightIcon className="h-5 w-5 text-slate-300" weight="bold" /></Link>)}
    </div></section>

    <section className="grid grid-cols-2 gap-2">
      <Metric label="Delivered" value={String(data.metrics.delivered)} />
      <Metric label={role === "DISTRIBUTOR" ? "Khata due" : "Avg. order"} value={formatCurrency(role === "DISTRIBUTOR" ? data.metrics.khataDuePaise : data.metrics.averageOrderPaise)} />
    </section>

    {role === "C_AND_F" && <section><div className="mb-2 flex items-center justify-between px-1"><h3 className="font-bold">ASM activity</h3><Link href="/cf/asms" className="flex items-center text-xs font-semibold text-primary">View all <ArrowRightIcon className="ml-1 h-3.5 w-3.5" weight="bold" /></Link></div><div className="overflow-hidden rounded-[1.5rem] border bg-white">{data.asmPerformance.slice(0, 4).map((asm, index) => <div key={asm.id} className={`flex items-center gap-3 p-4 ${index ? "border-t" : ""}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold">{asm.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{asm.name}</span><span className="text-xs text-muted-foreground">{asm.orders} orders · {asm.delivered} delivered</span></span><span className="text-sm font-bold">{formatCurrency(asm.valuePaise)}</span></div>)}{data.asmPerformance.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No assigned ASM activity this month.</p>}</div></section>}

    <section><div className="mb-2 flex items-center justify-between px-1"><h3 className="font-bold">Recent orders</h3><Link href={data.orderBasePath} className="flex items-center text-xs font-semibold text-primary">View all <ArrowRightIcon className="ml-1 h-3.5 w-3.5" weight="bold" /></Link></div><div className="overflow-hidden rounded-[1.5rem] border bg-white">{data.recentOrders.slice(0, 4).map((order, index) => <Link key={order.id} href={`${data.orderBasePath}/${order.id}`} className={`flex items-center gap-3 p-4 transition active:bg-slate-50 ${index ? "border-t" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ToteSimpleIcon className="h-5 w-5" weight="duotone" /></span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{order.distributorName}</span><span className="text-xs text-muted-foreground">#{order.id.slice(0, 8)} · {order.status.replaceAll("_", " ")}</span></span><span className="text-sm font-bold">{formatCurrency(order.totalPaise)}</span></Link>)}{data.recentOrders.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No orders yet. Start with a quick action above.</p>}</div></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-[1.35rem] border bg-white p-4"><p className="truncate text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-black">{value}</p></div>; }
