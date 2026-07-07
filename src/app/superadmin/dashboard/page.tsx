'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Users, Store, Package, ClipboardList, ArrowRight, Shield } from 'lucide-react';
import { DistributionDonut } from '@/components/dashboard/visuals';
import { CollapsibleSection, RevenueLineChart, OrderBarChart } from '@/components/dashboard/charts';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { formatCurrency } from '@/lib/utils';

const actionLabels: Record<string, string> = {
  USER_CREATED: 'User Created', USER_UPDATED: 'User Updated', STORE_CREATED: 'Store Created',
  STORE_UPDATED: 'Store Updated', PRODUCT_CREATED: 'Product Created', PRODUCT_UPDATED: 'Product Updated',
  INVENTORY_MOVEMENT: 'Inventory Move', ORDER_CREATED: 'Order Created', ORDER_STATUS_CHANGE: 'Order Status',
  PAYMENT_RECORDED: 'Payment', ROLE_CHANGED: 'Role Change', APPROVAL_CHANGED: 'Approval', SETTINGS_CHANGED: 'Settings',
};

export default function SuperadminDashboard() {
  const [stats, setStats] = useState({ users: 0, stores: 0, products: 0, orders: 0, revenue: 0, khata: 0, upfront: 0, lowStock: 0, pendingManagers: 0 });
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, storesRes, productsRes, invRes, auditRes] = await Promise.all([
          fetch('/api/users').then(r => r.json()),
          fetch('/api/stores').then(r => r.json()),
          fetch('/api/products').then(r => r.json()),
          fetch('/api/inventory?storeId=store-dist-001').then(r => r.json()).catch(() => []),
          fetch('/api/audit-logs?limit=8').then(r => r.json()).catch(() => []),
        ]);
        const users = Array.isArray(usersRes) ? usersRes : [];
        const storeList = Array.isArray(storesRes) ? storesRes : [];
        const products = Array.isArray(productsRes) ? productsRes : [];
        const inventory = Array.isArray(invRes) ? invRes : [];
        const orderGroups = await Promise.all(storeList.map((store: any) => fetch('/api/orders?storeId=' + store.id).then(r => r.json()).catch(() => [])));
        const allOrders = orderGroups.flat().filter(Boolean);
        const revenue = allOrders.reduce((sum: number, order: any) => sum + (order.totalPaise || 0), 0);
        const khata = allOrders.filter((order: any) => order.paymentMode === 'PAY_LATER').reduce((sum: number, order: any) => sum + (order.totalPaise || 0), 0);
        const upfront = allOrders.filter((order: any) => order.paymentMode === 'UPFRONT').reduce((sum: number, order: any) => sum + (order.totalPaise || 0), 0);
        const lowStock = inventory.filter((i: any) => i.onHand <= (i.reorderThreshold || 10)).length;
        const pendingManagers = users.filter((u: any) => u.role === 'STORE_MANAGER' && u.approvalStatus === 'PENDING').length;
        setStores(storeList); setOrders(allOrders); setAuditLogs(Array.isArray(auditRes) ? auditRes : []);
        setStats({ users: users.length, stores: storeList.length, products: products.length, orders: allOrders.length, revenue, khata, upfront, lowStock, pendingManagers });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, []);

  const visibleOrders = selectedStore === 'ALL' ? orders : orders.filter((order: any) => order.customerStoreId === selectedStore);
  const revenue = visibleOrders.reduce((s: number, o: any) => s + (o.totalPaise || 0), 0);
  const khataDue = visibleOrders.filter((o: any) => o.paymentMode === 'PAY_LATER' && o.paymentStatus !== 'COMPLETED').reduce((s: number, o: any) => s + (o.totalPaise || 0), 0);

  const revenueTrend = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      days[key] = 0;
    }
    visibleOrders.forEach((o: any) => {
      const key = new Date(o.createdAt || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      if (key in days) days[key] = (days[key] || 0) + (o.totalPaise || 0) / 100;
    });
    return Object.entries(days).map(([label, value]) => ({ label, value }));
  }, [visibleOrders]);

  const statusCounts = ['PENDING_OWNER_APPROVAL', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'DELIVERED'].map(s => ({
    label: s.replace(/_/g, ' ').replace('PENDING OWNER', 'PENDING'),
    value: visibleOrders.filter((o: any) => o.status === s).length,
    color: s === 'DELIVERED' ? '#16a34a' : s === 'PENDING_OWNER_APPROVAL' ? '#f59e0b' : '#2563eb',
  }));

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'audit', label: 'Audit' }]} />
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          <option value="ALL">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {tab === 'overview' && <>
        <CollapsibleSection title="Revenue Trend (7 days)" defaultOpen={true}>
          <RevenueLineChart data={revenueTrend} />
        </CollapsibleSection>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Approve Managers', value: stats.pendingManagers, href: '/superadmin/store-managers', warn: stats.pendingManagers > 0 },
            { label: 'Khata Due', value: formatCurrency(khataDue), href: '/superadmin/reports/khata', warn: khataDue > 0 },
            { label: 'Low Stock SKUs', value: stats.lowStock, href: '/superadmin/inventory', warn: stats.lowStock > 0 },
            { label: 'Revenue', value: formatCurrency(revenue), href: '/superadmin/reports/khata' },
          ].map(card => (
            <Link key={card.label} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm hover:border-primary/30 transition-colors sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="text-xs text-muted-foreground">{card.label}</p><p className={`mt-1 truncate text-lg font-bold ${card.warn ? 'text-amber-600' : ''}`}>{card.value}</p></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <CollapsibleSection title="Order Status Distribution" defaultOpen={true}>
          <OrderBarChart data={statusCounts} />
        </CollapsibleSection>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <StatCard title="Total Users" value={stats.users} icon={<Users className="h-4 w-4" />} />
          <StatCard title="Stores" value={stats.stores} icon={<Store className="h-4 w-4" />} />
          <StatCard title="Products" value={stats.products} icon={<Package className="h-4 w-4" />} />
          <StatCard title="Orders" value={stats.orders} icon={<ClipboardList className="h-4 w-4" />} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DistributionDonut title="Store Types" data={[
            { label: 'Customer', value: stores.filter((s: any) => s.type === 'CUSTOMER').length, color: '#2563eb' },
            { label: 'Distribution', value: stores.filter((s: any) => s.type === 'DISTRIBUTION').length, color: '#16a34a' },
          ]} />
          <CollapsibleSection title="Quick Stats" defaultOpen={true}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><strong>{formatCurrency(revenue)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg Order</span><strong>{formatCurrency(visibleOrders.length ? revenue / visibleOrders.length : 0)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Khata Unpaid</span><strong className="text-destructive">{formatCurrency(khataDue)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pending Mgrs</span><strong>{stats.pendingManagers}</strong></div>
            </div>
          </CollapsibleSection>
        </div>
      </>}

      {tab === 'audit' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Recent Audit Activity</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={auditLogs} columns={[
              { key: 'action', header: 'Action', render: (l: any) => <Badge variant="outline">{actionLabels[l.action] || l.action}</Badge> },
              { key: 'entityType', header: 'Entity', render: (l: any) => String(l.entityType || '-') },
              { key: 'actorId', header: 'Actor', render: (l: any) => <span className="font-mono text-xs">{String(l.actorId || '').slice(0, 10)}</span> },
              { key: 'createdAt', header: 'Time', render: (l: any) => new Date(l.createdAt).toLocaleString() },
            ]} emptyMessage="No audit activity yet." />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
