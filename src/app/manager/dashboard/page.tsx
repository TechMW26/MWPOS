'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Package, ClipboardList, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DistributionDonut, MetricBarChart } from '@/components/dashboard/visuals';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';

export default function ManagerDashboard() {
  const [stats, setStats] = useState({ products:0, inventory:0, lowStock:0 });
  const [inventory, setInventory] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('store-cust-001');
  const [tab, setTab] = useState('overview');
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
        const products = Array.isArray(prodRes) ? prodRes : [];
        const inv = Array.isArray(invRes) ? invRes : [];
        setStores(storeList);
        if (!selectedStore && storeList[0]?.id) setSelectedStore(storeList[0].id);
        setOrders(Array.isArray(orderRes) ? orderRes : []);
        setStats({ products: products.length, inventory: inv.reduce((s:number,i:any)=>s+i.onHand,0), lowStock: inv.filter((i:any)=>i.available<=(i.reorderThreshold||10)).length });
        setInventory(inv);
      } catch(e){} finally { setLoading(false); }
    }
    load();
  }, [selectedStore]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  const revenue = orders.reduce((s,o)=>s+(o.totalPaise||0),0);
  const khataDue = orders.filter(o=>o.paymentMode==='PAY_LATER').reduce((s,o)=>s+(o.totalPaise||0),0);
  const approvals = orders.filter(o=>o.status === 'PENDING_OWNER_APPROVAL').length;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'reports', label: 'Reports' }]} />
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
      </div>
      {tab === 'overview' && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          { title: 'Place order for store', value: selectedStore ? 'Order' : 'Select store', href: '/manager/pos' },
          { title: 'Owner approvals', value: approvals, href: '/manager/orders' },
          { title: 'Low stock to replenish', value: stats.lowStock, href: '/manager/inventory' },
        ].map(card => (
          <Link key={card.title} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm animate-in hover-lift sm:p-4">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground sm:text-sm">{card.title}</p><p className="mt-1 truncate text-lg font-bold sm:text-2xl">{card.value}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" /></div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard title="Products in Catalog" value={stats.products} icon={<Package className="h-5 w-5"/>} />
        <StatCard title="Total Stock" value={stats.inventory.toLocaleString()} icon={<ClipboardList className="h-5 w-5"/>} />
        <StatCard title="Low Stock SKUs" value={stats.lowStock} icon={<AlertTriangle className="h-5 w-5"/>} trend={stats.lowStock > 0 ? 'down' : 'neutral'} />
        <StatCard title="Store Revenue" value={formatCurrency(revenue)} icon={<ClipboardList className="h-5 w-5"/>} />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <DistributionDonut title="Payment Split" data={[
          { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
          { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
        ]} />
        <MetricBarChart title="Order Status" data={['PENDING_OWNER_APPROVAL','SUBMITTED','APPROVED','DELIVERED'].map(status => ({ label: status.replaceAll('_',' '), value: orders.filter(o=>o.status===status).length }))} />
      </div>
      </>}
      {tab === 'reports' && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Card><CardHeader><CardTitle>Store Performance</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Average order value</span><strong>{formatCurrency(orders.length ? revenue / orders.length : 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Khata due</span><strong>{formatCurrency(khataDue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Approvals waiting</span><strong>{approvals}</strong></div>
          </CardContent></Card>
          <MetricBarChart title="Inventory Health" data={[
            { label: 'Available SKUs', value: inventory.filter((i:any)=>i.available > (i.reorderThreshold||10)).length },
            { label: 'Low Stock SKUs', value: stats.lowStock },
            { label: 'Reserved Units', value: inventory.reduce((s:number,i:any)=>s+(i.reserved||0),0) },
          ]} />
          <DistributionDonut title="Payment Methods" data={[
            { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
            { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
          ]} />
        </div>
      )}
      <Card><CardHeader><CardTitle>Store Inventory</CardTitle></CardHeader><CardContent>
        <DataTable data={inventory.filter((i:any) => i.onHand > 0 || i.reserved > 0)} columns={[
          { key: 'skuId', header: 'SKU ID' }, { key: 'onHand', header: 'On Hand' }, { key: 'reserved', header: 'Reserved' }, { key: 'available', header: 'Available' },
          { key: 'status', header: 'Status', render: (i:any) => i.available <= (i.reorderThreshold||10) ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="success">OK</Badge> },
        ]} emptyMessage="No inventory data. Place an order to receive stock." />
      </CardContent></Card>
    </div>
  );
}
