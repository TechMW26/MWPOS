"use client";

import { useEffect, useState } from "react";
import { Flame, Loader2, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type TargetRow = { id: string; month: string; targetPaise: number; achievedPaise: number; remainingPaise: number; progressPercent: number; asmName?: string };

export function TargetProgress({ compact = false }: { compact?: boolean }) {
  const [row, setRow] = useState<TargetRow | null | undefined>(undefined);
  useEffect(() => { fetch("/api/targets", { cache: "no-store" }).then((response) => response.json()).then((payload) => setRow(Array.isArray(payload.targets) ? payload.targets[0] ?? null : null)).catch(() => setRow(null)); }, []);
  if (row === undefined) return <div className="flex min-h-32 items-center justify-center rounded-[1.5rem] border bg-white text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading target</div>;
  if (!row) return <div className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><Target className="mb-3 h-8 w-8 text-slate-300" /><p className="font-bold">No target assigned</p><p className="mt-1 text-sm text-muted-foreground">Your admin has not set a target for this month.</p></div>;
  return <div className={`overflow-hidden rounded-[1.65rem] bg-slate-950 text-white shadow-xl ${compact ? "p-4" : "p-5"}`}>
    <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Monthly target</p><p className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl"} font-black`}>{formatCurrency(row.achievedPaise)} <span className="text-sm font-medium text-slate-400">of {formatCurrency(row.targetPaise)}</span></p></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-slate-950"><Flame className="h-6 w-6" /></div></div>
    <div className="mt-4 h-5 overflow-hidden rounded-full bg-white/15 p-1" role="progressbar" aria-label="Monthly revenue target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.progressPercent}><div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-300 to-lime-300 transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(3, row.progressPercent)}%` }} /></div>
    <div className="mt-2 flex justify-between text-xs"><span className="font-bold text-amber-300">{row.progressPercent}% achieved</span><span className="text-slate-400">{formatCurrency(row.remainingPaise)} to go</span></div>
  </div>;
}
