'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DistributionDonut, MetricBarChart } from '@/components/dashboard/visuals';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { formatCurrency } from '@/lib/utils';
import { ArrowRight, ClipboardList, MapPin, Users } from 'lucide-react';

export default function ClientDashboard() {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [locationMsg, setLocationMsg] = useState('');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/distributors').then(r => r.json()).then((data) => {
      const list = Array.isArray(data) ? data : [];
      setDistributors(list);
      setSelectedDistributor(list[0]?.id ?? '');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedDistributor) return;
    fetch('/api/orders?distributorId=' + selectedDistributor).then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : []));
  }, [selectedDistributor]);

  function autoSelectByLocation() {
    if (!navigator.geolocation) {
      setLocationMsg('Geolocation is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationMsg('Location detected. Distributor auto-match will use saved coordinates once addresses are geocoded.'),
      () => setLocationMsg('Location permission denied. Select the distributor manually.')
    );
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (distributors.length === 0) return <div className="p-6"><Card className="p-4 text-center"><p className="text-muted-foreground">No distributors found. Contact your admin to get set up.</p></Card></div>;
  const revenue = orders.reduce((sum, order) => sum + (order.totalPaise || 0), 0);
  const khataDue = orders.filter(o=>o.paymentMode==='PAY_LATER').reduce((sum, order) => sum + (order.totalPaise || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'reports', label: 'Reports' }]} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select className="flex h-10 min-w-0 rounded-md border px-3 py-2 text-sm" value={selectedDistributor} onChange={e => setSelectedDistributor(e.target.value)}>
            {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
          { title: 'Distributors', value: distributors.length, href: '/storefront/profile' },
        ].map(card => (
          <Link key={card.title} href={card.href} className="rounded-lg border bg-card p-3 shadow-sm animate-in hover-lift sm:p-4">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground sm:text-sm">{card.title}</p><p className="mt-1 truncate text-lg font-bold sm:text-2xl">{card.value}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" /></div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard title="My Distributors" value={distributors.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Orders" value={orders.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard title="Purchase Value" value={formatCurrency(revenue)} icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DistributionDonut title="Payment Split" data={[
          { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
          { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
        ]} />
        <MetricBarChart title="Order Status" data={['PENDING_OTP','OTP_VERIFIED','CF_APPROVED','DELIVERED'].map(status => ({ label: status.replaceAll('_',' '), value: orders.filter(o=>o.status===status).length }))} />
      </div>
      </>}
      {tab === 'reports' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card><CardHeader><CardTitle>Purchase Report</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Average order value</span><strong>{formatCurrency(orders.length ? revenue / orders.length : 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Khata due</span><strong>{formatCurrency(khataDue)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Distributors</span><strong>{distributors.length}</strong></div>
          </CardContent></Card>
          <MetricBarChart title="Order Status" data={['PENDING_OTP','OTP_VERIFIED','CF_APPROVED','DELIVERED'].map(status => ({ label: status.replaceAll('_',' '), value: orders.filter(o=>o.status===status).length }))} />
          <DistributionDonut title="Payment Methods" data={[
            { label: 'Khata', value: orders.filter(o=>o.paymentMode==='PAY_LATER').length, color: '#f59e0b' },
            { label: 'Upfront', value: orders.filter(o=>o.paymentMode==='UPFRONT').length, color: '#2563eb' },
          ]} />
        </div>
      )}
      <Card><CardHeader><CardTitle>Distributor Locations</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Address geocoding can be added next to plot distributor density on a map.</CardContent></Card>
    </div>
  );
}
