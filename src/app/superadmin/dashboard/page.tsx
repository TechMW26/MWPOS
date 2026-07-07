'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Users, Store, Package, ClipboardList, AlertTriangle, ArrowRight, Shield } from 'lucide-react';
import { DistributionDonut, MetricBarChart, MiniTrend } from '@/components/dashboard/visuals';
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
        const stores = Array.isArray(storesRes) ? storesRes : [];
        const products = Array.isArray(productsRes) ? productsRes : [];
        const inventory = Array.isArray(invRes) ? invRes : [];
        const orderGroups = await Promise.all(stores.map((store: any) => fetch('/api/orders?storeId=' + store.id).then(r => r.json()).catch(() => [])));
        const allOrders = orderGroups.flat().filter(Boolean);
        const revenue = allOrders.reduce((sum: number, order: any) => sum + (order.totalPaise || 0), 0);
        const khata = allOrders.filter((order: any) => order.paymentMode === 'PAY_LATER').reduce((sum: number, order: any) => sum + (order.totalPaise || 0), 0);
        const upfront = allOrders.filter((order: any) => order.paymentMode === 'UPFRONT').reduce((sum: number, order: any) => sum + (order.totalPaise || 0), 0);
        const lowStock = inventory.filter((i: any) => i.onHand <= (i.reorderThreshold || 10)).length;
        const pendingManagers = users.filter((u: any) => u.role === 'STORE_MANAGER' && u.approvalStatus === 'PENDING').length;

        setStores(stores);
        setOrders(allOrders);
        setAuditLogs(Array.isArray(auditRes) ? auditRes : []);
        setStats({ users: users.length, stores: stores.length, products: products.length, orders: allOrders.length, revenue, khata, upfront, lowStock, pendingManagers });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  const visibleOrders = selectedStore === 'ALL' ? orders : orders.filter((order) => order.customerStoreId === selectedStore);
  const customerStores = stores.filter((store) => store.type === 'CUSTOMER').length;
  const distributionStores = stores.filter((store) => store.type === 'DISTRIBUTION').length;
  const statusCounts = ['PENDING_OWNER_APPROVAL', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'DELIVERED'].map(status => ({ label: status.replaceAll('_', ' '), value: visibleOrders.filter(order => order.status === status).length }));
  const revenue = visibleOrders.reduce((s,o)=>s+(o.totalPaise||0),0);
  const khataDue = visibleOrders.filter(o=>o.paymentMode==='PAY_LATER').reduce((s,o)=>s+(o.totalPaise||0),0);
  const approvalQueue = visibleOrders.filter(o => o.status === 'PENDING_OWNER_APPROVAL').length;
  const actionCards = [
    { title: 'Approve managers', value: stats.pendingManagers, href: '/superadmin/store-managers', tone: stats.pendingManagers ? 'text-amber-700' : 'text-muted-foreground' },
    { title: 'Clear owner approvals', value: approvalQueue, href: '/superadmin/orders', tone: approvalQueue ? 'text-amber-700' : 'text-muted-foreground' },
    { title: 'Resolve low stock', value: stats.lowStock, href: '/superadmin/inventory', tone: stats.lowStock ? 'text-red-700' : 'text-muted-foreground' },
    { title: 'Collect Khata', value: formatCurrency(khataDue), href: '/superadmin/orders', tone: khataDue ? 'text-amber-700' : 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'reports', label: 'Reports' }, { value: 'audit', label: 'Audit' }]} />
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          <option value="ALL">Cumulative metrics</option>
          {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
      </div>
      {tab === 'overview' && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actionCards.map(card => (
          <Link key={card.title} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm animate-in hover-lift sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground sm:text-sm">{card.title}</p>
                <p className={`mt-1 truncate text-lg font-bold sm:text-2xl ${card.tone}`}>{card.value}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Total Users" value={stats.users} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Stores" value={stats.stores} icon={<Store className="h-5 w-5" />} />
        <StatCard title="Products" value={stats.products} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Revenue Booked" value={formatCurrency(revenue)} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard title="Khata Due" value={formatCurrency(khataDue)} />
        <StatCard title="Upfront Pending" value={formatCurrency(visibleOrders.filter(o=>o.paymentMode==='UPFRONT').reduce((s,o)=>s+(o.totalPaise||0),0))} />
        <StatCard title="Low Stock SKUs" value={stats.lowStock} icon={<AlertTriangle className="h-5 w-5" />} trend={stats.lowStock > 0 ? "down" : "neutral"} />
        <StatCard title="Pending Managers" value={stats.pendingManagers} icon={<ClipboardList className="h-5 w-5" />} trend={stats.pendingManagers > 0 ? "up" : "neutral"} description={stats.pendingManagers > 0 ? "Awaiting approval" : "All approved"} />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <DistributionDonut title="Store Distribution" data={[
          { label: 'Customer', value: customerStores, color: '#2563eb' },
          { label: 'Distribution', value: distributionStores, color: '#16a34a' },
        ]} />
        <MetricBarChart title="Order Status Volume" data={statusCounts} />
        <MiniTrend title="Recent Order Volume" data={visibleOrders.slice(0, 7).reverse().map((order, index) => ({ label: `#${index + 1}`, value: order.totalPaise || 0 }))} />
      </div>
      </>}
      {tab === 'reports' && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <DistributionDonut title="Payment Methods" data={[
            { label: 'Khata', value: visibleOrders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
            { label: 'Upfront', value: visibleOrders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
          ]} />
          <MetricBarChart title="Store Order Density" data={stores.slice(0, 8).map(store => ({ label: store.name, value: orders.filter(order => order.customerStoreId === store.id).length }))} />
          <Card><CardHeader><CardTitle>Sales Summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Booked revenue</span><strong>{formatCurrency(revenue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Average order value</span><strong>{formatCurrency(visibleOrders.length ? revenue / visibleOrders.length : 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Unpaid Khata</span><strong>{formatCurrency(khataDue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Approval queue</span><strong>{approvalQueue}</strong></div>
          </CardContent></Card>
        </div>
      )}
      {tab === 'audit' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Recent Audit Activity</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={auditLogs} columns={[
              { key: 'action', header: 'Action', render: (l:any) => <Badge variant="outline">{actionLabels[l.action] || l.action}</Badge> },
              { key: 'entityType', header: 'Entity', render: (l:any) => String(l.entityType || '-') },
              { key: 'actorId', header: 'Actor', render: (l:any) => <span className="font-mono text-xs">{String(l.actorId || '').slice(0, 10)}</span> },
              { key: 'createdAt', header: 'Time', render: (l:any) => new Date(l.createdAt).toLocaleString() },
            ]} emptyMessage="No audit activity yet." />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
