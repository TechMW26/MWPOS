'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DistributionDonut, MetricBarChart } from '@/components/dashboard/visuals';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { formatCurrency } from '@/lib/utils';
import { ArrowRight, ClipboardList, MapPin, Store } from 'lucide-react';

export default function ClientDashboard() {
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [locationMsg, setLocationMsg] = useState('');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stores?type=CUSTOMER&mine=1').then(r => r.json()).then((data) => {
      const list = Array.isArray(data) ? data : [];
      setStores(list);
      setSelectedStore(list[0]?.id ?? '');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedStore) return;
    fetch('/api/orders?storeId=' + selectedStore).then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : []));
  }, [selectedStore]);

  function autoSelectByLocation() {
    if (!navigator.geolocation) {
      setLocationMsg('Geolocation is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationMsg('Location detected. Store auto-match will use saved store coordinates once addresses are geocoded.'),
      () => setLocationMsg('Location permission denied. Select the store manually.')
    );
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  const revenue = orders.reduce((sum, order) => sum + (order.totalPaise || 0), 0);
  const khataDue = orders.filter(o=>o.paymentMode==='PAY_LATER').reduce((sum, order) => sum + (order.totalPaise || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'reports', label: 'Reports' }]} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select className="flex h-10 min-w-0 rounded-md border px-3 py-2 text-sm" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
            {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm" onClick={autoSelectByLocation}><MapPin className="h-4 w-4" />Auto</button>
        </div>
      </div>
      {locationMsg && <Card><CardContent className="py-3 text-sm text-muted-foreground">{locationMsg}</CardContent></Card>}
      {tab === 'overview' && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          { title: 'Order products', value: 'Catalog', href: '/storefront/catalog' },
          { title: 'Pay later balance', value: formatCurrency(khataDue), href: '/storefront/orders' },
          { title: 'Manage stores', value: stores.length, href: '/storefront/profile' },
        ].map(card => (
          <Link key={card.title} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm animate-in hover-lift sm:p-4">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground sm:text-sm">{card.title}</p><p className="mt-1 truncate text-lg font-bold sm:text-2xl">{card.value}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" /></div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard title="My Stores" value={stores.length} icon={<Store className="h-5 w-5" />} />
        <StatCard title="Orders" value={orders.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard title="Purchase Value" value={formatCurrency(revenue)} icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DistributionDonut title="Payment Split" data={[
          { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
          { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
        ]} />
        <MetricBarChart title="Order Status" data={['PENDING_OWNER_APPROVAL','SUBMITTED','APPROVED','DELIVERED'].map(status => ({ label: status.replaceAll('_',' '), value: orders.filter(o=>o.status===status).length }))} />
      </div>
      </>}
      {tab === 'reports' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card><CardHeader><CardTitle>Purchase Report</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Average order value</span><strong>{formatCurrency(orders.length ? revenue / orders.length : 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Khata due</span><strong>{formatCurrency(khataDue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stores managed</span><strong>{stores.length}</strong></div>
          </CardContent></Card>
          <MetricBarChart title="Order Status" data={['PENDING_OWNER_APPROVAL','SUBMITTED','APPROVED','DELIVERED'].map(status => ({ label: status.replaceAll('_',' '), value: orders.filter(o=>o.status===status).length }))} />
          <DistributionDonut title="Payment Methods" data={[
            { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
            { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
          ]} />
        </div>
      )}
      <Card><CardHeader><CardTitle>Store Density</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Address geocoding can be added next to plot store density on a map. Current release stores delivery addresses and supports browser location for current-store selection.</CardContent></Card>
    </div>
  );
}
