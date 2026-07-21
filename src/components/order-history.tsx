"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING_OTP: "warning", OTP_VERIFIED: "default", PENDING_CF_APPROVAL: "warning", CF_APPROVED: "success",
  ALLOCATED: "default", PICKING: "default", PACKED: "default", SHIPPED: "default", DELIVERED: "success",
  CANCELLED: "outline", REJECTED: "destructive", CF_REJECTED: "destructive",
};

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OrderHistory({ basePath, newOrderHref }: { basePath: string; newOrderHref?: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState("90");
  const [status, setStatus] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [asmId, setAsmId] = useState("");
  const [search, setSearch] = useState("");

  const loadOrders = useCallback((refresh = false) => {
    if (refresh) setRefreshing(true);
    setError("");
    fetch("/api/orders?days=365&limit=250", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to load orders");
        setOrders(Array.isArray(payload) ? payload : []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load orders"))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const distributors = useMemo(() => Array.from(new Map(orders.map((order) => [order.distributorId, order.context?.distributor?.name || order.distributorId])).entries()), [orders]);
  const asms = useMemo(() => Array.from(new Map(orders.filter((order) => order.asmId).map((order) => [order.asmId, order.context?.asm?.name || order.asmId])).entries()), [orders]);
  const statuses = useMemo(() => Array.from(new Set(orders.map((order) => order.status))).sort(), [orders]);
  const filtered = useMemo(() => {
    const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (Date.parse(order.createdAt) < cutoff) return false;
      if (status && order.status !== status) return false;
      if (distributorId && order.distributorId !== distributorId) return false;
      if (asmId && order.asmId !== asmId) return false;
      if (!query) return true;
      return [order.id, order.context?.distributor?.name, order.context?.asm?.name, order.context?.placedBy?.name]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [orders, days, status, distributorId, asmId, search]);

  const totalPaise = filtered.reduce((sum, order) => sum + (order.totalPaise || 0), 0);
  const pending = filtered.filter((order) => ["PENDING_OTP", "PENDING_CF_APPROVAL"].includes(order.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Role-scoped order history with placement and approval attribution.</p>
          <p className="mt-1 text-sm font-medium">{filtered.length} orders · {formatCurrency(totalPaise)} · {pending} awaiting action</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => loadOrders(true)} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button>
          {newOrderHref && <Link href={newOrderHref} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Place order</Link>}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <select aria-label="Order history period" value={days} onChange={(event) => setDays(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
          </select>
          <select aria-label="Filter orders by distributor" value={distributorId} onChange={(event) => setDistributorId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All distributors</option>{distributors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select aria-label="Filter orders by ASM" value={asmId} onChange={(event) => setAsmId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All ASMs</option>{asms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select aria-label="Filter orders by status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3"><Search className="h-4 w-4" /><input aria-label="Search order history" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or user" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        </CardContent>
      </Card>

      {loading ? <p className="py-12 text-center text-muted-foreground">Loading live orders…</p> : error ? <Card className="border-destructive"><CardContent className="space-y-3 py-8 text-center text-destructive"><p>{error}</p><Button variant="outline" onClick={() => loadOrders(true)}>Try again</Button></CardContent></Card> : (
        <Card>
          <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
          <CardContent>
            <div className="hidden md:block"><DataTable data={filtered} columns={[
              { key: "id", header: "Order", render: (order: any) => <Link href={`${basePath}/${order.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">#{order.id.slice(0, 8)}</Link> },
              { key: "distributorId", header: "Client", render: (order: any) => order.context?.distributor?.name || order.distributorId },
              { key: "asmId", header: "Placed by / ASM", render: (order: any) => <div><p className="font-medium">{order.context?.placedBy?.name || "Unknown"}</p><p className="text-xs text-muted-foreground">ASM: {order.context?.asm?.name || "Direct order"}</p></div> },
              { key: "status", header: "Status", render: (order: any) => <Badge variant={statusVariant[order.status] || "outline"}>{label(order.status)}</Badge> },
              { key: "totalPaise", header: "Value", render: (order: any) => formatCurrency(order.totalPaise || 0) },
              { key: "paymentMode", header: "Payment", render: (order: any) => <div><p>{label(order.paymentMode)}</p><p className="text-xs text-muted-foreground">{label(order.paymentStatus || "PENDING")}</p></div> },
              { key: "createdAt", header: "Placed", render: (order: any) => new Date(order.createdAt).toLocaleString("en-IN") },
              { key: "timelineCount", header: "History", render: (order: any) => `${order.timelineCount || 0} events` },
            ]} emptyMessage="No orders match these filters." /></div>
            <div className="space-y-3 md:hidden">
              {filtered.map((order) => <Link key={order.id} href={`${basePath}/${order.id}`} className="block rounded-lg border p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{order.context?.distributor?.name || "Distributor"}</p><p className="mt-1 font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleDateString("en-IN")}</p></div><Badge variant={statusVariant[order.status] || "outline"}>{label(order.status)}</Badge></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Order value</p><p className="font-semibold">{formatCurrency(order.totalPaise || 0)}</p></div><div><p className="text-xs text-muted-foreground">Placed by</p><p className="truncate font-medium">{order.context?.placedBy?.name || "Unknown"}</p></div></div>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{label(order.paymentMode)} · {order.timelineCount || 0} updates</span><span className="inline-flex items-center gap-1 font-medium text-primary">View timeline <ArrowRight className="h-3.5 w-3.5" /></span></div>
              </Link>)}
              {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No orders match these filters.</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
