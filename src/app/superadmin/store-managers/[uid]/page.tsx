'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Store, TrendingUp, ClipboardList, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function ManagerDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [manager, setManager] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [allStores, setAllStores] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, storesRes, allStoresRes] = await Promise.all([
          fetch('/api/users?role=STORE_MANAGER'),
          fetch('/api/stores'),
          fetch('/api/stores?type=CUSTOMER'),
        ]);
        const users = await usersRes.json();
        const allS = await allStoresRes.json();
        const st = await storesRes.json();
        const mgr = (Array.isArray(users) ? users : []).find((u: any) => u.uid === uid);
        setManager(mgr || null);
        const storeList = Array.isArray(st) ? st : [];
        setAllStores(Array.isArray(allS) ? allS : []);

        // Find stores assigned to this manager
        const managerStores = storeList.filter((s: any) => s.managerUid === uid);
        setStores(managerStores);

        // Load orders for manager's stores
        if (managerStores.length > 0) {
          const orderResults = await Promise.all(
            managerStores.map((s: any) => fetch('/api/orders?storeId=' + s.id).then(r => r.json()).catch(() => []))
          );
          setOrders(orderResults.flat().filter(Boolean));
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, [uid]);

  async function assignStore(storeId: string) {
    await fetch('/api/stores', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, managerUid: uid }),
    });
    // Refresh
    const updated = stores.map(s => s.id === storeId ? { ...s, managerUid: uid } : s);
    const newlyAssigned = allStores.find(s => s.id === storeId);
    if (newlyAssigned && !updated.find(s => s.id === storeId)) {
      updated.push({ ...newlyAssigned, managerUid: uid });
    }
    setStores(updated);
  }

  async function unassignStore(storeId: string) {
    await fetch('/api/stores', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, managerUid: null }),
    });
    setStores(stores.filter(s => s.id !== storeId));
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!manager) return <div className="p-6 text-destructive">Manager not found</div>;

  const revenue = orders.reduce((s: number, o: any) => s + (o.totalPaise || 0), 0);
  const completedOrders = orders.filter((o: any) => o.status === 'DELIVERED' || o.status === 'COMPLETED');
  const pendingOrders = orders.filter((o: any) => o.status !== 'DELIVERED' && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const unassignedStores = allStores.filter(s => !s.managerUid && s.type === 'CUSTOMER');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/superadmin/store-managers"><ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" /></Link>
        <div>
          <h1 className="text-xl font-bold">{manager.displayName || manager.email || manager.phone}</h1>
          <p className="text-sm text-muted-foreground">{manager.email} {manager.phone ? '· ' + manager.phone : ''}</p>
        </div>
        <Badge variant={manager.approvalStatus === 'APPROVED' ? 'success' : manager.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>
          {manager.approvalStatus || 'N/A'}
        </Badge>
        <Badge variant={manager.isActive ? 'success' : 'destructive'}>{manager.isActive ? 'Active' : 'Inactive'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Assigned Stores" value={stores.length} icon={<Store className="h-4 w-4" />} />
        <StatCard title="Revenue" value={formatCurrency(revenue)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard title="Completed Orders" value={completedOrders.length} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard title="Pending Orders" value={pendingOrders.length} icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      {/* Assigned Stores */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-4 w-4" />Assigned Stores ({stores.length})</CardTitle></CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No stores assigned yet.</p>
          ) : (
            <DataTable data={stores} columns={[
              { key: 'name', header: 'Store' },
              { key: 'city', header: 'City' },
              { key: 'phone', header: 'Phone' },
              { key: 'approvalStatus', header: 'Status', render: (s) => <Badge variant={s.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>{s.approvalStatus}</Badge> },
              { key: 'actions', header: '', render: (s) => (
                <Button size="sm" variant="outline" className="text-destructive h-7" onClick={() => unassignStore(s.id)}>Remove</Button>
              )},
            ]} />
          )}
        </CardContent>
      </Card>

      {/* Assign New Store */}
      {unassignedStores.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Assign Additional Store</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3 flex-wrap">
            <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm flex-1 min-w-[200px]"
              defaultValue="" onChange={e => { if (e.target.value) assignStore(e.target.value); e.target.value = ''; }}>
              <option value="">Select a store...</option>
              {unassignedStores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader><CardTitle>Recent Orders ({orders.length})</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No orders yet.</p>
          ) : (
            <DataTable data={orders.slice(0, 20)} columns={[
              { key: 'id', header: 'Order ID', render: (o) => <span className="font-mono text-xs">{o.id?.slice(0, 8)}</span> },
              { key: 'status', header: 'Status', render: (o) => <Badge variant={o.status === 'DELIVERED' ? 'success' : o.status === 'CANCELLED' ? 'destructive' : 'warning'}>{o.status}</Badge> },
              { key: 'totalPaise', header: 'Amount', render: (o) => formatCurrency(o.totalPaise) },
              { key: 'paymentMode', header: 'Payment', render: (o) => <Badge variant="outline">{o.paymentMode}</Badge> },
              { key: 'createdAt', header: 'Date', render: (o) => new Date(o.createdAt).toLocaleDateString() },
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
