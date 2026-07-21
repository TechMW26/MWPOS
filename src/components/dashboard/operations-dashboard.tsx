"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, CheckCircle2, Clock3, IndianRupee, RefreshCw, Search, ShoppingCart, Store, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { CollapsibleSection, OrderBarChart, RevenueLineChart } from "@/components/dashboard/charts";
import { formatCurrency } from "@/lib/utils";
import type { DashboardResponse } from "@/types/dashboard";

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  DRAFT: "outline",
  PENDING_OTP: "warning",
  OTP_VERIFIED: "default",
  PENDING_CF_APPROVAL: "warning",
  CF_APPROVED: "success",
  ALLOCATED: "default",
  PICKING: "default",
  PACKED: "default",
  SHIPPED: "default",
  DELIVERED: "success",
  CANCELLED: "outline",
  REJECTED: "destructive",
  CF_REJECTED: "destructive",
};

function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OperationsDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState("30");
  const [distributorId, setDistributorId] = useState("");
  const [asmId, setAsmId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ days });
    if (distributorId) params.set("distributorId", distributorId);
    if (asmId) params.set("asmId", asmId);
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [days, distributorId, asmId, status, search]);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard?${queryString}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load dashboard");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(false), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => load(true), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="font-medium">{error}</p>
          <Button onClick={() => load(false)}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const showAsmMonitoring = ["SUPERADMIN", "ADMIN", "C_AND_F"].includes(data.viewer.role);
  const showClientMonitoring = data.viewer.role !== "DISTRIBUTOR";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">Operations cockpit</h2>
              <Badge variant="success">Live</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.scopeLabel} · Updated {new Date(data.generatedAt).toLocaleTimeString("en-IN")}
            </p>
          </div>
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing} className="w-full xl:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh data
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Period
            <select aria-label="Dashboard period" value={days} onChange={(event) => setDays(event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Distributor
            <select aria-label="Filter by distributor" value={distributorId} onChange={(event) => setDistributorId(event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground">
              <option value="">All distributors</option>
              {data.filters.distributors.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          {data.filters.asms.length > 0 && (
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              ASM
              <select aria-label="Filter by ASM" value={asmId} onChange={(event) => setAsmId(event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground">
                <option value="">All ASMs</option>
                {data.filters.asms.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          )}
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Status
            <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground">
              <option value="">All statuses</option>
              {data.filters.statuses.map((option) => <option key={option} value={option}>{readable(option)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Search
            <span className="flex h-10 items-center gap-2 rounded-md border bg-background px-3">
              <Search className="h-4 w-4" />
              <input aria-label="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, ASM, client…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
            </span>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">Refresh failed: {error}. Showing the most recent data.</p>}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard title="Order value" value={formatCurrency(data.metrics.orderValuePaise)} icon={<IndianRupee className="h-4 w-4" />} description={`${formatCurrency(data.metrics.averageOrderPaise)} average`} />
        <StatCard title="Orders" value={data.metrics.orders} icon={<ShoppingCart className="h-4 w-4" />} description={`${data.metrics.delivered} delivered`} />
        <StatCard title="Pending approvals" value={data.metrics.pendingApprovals} icon={<Clock3 className="h-4 w-4" />} description="OTP and C&F queue" trend={data.metrics.pendingApprovals ? "down" : "neutral"} />
        <StatCard title="Khata due" value={formatCurrency(data.metrics.khataDuePaise)} icon={<IndianRupee className="h-4 w-4" />} description="Outstanding pay-later" />
        <StatCard title="Fulfillment" value={`${data.metrics.fulfillmentRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} description={`${data.metrics.activeClients} active clients`} />
        <StatCard title="Low stock" value={data.metrics.lowStock} icon={<Boxes className="h-4 w-4" />} description={`${data.metrics.activeProducts} active products`} trend={data.metrics.lowStock ? "down" : "neutral"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <CollapsibleSection title="Order value trend" defaultOpen>
          <RevenueLineChart data={data.trend} />
        </CollapsibleSection>
        <CollapsibleSection title="Order pipeline" defaultOpen>
          {data.statusCounts.length ? <OrderBarChart data={data.statusCounts} /> : <p className="py-12 text-center text-sm text-muted-foreground">No orders match these filters.</p>}
        </CollapsibleSection>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Recent orders</CardTitle>
          <Link href={data.orderBasePath} className="text-sm font-medium text-primary hover:underline">View all orders</Link>
        </CardHeader>
        <CardContent>
          <DataTable data={data.recentOrders as unknown as Array<Record<string, unknown>>} columns={[
            { key: "id", header: "Order", render: (row) => <Link className="font-mono text-xs font-semibold text-primary hover:underline" href={`${data.orderBasePath}/${row.id}`}>#{String(row.id).slice(0, 8)}</Link> },
            { key: "distributorName", header: "Client" },
            { key: "asmName", header: "ASM / Source", render: (row) => <div><p className="font-medium">{String(row.asmName)}</p><p className="text-xs text-muted-foreground">Placed by {String(row.placedByName)}</p></div> },
            { key: "status", header: "Status", render: (row) => <Badge variant={statusVariant[String(row.status)] || "outline"}>{readable(String(row.status))}</Badge> },
            { key: "totalPaise", header: "Value", render: (row) => formatCurrency(Number(row.totalPaise) || 0) },
            { key: "createdAt", header: "Placed", render: (row) => new Date(String(row.createdAt)).toLocaleString("en-IN") },
            { key: "historyCount", header: "History", render: (row) => `${Number(row.historyCount) || 0} events` },
          ]} emptyMessage="No live orders match the selected filters." />
        </CardContent>
      </Card>

      {(showAsmMonitoring || showClientMonitoring) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {showAsmMonitoring && (
            <PerformanceCard title="ASM monitoring" icon={<Users className="h-5 w-5" />} rows={data.asmPerformance} empty="No ASM order activity in this period." />
          )}
          {showClientMonitoring && (
            <PerformanceCard title="Client monitoring" icon={<Store className="h-5 w-5" />} rows={data.clientPerformance} empty="No client order activity in this period." />
          )}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Approval and activity feed</CardTitle></CardHeader>
        <CardContent>
          {data.activity.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No history exists for the selected scope.</p> : (
            <ol className="space-y-0">
              {data.activity.map((item, index) => (
                <li key={`${item.kind}-${item.id}`} className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-5 last:pb-0">
                  {index < data.activity.length - 1 && <span className="absolute left-[0.59rem] top-4 h-full w-px bg-border" />}
                  <span className="relative mt-1 h-5 w-5 rounded-full border-4 border-card bg-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{readable(item.label)}</p><Badge variant="outline">{item.kind}</Badge></div>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.actorName} · {new Date(item.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceCard({ title, icon, rows, empty }: { title: string; icon: React.ReactNode; rows: DashboardResponse["asmPerformance"]; empty: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent>
        <DataTable data={rows.slice(0, 10) as unknown as Array<Record<string, unknown>>} columns={[
          { key: "name", header: "Name", render: (row) => <div><p className="font-medium">{String(row.name)}</p><p className="text-xs text-muted-foreground">Last: {row.lastOrderAt ? new Date(String(row.lastOrderAt)).toLocaleDateString("en-IN") : "—"}</p></div> },
          { key: "orders", header: "Orders" },
          { key: "pending", header: "Pending", render: (row) => <span className={Number(row.pending) > 0 ? "font-semibold text-amber-700" : ""}>{String(row.pending)}</span> },
          { key: "delivered", header: "Delivered" },
          { key: "valuePaise", header: "Value", render: (row) => formatCurrency(Number(row.valuePaise) || 0) },
        ]} emptyMessage={empty} />
      </CardContent>
    </Card>
  );
}
