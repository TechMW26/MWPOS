'use client';

import { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Store, Package, AlertTriangle, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('store-dist-001');

  useEffect(() => {
    Promise.all([
      fetch('/api/stores').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/inventory?storeId=store-dist-001').then(r => r.json()).catch(() => []),
    ]).then(([s, p, u, inv]) => {
      setStores(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      setUsers(Array.isArray(u) ? u : []);
      setInventory(Array.isArray(inv) ? inv : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetch('/api/inventory?storeId=' + selectedStore).then(r => r.json()).then(d => setInventory(Array.isArray(d) ? d : []));
    }
  }, [selectedStore]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-muted-foreground">Loading reports...</span>
    </div>
  );

  const distStores = stores.filter(s => s.type === 'DISTRIBUTION');
  const custStores = stores.filter(s => s.type === 'CUSTOMER');
  const totalStock = inventory.reduce((s: number, i: any) => s + i.onHand, 0);
  const totalReserved = inventory.reduce((s: number, i: any) => s + i.reserved, 0);
  const lowStock = inventory.filter((i: any) => i.onHand > 0 && i.available <= (i.reorderThreshold || 10));
  const admins = users.filter(u => u.role === 'ADMIN');
  const managers = users.filter(u => u.role === 'STORE_MANAGER');
  const pendingManagers = managers.filter(u => u.approvalStatus === 'PENDING');

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Distribution Hubs" value={distStores.length} icon={<Store className="h-5 w-5" />} />
        <StatCard title="Customer Stores" value={custStores.length} icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard title="Total Products" value={products.length} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Total Users" value={users.length} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Active Admins" value={admins.length} />
        <StatCard title="Store Managers" value={managers.length} />
        <StatCard title="Pending Approvals" value={pendingManagers.length} trend={pendingManagers.length > 0 ? 'down' : 'neutral'}
          description={pendingManagers.length > 0 ? `${pendingManagers.length} awaiting approval` : 'All approved'} />
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Inventory Store:</label>
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-64" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
