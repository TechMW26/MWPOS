'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Package, ClipboardList, AlertTriangle, ArrowRight } from 'lucide-react';
import { DistributionDonut, MetricBarChart, MiniTrend } from '@/components/dashboard/visuals';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ stores:0, products:0, orders:0, lowStock:0 });
  const [stores, setStores] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [storesRes, productsRes, invRes] = await Promise.all([
          fetch('/api/stores?type=CUSTOMER').then(r => r.json()),
          fetch('/api/products').then(r => r.json()),
          fetch('/api/inventory?storeId=store-dist-001').then(r => r.json()).catch(() => []),
        ]);
        const stores = Array.isArray(storesRes) ? storesRes : [];
        const products = Array.isArray(productsRes) ? productsRes : [];
        const inv = Array.isArray(invRes) ? invRes : [];
        const orderGroups = await Promise.all(stores.map((store: any) => fetch('/api/orders?storeId=' + store.id).then(r => r.json()).catch(() => [])));
        const allOrders = orderGroups.flat().filter(Boolean);
        setStores(stores);
        setOrders(allOrders);
        setStats({ stores: stores.length, products: products.length, orders: allOrders.length, lowStock: inv.filter((i:any) => i.available <= (i.reorderThreshold||10)).length });
      } catch(e){} finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  const visibleOrders = selectedStore === 'ALL' ? orders : orders.filter(order => order.customerStoreId === selectedStore);
  const revenue = visibleOrders.reduce((s,o)=>s+(o.totalPaise||0),0);
  const khataDue = visibleOrders.filter(o=>o.paymentMode==='PAY_LATER').reduce((s,o)=>s+(o.totalPaise||0),0);
  const approvals = visibleOrders.filter(o=>o.status === 'PENDING_OWNER_APPROVAL').length;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'reports', label: 'Reports' }]} />
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          <option value="ALL">Cumulative metrics</option>
          {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
      </div>
      {tab === 'overview' && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          { title: 'Add customer store', value: stats.stores, href: '/admin/customer-stores' },
          { title: 'Review order queue', value: approvals, href: '/admin/orders' },
          { title: 'Fix low stock', value: stats.lowStock, href: '/admin/inventory' },
        ].map(card => (
          <Link key={card.title} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm animate-in hover-lift sm:p-4">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground sm:text-sm">{card.title}</p><p className="mt-1 truncate text-lg font-bold sm:text-2xl">{card.value}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" /></div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Customer Stores" value={stats.stores} icon={<Store className="h-5 w-5"/>} />
        <StatCard title="Products" value={stats.products} icon={<Package className="h-5 w-5"/>} />
        <StatCard title="Orders" value={visibleOrders.length} icon={<ClipboardList className="h-5 w-5"/>} />
        <StatCard title="Revenue" value={formatCurrency(revenue)} icon={<ClipboardList className="h-5 w-5"/>} />
        <StatCard title="Low Stock Alerts" value={stats.lowStock} icon={<AlertTriangle className="h-5 w-5"/>} trend={stats.lowStock > 0 ? 'down' : 'neutral'} />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <DistributionDonut title="Payment Split" data={[
          { label: 'Khata', value: visibleOrders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
          { label: 'Upfront', value: visibleOrders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
        ]} />
        <MetricBarChart title="Order Status" data={['PENDING_OWNER_APPROVAL','SUBMITTED','APPROVED','DELIVERED'].map(status => ({ label: status.replaceAll('_',' '), value: visibleOrders.filter(o=>o.status===status).length }))} />
        <MiniTrend title="Order Value Trend" data={visibleOrders.slice(0, 7).reverse().map((order, index) => ({ label: `#${index + 1}`, value: order.totalPaise || 0 }))} />
      </div>
      </>}
      {tab === 'reports' && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <MetricBarChart title="Store Density by Orders" data={stores.slice(0, 8).map(store => ({ label: store.name, value: orders.filter(order => order.customerStoreId === store.id).length }))} />
          <DistributionDonut title="Payment Methods" data={[
            { label: 'Khata', value: visibleOrders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
            { label: 'Upfront', value: visibleOrders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
          ]} />
          <Card><CardHeader><CardTitle>Admin Report</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Average order value</span><strong>{formatCurrency(visibleOrders.length ? revenue / visibleOrders.length : 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Khata due</span><strong>{formatCurrency(khataDue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Active stores</span><strong>{stores.filter((s:any) => s.isActive).length}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Order approvals</span><strong>{approvals}</strong></div>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
