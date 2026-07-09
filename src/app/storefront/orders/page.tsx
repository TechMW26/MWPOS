'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  DRAFT:'outline', PENDING_OTP:'warning', OTP_VERIFIED:'default', PENDING_CF_APPROVAL:'warning', CF_APPROVED:'default', CF_REJECTED:'destructive', ALLOCATED:'warning', PICKING:'warning', PACKED:'warning', SHIPPED:'default', DELIVERED:'success', CANCELLED:'destructive', REJECTED:'destructive'
};

export default function StoreOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders?storeId=store-cust-001').then(r => r.json()).then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Orders ({orders.length})</CardTitle></CardHeader><CardContent>
        <DataTable data={orders} columns={[
          { key: 'id', header: 'Order ID', render: (o:any) => <Link href={`/storefront/orders/${o.id}`} className="font-mono text-xs text-primary hover:underline">{o.id?.slice(0,8)}...</Link> },
          { key: 'status', header: 'Status', render: (o:any) => <Badge variant={statusColors[o.status] || 'outline'}>{o.status}</Badge> },
          { key: 'totalPaise', header: 'Total', render: (o:any) => formatCurrency(o.totalPaise) },
          { key: 'paymentMode', header: 'Payment', render: (o:any) => <Badge variant={o.paymentMode === 'UPFRONT' ? 'default' : 'warning'}>{o.paymentMode === 'UPFRONT' ? 'Upfront' : 'Khata'}</Badge> },
          { key: 'paymentStatus', header: 'Pay Status', render: (o:any) => <Badge variant={o.paymentStatus === 'COMPLETED' ? 'success' : 'outline'}>{o.paymentStatus || '—'}</Badge> },
          { key: 'createdAt', header: 'Date', render: (o:any) => new Date(o.createdAt).toLocaleDateString() },
        ]} emptyMessage="No orders yet. Browse the catalog to place your first order." />
      </CardContent></Card>
    </div>
  );
}
