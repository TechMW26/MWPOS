'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  DRAFT:'outline', PENDING_OWNER_APPROVAL:'warning', SUBMITTED:'default', APPROVED:'warning', ALLOCATED:'warning', PICKING:'warning', PACKED:'warning', SHIPPED:'default', DELIVERED:'success', CANCELLED:'destructive', REJECTED:'destructive'
};
const allowedTransitions: Record<string, string[]> = {
  PENDING_OWNER_APPROVAL: ['SUBMITTED', 'REJECTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ALLOCATED', 'CANCELLED'], ALLOCATED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'], PACKED: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED'],
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch('/api/stores').then(r => r.json()).then(d => { const arr = Array.isArray(d) ? d : []; setStores(arr); if (arr.length) setSelectedStore(arr[0].id); }); }, []);
  async function loadOrders() { if (!selectedStore) return; setLoading(true); try { const res = await fetch('/api/orders?storeId='+selectedStore); const data = await res.json(); setOrders(Array.isArray(data) ? data : []); } catch(e){} finally { setLoading(false); } }
  useEffect(() => { loadOrders(); }, [selectedStore]);

  async function handleTransition(orderId: string, toStatus: string) {
    await fetch('/api/orders/transition', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ orderId, toStatus, idempotencyKey: crypto.randomUUID() }) });
    loadOrders();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Store:</label>
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-64" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
