'use client';

import { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Package, AlertTriangle, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/distributors').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([d, p, u]) => {
      const dList = Array.isArray(d) ? d : [];
      setDistributors(dList);
      setProducts(Array.isArray(p) ? p : []);
      setUsers(Array.isArray(u) ? u : []);
      if (dList.length > 0) setSelectedDistributor(dList[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedDistributor) {
      fetch('/api/inventory?storeId=' + selectedDistributor).then(r => r.json()).then(d => setInventory(Array.isArray(d) ? d : []));
    }
  }, [selectedDistributor]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-muted-foreground">Loading reports...</span>
    </div>
  );

  if (distributors.length === 0) return (
    <div className="space-y-6">
      <Card className="p-4 text-center"><p className="text-muted-foreground">No distributors found. Create distributors first to view reports.</p></Card>
    </div>
  );

  const totalStock = inventory.reduce((s: number, i: any) => s + i.onHand, 0);
  const totalReserved = inventory.reduce((s: number, i: any) => s + i.reserved, 0);
  const lowStock = inventory.filter((i: any) => i.onHand > 0 && i.available <= (i.reorderThreshold || 10));
  const admins = users.filter(u => u.role === 'ADMIN');
  const asms = users.filter(u => u.role === 'ASM');
  const pendingAsms = asms.filter(u => u.approvalStatus === 'PENDING');

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Distributors" value={distributors.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Total Products" value={products.length} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Total Users" value={users.length} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="ASMs" value={asms.length} icon={<ShoppingCart className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Active Admins" value={admins.length} />
        <StatCard title="ASMs" value={asms.length} />
        <StatCard title="Pending Approvals" value={pendingAsms.length} trend={pendingAsms.length > 0 ? 'down' : 'neutral'}
          description={pendingAsms.length > 0 ? `${pendingAsms.length} awaiting approval` : 'All approved'} />
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Distributor:</label>
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-64" value={selectedDistributor} onChange={e => setSelectedDistributor(e.target.value)}>
          {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Stock" value={totalStock.toLocaleString()} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Reserved" value={totalReserved.toLocaleString()} icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard title="Low Stock SKUs" value={lowStock.length} icon={<AlertTriangle className="h-5 w-5" />}
          trend={lowStock.length > 0 ? 'down' : 'neutral'} />
      </div>

      {lowStock.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader><CardTitle className="text-destructive">Low Stock Alert ({lowStock.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={lowStock} columns={[
              { key: 'skuId', header: 'SKU' },
              { key: 'onHand', header: 'On Hand' },
              { key: 'available', header: 'Available' },
              { key: 'reorderThreshold', header: 'Reorder At' },
              { key: 'status', header: 'Action', render: () => <Badge variant="destructive">Reorder Needed</Badge> },
            ]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
