'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Package, ClipboardList, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DistributionDonut } from '@/components/dashboard/visuals';
import { CollapsibleSection, RevenueLineChart, OrderBarChart } from '@/components/dashboard/charts';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';

export default function ManagerDashboard() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const storeRes = await fetch('/api/stores?type=CUSTOMER').then(r => r.json());
        const storeList = Array.isArray(storeRes) ? storeRes : [];
        const activeStore = selectedStore || storeList[0]?.id || 'store-cust-001';
        const [prodRes, invRes, orderRes] = await Promise.all([
          fetch('/api/products').then(r => r.json()),
          fetch('/api/inventory?storeId='+activeStore).then(r => r.json()).catch(() => []),
          fetch('/api/orders?storeId='+activeStore).then(r => r.json()).catch(() => []),
        ]);
        setProducts(Array.isArray(prodRes) ? prodRes : []);
        setInventory(Array.isArray(invRes) ? invRes : []);
        setStores(storeList);
        if (!selectedStore && storeList[0]?.id) setSelectedStore(storeList[0].id);
        setOrders(Array.isArray(orderRes) ? orderRes : []);
      } catch(e){} finally { setLoading(false); }
    }
    load();
  }, [selectedStore]);

  const revenue = orders.reduce((s,o)=>s+(o.totalPaise||0),0);
  const khataDue = orders.filter(o=>o.paymentMode==='PAY_LATER' && o.paymentStatus !== 'COMPLETED').reduce((s,o)=>s+(o.totalPaise||0),0);
  const lowStock = inventory.filter((i:any)=>i.available<=(i.reorderThreshold||10)).length;
  const approvals = orders.filter(o=>o.status === 'PENDING_OWNER_APPROVAL').length;

  const revenueTrend = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days[d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })] = 0; }
    orders.forEach((o: any) => { const key = new Date(o.createdAt || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); if (key in days) days[key] = (days[key] || 0) + (o.totalPaise || 0) / 100; });
    return Object.entries(days).map(([label, value]) => ({ label, value }));
  }, [orders]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value="overview" onChange={()=>{}} tabs={[{ value: 'overview', label: 'Overview' }]} />
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <CollapsibleSection title="Revenue Trend (7 days)" defaultOpen={true}>
        <RevenueLineChart data={revenueTrend} />
      </CollapsibleSection>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Place Order', value: 'POS →', href: '/manager/pos' },
          { label: 'Approvals', value: approvals, href: '/manager/orders', warn: approvals > 0 },
          { label: 'Khata Due', value: formatCurrency(khataDue), href: '/manager/reports/khata', warn: khataDue > 0 },
          { label: 'Low Stock', value: lowStock, href: '/manager/inventory', warn: lowStock > 0 },
        ].map(card => (
          <Link key={card.label} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm hover:border-primary/30 transition-colors sm:p-4">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground">{card.label}</p><p className={`mt-1 truncate text-lg font-bold ${card.warn ? 'text-amber-600' : ''}`}>{card.value}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard title="Products" value={products.length} icon={<Package className="h-4 w-4"/>} />
        <StatCard title="Revenue" value={formatCurrency(revenue)} icon={<ClipboardList className="h-4 w-4"/>} />
        <StatCard title="Orders" value={orders.length} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DistributionDonut title="Payment Split" data={[
          { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
          { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
        ]} />
        <CollapsibleSection title="Summary" defaultOpen={true}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Avg Order</span><strong>{formatCurrency(orders.length ? revenue / orders.length : 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Khata Unpaid</span><strong className="text-destructive">{formatCurrency(khataDue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stock Units</span><strong>{inventory.reduce((s:number,i:any)=>s+(i.onHand||0),0)}</strong></div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
