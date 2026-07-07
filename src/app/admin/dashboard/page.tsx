'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Package, ClipboardList, AlertTriangle, ArrowRight } from 'lucide-react';
import { DistributionDonut } from '@/components/dashboard/visuals';
import { CollapsibleSection, RevenueLineChart, OrderBarChart } from '@/components/dashboard/charts';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboard() {
  const [stores, setStores] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inv, setInv] = useState<any[]>([]);
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
        setStores(stores); setOrders(allOrders); setProducts(products); setInv(inv);
      } catch(e){} finally { setLoading(false); }
    }
    load();
  }, []);

  const visibleOrders = selectedStore === 'ALL' ? orders : orders.filter(o => o.customerStoreId === selectedStore);
  const revenue = visibleOrders.reduce((s,o)=>s+(o.totalPaise||0),0);
  const khataDue = visibleOrders.filter(o=>o.paymentMode==='PAY_LATER' && o.paymentStatus !== 'COMPLETED').reduce((s,o)=>s+(o.totalPaise||0),0);
  const lowStock = inv.filter((i:any) => i.available <= (i.reorderThreshold||10)).length;
  const pendingApprovals = visibleOrders.filter(o => o.status === 'PENDING_OWNER_APPROVAL').length;

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
    value: visibleOrders.filter(o => o.status === s).length,
    color: s === 'DELIVERED' ? '#16a34a' : s === 'PENDING_OWNER_APPROVAL' ? '#f59e0b' : '#2563eb',
  }));

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }]} />
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          <option value="ALL">All Stores</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Revenue Chart */}
      <CollapsibleSection title="Revenue Trend (7 days)" defaultOpen={true}>
        <RevenueLineChart data={revenueTrend} />
      </CollapsibleSection>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Pending Approvals', value: pendingApprovals, href: '/admin/orders', warn: pendingApprovals > 0 },
          { label: 'Khata Due', value: formatCurrency(khataDue), href: '/admin/reports/khata', warn: khataDue > 0 },
          { label: 'Low Stock', value: lowStock, href: '/admin/inventory', warn: lowStock > 0 },
          { label: 'Revenue', value: formatCurrency(revenue), href: '/admin/reports/khata' },
        ].map(card => (
          <Link key={card.label} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm hover:border-primary/30 transition-colors sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="text-xs text-muted-foreground">{card.label}</p><p className={`mt-1 truncate text-lg font-bold ${card.warn ? 'text-amber-600' : ''}`}>{card.value}</p></div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>

      {/* Order Status */}
      <CollapsibleSection title="Order Status" defaultOpen={true}>
        <OrderBarChart data={statusCounts} />
      </CollapsibleSection>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Stores" value={stores.length} icon={<Store className="h-4 w-4" />} />
        <StatCard title="Products" value={products.length} icon={<Package className="h-4 w-4" />} />
        <StatCard title="Orders" value={orders.length} icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DistributionDonut title="Payment Split" data={[
          { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
          { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
        ]} />
        <CollapsibleSection title="Summary" defaultOpen={true}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><strong>{formatCurrency(revenue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Avg Order</span><strong>{formatCurrency(orders.length ? revenue / orders.length : 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Khata Unpaid</span><strong className="text-destructive">{formatCurrency(khataDue)}</strong></div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
