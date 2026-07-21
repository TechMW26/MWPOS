"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronRight, Loader2, PackageCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type QueueOrder = { id: string; status: string; totalPaise: number; createdAt: string; context?: { distributor?: { name?: string } }; distributorName?: string };

export function CfOrderQueue() {
  const [orders, setOrders] = useState<QueueOrder[]>([]); const [selected, setSelected] = useState<Set<string>>(new Set()); const [loading, setLoading] = useState(true); const [approving, setApproving] = useState(false); const [message, setMessage] = useState(""); const [showAll, setShowAll] = useState(false);
  async function load() { setLoading(true); const response = await fetch(`/api/orders?days=365&limit=250${showAll ? "" : "&status=PENDING_CF_APPROVAL"}`, { cache: "no-store" }); const payload = await response.json(); setOrders(Array.isArray(payload) ? payload : []); setSelected(new Set()); setLoading(false); }
  useEffect(() => { load().catch(() => setLoading(false)); }, [showAll]);
  const pending = useMemo(() => orders.filter((order) => order.status === "PENDING_CF_APPROVAL"), [orders]);
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function selectAll() { setSelected((current) => current.size === pending.length ? new Set() : new Set(pending.map((order) => order.id))); }
  async function approve() { setApproving(true); setMessage(""); const response = await fetch("/api/orders/bulk-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderIds: Array.from(selected) }) }); const payload = await response.json(); setApproving(false); setMessage(response.ok ? `${payload.approved} order${payload.approved === 1 ? "" : "s"} approved.` : payload.message || "Approval failed."); await load(); }
  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-3 px-1"><div><h2 className="text-xl font-bold">Order queue</h2><p className="text-sm text-muted-foreground">Approve one or many assigned orders</p></div><button type="button" onClick={() => load()} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button></div>
    <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1"><button type="button" onClick={() => setShowAll(false)} className={`h-10 rounded-xl text-sm font-bold ${!showAll ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Needs approval</button><button type="button" onClick={() => setShowAll(true)} className={`h-10 rounded-xl text-sm font-bold ${showAll ? "bg-white shadow-sm" : "text-muted-foreground"}`}>All orders</button></div>
    {!showAll && pending.length > 0 && <div className="sticky top-20 z-10 flex items-center gap-2 rounded-[1.25rem] border bg-white/95 p-2 shadow-lg backdrop-blur"><button type="button" onClick={selectAll} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold"><span className={`mr-2 flex h-5 w-5 items-center justify-center rounded border ${selected.size === pending.length ? "border-primary bg-primary text-white" : ""}`}>{selected.size === pending.length && <Check className="h-3.5 w-3.5" />}</span>Select all ({pending.length})</button><Button className="h-11 rounded-xl" disabled={selected.size === 0 || approving} onClick={approve}>{approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Approve {selected.size || ""}</Button></div>}
    {message && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">{message}</p>}
    {loading ? <div className="flex min-h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading orders</div> : orders.length === 0 ? <div className="rounded-[1.5rem] border bg-white p-10 text-center"><PackageCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500" /><p className="font-bold">Nothing waiting</p><p className="mt-1 text-sm text-muted-foreground">All assigned orders are handled.</p></div> : <div className="space-y-2">{orders.map((order) => {
      const canSelect = order.status === "PENDING_CF_APPROVAL"; const checked = selected.has(order.id); const name = order.context?.distributor?.name || order.distributorName || "Distributor";
      return <div key={order.id} className={`flex items-center gap-3 rounded-[1.4rem] border bg-white p-3 shadow-sm ${checked ? "border-primary ring-1 ring-primary" : ""}`}>{canSelect && <button type="button" onClick={() => toggle(order.id)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${checked ? "border-primary bg-primary text-white" : "bg-white"}`} aria-label={`${checked ? "Unselect" : "Select"} order ${order.id.slice(0, 8)}`}>{checked && <Check className="h-4 w-4" />}</button>}<Link href={`/cf/orders/${order.id}`} className="flex min-w-0 flex-1 items-center gap-3"><span className="min-w-0 flex-1"><span className="block truncate font-bold">{name}</span><span className="block text-xs text-muted-foreground">#{order.id.slice(0, 8)} · {order.status.replaceAll("_", " ")}</span><span className="mt-1 block text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></span><span className="text-sm font-black">{formatCurrency(order.totalPaise)}</span><ChevronRight className="h-4 w-4 text-slate-300" /></Link></div>;
    })}</div>}
  </div>;
}
