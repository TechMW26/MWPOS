"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2, PackageCheck, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { DashboardPerformanceRow, DashboardResponse } from "@/types/dashboard";

export function MobilePerformance({ kind }: { kind: "clients" | "asms" }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  useEffect(() => { fetch("/api/dashboard?days=30", { cache: "no-store" }).then((response) => response.json()).then(setData).catch(() => setData(null)); }, []);
  if (!data) return <div className="flex min-h-48 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading live activity</div>;
  const rows = kind === "asms" ? data.asmPerformance : data.clientPerformance;
  return <div className="space-y-4"><div className="px-1"><h2 className="text-xl font-bold">{kind === "asms" ? "ASM performance" : "Distributor reports"}</h2><p className="text-sm text-muted-foreground">Live order activity for the last 30 days</p></div><div className="grid grid-cols-2 gap-2"><Summary icon={ShoppingBag} label="Orders" value={String(data.metrics.orders)} /><Summary icon={TrendingUp} label="Revenue" value={formatCurrency(data.metrics.orderValuePaise)} /></div><div className="space-y-2">{rows.map((row, index) => <PerformanceCard key={row.id} row={row} rank={index + 1} href={kind === "asms" ? `/cf/orders?asmId=${row.id}` : `/asm/orders?distributorId=${row.id}`} />)}{rows.length === 0 && <div className="rounded-[1.5rem] border bg-white p-10 text-center"><Users className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="font-bold">No activity yet</p><p className="mt-1 text-sm text-muted-foreground">Completed role activity will appear here.</p></div>}</div></div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string }) { return <div className="rounded-[1.4rem] border bg-white p-4"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="truncate text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-black">{value}</p></div>; }
function PerformanceCard({ row, rank, href }: { row: DashboardPerformanceRow; rank: number; href: string }) { return <Link href={href} className="block rounded-[1.45rem] border bg-white p-4 shadow-sm transition active:scale-[0.99]"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 font-black text-white">#{rank}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{row.name}</span><span className="block text-xs text-muted-foreground">{row.orders} orders · {formatCurrency(row.valuePaise)}</span></span><ChevronRight className="h-5 w-5 text-slate-300" /></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><SmallMetric label="Delivered" value={row.delivered} icon={PackageCheck} /><SmallMetric label="Pending" value={row.pending} /><SmallMetric label="Total" value={row.orders} /></div></Link>; }
function SmallMetric({ label, value }: { label: string; value: number; icon?: typeof PackageCheck }) { return <div className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-sm font-black">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>; }
