'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, TrendingUp, TrendingDown, FileText, Printer, Send, Mail } from 'lucide-react';

interface KhataBookProps {
  role: 'SUPERADMIN' | 'ADMIN' | 'ASM' | 'C_AND_F' | 'DISTRIBUTOR' | 'STORE_MANAGER';
  managerDistributors?: string[];
}

export function KhataBook({ role, managerDistributors }: KhataBookProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const distRes = await fetch('/api/distributors');
        const distData = await distRes.json();
        const dList = Array.isArray(distData) ? distData : [];
        const filtered = managerDistributors ? dList.filter((d: any) => managerDistributors.includes(d.id)) : dList;
        setDistributors(filtered);

        // Fetch all orders in one call — orders API returns all orders for SUPERADMIN/ADMIN
        const orderRes = await fetch('/api/orders');
        const orderData = await orderRes.json();
        const allOrders = Array.isArray(orderData) ? orderData : [];

        // Filter to only orders belonging to visible distributors
        const visibleIds = new Set(filtered.map((d: any) => d.id));
        setOrders(allOrders.filter((o: any) => visibleIds.has(o.distributorId)));
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [role, managerDistributors]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (selectedDistributor !== 'ALL' && o.distributorId !== selectedDistributor) return false;
      if (paymentFilter === 'KHATA' && o.paymentMode !== 'PAY_LATER') return false;
      if (paymentFilter === 'UPFRONT' && o.paymentMode !== 'UPFRONT') return false;
      if (paymentFilter === 'PAID' && o.paymentStatus !== 'COMPLETED') return false;
      if (paymentFilter === 'UNPAID' && o.paymentStatus === 'COMPLETED') return false;
      if (dateFrom && new Date(o.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(o.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [orders, selectedDistributor, paymentFilter, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const khata = filtered.filter(o => o.paymentMode === 'PAY_LATER');
    const upfront = filtered.filter(o => o.paymentMode === 'UPFRONT');
    const paid = filtered.filter(o => o.paymentStatus === 'COMPLETED');
    return {
      totalRevenue: filtered.reduce((s, o) => s + (o.totalPaise || 0), 0),
      khataDue: khata.filter(o => o.paymentStatus !== 'COMPLETED').reduce((s, o) => s + (o.totalPaise || 0), 0),
      khataPaid: khata.filter(o => o.paymentStatus === 'COMPLETED').reduce((s, o) => s + (o.paidAmountPaise || 0), 0),
      upfrontRevenue: upfront.reduce((s, o) => s + (o.totalPaise || 0), 0),
      paidCount: paid.length,
      totalCount: filtered.length,
    };
  }, [filtered]);

  const storeWise = useMemo(() => {
    const map: Record<string, { name: string; total: number; khataDue: number; orders: number }> = {};
    filtered.forEach(o => {
      const sid = o.distributorId;
      if (!map[sid]) {
        const d = distributors.find(x => x.id === sid);
        map[sid] = { name: d?.name || sid, total: 0, khataDue: 0, orders: 0 };
      }
      map[sid].total += o.totalPaise || 0;
      map[sid].orders += 1;
      if (o.paymentMode === 'PAY_LATER' && o.paymentStatus !== 'COMPLETED') {
        map[sid].khataDue += o.totalPaise || 0;
      }
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d }));
  }, [filtered, distributors]);

  const whatsappUrl = (phone: string, text: string) =>
    `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  function printInvoice(order: any) {
    const dist = distributors.find(d => d.id === order.distributorId);
    const win = window.open('', '_blank', 'width=700,height=800');
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice ${order.id?.slice(0,8)}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto} h1{color:#2563eb} .row{display:flex;justify-content:space-between;margin:8px 0} .total{font-size:20px;font-weight:bold;margin-top:16px;border-top:2px solid #000;padding-top:8px} @media print{body{padding:20px}}</style></head><body>
      <h1>MW-POS Invoice</h1>
      <div class="row"><span>Order:</span><strong>#${order.id?.slice(0,8)}</strong></div>
      <div class="row"><span>Distributor:</span><strong>${dist?.name || order.distributorId}</strong></div>
      <div class="row"><span>Date:</span><strong>${new Date(order.createdAt).toLocaleDateString()}</strong></div>
      <div class="row"><span>Payment:</span><strong>${order.paymentMode === 'UPFRONT' ? 'Upfront' : 'Khata'}</strong></div>
      <div class="row"><span>Status:</span><strong>${order.status}</strong></div>
      <hr/>
      ${(order.items || []).map((item: any) => `
        <div class="row"><span>${item.productName || item.sku} x${item.quantity}</span><span>${formatCurrency(item.totalPaise || item.unitPricePaise * item.quantity)}</span></div>
      `).join('')}
      <div class="total row"><span>Total</span><span>${formatCurrency(order.totalPaise)}</span></div>
      <p style="margin-top:24px;color:#666">Thank you for your order!</p>
      <script>window.print()</script>
      </body></html>
    `);
  }

  function sendWhatsApp(order: any) {
    const dist = distributors.find(d => d.id === order.distributorId);
    const phone = dist?.phone || '';
    if (!phone) { alert('No phone number for this distributor'); return; }
    const text = `MW-POS Invoice #${order.id?.slice(0,8)}\nDistributor: ${dist?.name}\nAmount: ${formatCurrency(order.totalPaise)}\nDate: ${new Date(order.createdAt).toLocaleDateString()}\nPayment: ${order.paymentMode === 'UPFRONT' ? 'Upfront' : 'Khata'}\nStatus: ${order.status}`;
    window.open(whatsappUrl(phone, text), '_blank');
  }

  async function sendEmailReceipt(order: any) {
    const dist = distributors.find(d => d.id === order.distributorId);
    const email = dist?.email;
    if (!email) { alert('No email for this distributor'); return; }
    try {
      await fetch('/api/auth/request-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email', destination: email }),
      });
      alert('Receipt sent to ' + email);
    } catch { alert('Failed to send email'); }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading khata book...</div>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium block mb-1">Distributor</label>
          <select className="h-10 rounded-md border px-3 py-2 text-sm" value={selectedDistributor} onChange={e => setSelectedDistributor(e.target.value)}>
            <option value="ALL">All Distributors</option>
            {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Payment</label>
          <select className="h-10 rounded-md border px-3 py-2 text-sm" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="KHATA">Khata Only</option>
            <option value="UPFRONT">Upfront Only</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 w-40" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 w-40" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSelectedDistributor('ALL'); setPaymentFilter('ALL'); setDateFrom(''); setDateTo(''); }}>Clear</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Total Revenue" value={formatCurrency(totals.totalRevenue)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard title="Khata Due" value={formatCurrency(totals.khataDue)} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
        <StatCard title="Khata Paid" value={formatCurrency(totals.khataPaid)} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
        <StatCard title="Upfront" value={formatCurrency(totals.upfrontRevenue)} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      {/* Store-wise breakdown */}
      <Card>
        <CardHeader><CardTitle>Distributor-wise Breakdown</CardTitle></CardHeader>
        <CardContent>
          <DataTable data={storeWise} columns={[
            { key: 'name', header: 'Distributor' },
            { key: 'orders', header: 'Orders' },
            { key: 'total', header: 'Total', render: (r) => formatCurrency(r.total) },
            { key: 'khataDue', header: 'Khata Due', render: (r) => <span className={r.khataDue > 0 ? 'text-destructive font-medium' : ''}>{formatCurrency(r.khataDue)}</span> },
          ]} emptyMessage="No data for selected filters" />
        </CardContent>
      </Card>

      {/* Orders Ledger */}
      <Card>
        <CardHeader><CardTitle>Ledger ({filtered.length} entries)</CardTitle></CardHeader>
        <CardContent>
          <DataTable data={filtered.slice(0, 100)} columns={[
            { key: 'id', header: 'Order', render: (o) => <span className="font-mono text-xs">#{o.id?.slice(0,8)}</span> },
            { key: 'distributorId', header: 'Distributor', render: (o) => {
              const d = distributors.find(x => x.id === o.distributorId);
              return d?.name || o.distributorId?.slice(0,8);
            }},
            { key: 'createdAt', header: 'Date', render: (o) => new Date(o.createdAt).toLocaleDateString() },
            { key: 'totalPaise', header: 'Amount', render: (o) => formatCurrency(o.totalPaise) },
            { key: 'paymentMode', header: 'Type', render: (o) => <Badge variant={o.paymentMode === 'UPFRONT' ? 'default' : 'warning'}>{o.paymentMode === 'UPFRONT' ? 'Upfront' : 'Khata'}</Badge> },
            { key: 'paymentStatus', header: 'Pay Status', render: (o) => <Badge variant={o.paymentStatus === 'COMPLETED' ? 'success' : 'outline'}>{o.paymentStatus || 'PENDING'}</Badge> },
            { key: 'status', header: 'Order', render: (o) => <Badge variant="outline">{o.status}</Badge> },
            { key: 'actions', header: '', render: (o) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Print Invoice" onClick={() => printInvoice(o)}><Printer className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 px-1.5 text-green-600" title="Send WhatsApp" onClick={() => sendWhatsApp(o)}><Send className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Email Receipt" onClick={() => sendEmailReceipt(o)}><Mail className="h-3 w-3" /></Button>
              </div>
            )},
          ]} emptyMessage="No entries for selected filters" />
        </CardContent>
      </Card>
    </div>
  );
}
