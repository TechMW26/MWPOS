'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  DRAFT:'outline', PENDING_OTP:'warning', OTP_VERIFIED:'default', PENDING_CF_APPROVAL:'warning', CF_APPROVED:'default', CF_REJECTED:'destructive', ALLOCATED:'warning', PICKING:'warning', PACKED:'warning', SHIPPED:'default', DELIVERED:'success', CANCELLED:'destructive', REJECTED:'destructive'
};

const allowedTransitions: Record<string, string[]> = {
  PENDING_OTP: ['CANCELLED'],
  OTP_VERIFIED: ['PENDING_CF_APPROVAL', 'CF_APPROVED', 'CANCELLED'],
  PENDING_CF_APPROVAL: ['CF_APPROVED', 'CF_REJECTED', 'CANCELLED'],
  CF_APPROVED: ['ALLOCATED', 'CANCELLED'],
  ALLOCATED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/distributors').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : [];
      setDistributors(list);
      if (list.length > 0) setSelectedDistributor(list[0].id);
      setLoading(list.length === 0 ? false : true);
    });
  }, []);

  async function loadOrders() {
    if (!selectedDistributor) return;
    setLoading(true);
    try { const res = await fetch('/api/orders?distributorId=' + selectedDistributor); const data = await res.json(); setOrders(Array.isArray(data) ? data : []); } catch(e){} finally { setLoading(false); }
  }
  useEffect(() => { loadOrders(); }, [selectedDistributor]);

  if (distributors.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <Card className="p-4 text-center"><p className="text-muted-foreground">No distributors found. Create distributors first from the Distributors page.</p></Card>
      </div>
    );
  }

  async function handleTransition(orderId: string, toStatus: string) {
    await fetch('/api/orders/transition', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ orderId, toStatus, idempotencyKey: crypto.randomUUID() }) });
    loadOrders();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Distributor:</label>
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-64" value={selectedDistributor} onChange={e => setSelectedDistributor(e.target.value)}>
          {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardHeader><CardTitle>Orders ({orders.length})</CardTitle></CardHeader><CardContent>
          <DataTable data={orders} columns={[
            { key: 'id', header: 'Order ID', render: (o) => <span className="font-mono text-xs">{o.id?.slice(0,8)}...</span> },
            { key: 'status', header: 'Status', render: (o) => <Badge variant={statusColors[o.status] || 'outline'}>{o.status}</Badge> },
            { key: 'totalPaise', header: 'Total', render: (o) => formatCurrency(o.totalPaise) },
            { key: 'paymentMode', header: 'Payment', render: (o) => <Badge variant={o.paymentMode === 'UPFRONT' ? 'default' : 'warning'}>{o.paymentMode === 'UPFRONT' ? 'Upfront' : 'Khata'}</Badge> },
            { key: 'paymentStatus', header: 'Pay Status', render: (o) => <Badge variant={o.paymentStatus === 'COMPLETED' ? 'success' : 'outline'}>{o.paymentStatus || '—'}</Badge> },
            { key: 'createdAt', header: 'Date', render: (o) => new Date(o.createdAt).toLocaleDateString() },
            { key: 'actions', header: 'Actions', render: (o) => {
              const transitions = allowedTransitions[o.status] || [];
              if (!transitions.length) return <span className="text-muted-foreground text-xs">Terminal</span>;
              return <div className="grid gap-1 sm:flex sm:flex-wrap">{transitions.map(t => (
                <Button className="w-full sm:w-auto" key={t} size="sm" variant={t === 'CANCELLED' || t === 'REJECTED' ? 'destructive' : 'outline'} onClick={() => handleTransition(o.id, t)}>{t}</Button>
              ))}</div>;
            }},
          ]} />
        </CardContent></Card>
      )}
    </div>
  );
}
