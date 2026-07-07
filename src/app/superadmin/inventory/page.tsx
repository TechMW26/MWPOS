'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function InventoryPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState('store-dist-001');
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setStores(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!selectedStore) return;
    setLoading(true);
    fetch('/api/inventory?storeId=' + selectedStore).then(r => r.json()).then(d => { setInventory(Array.isArray(d) ? d : []); setLoading(false); });
  }, [selectedStore]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Store:</label>
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-64" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
        </select>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardHeader><CardTitle>Stock Levels</CardTitle></CardHeader><CardContent>
          <DataTable data={inventory} columns={[
            { key: 'skuId', header: 'SKU ID' },
            { key: 'onHand', header: 'On Hand' },
            { key: 'reserved', header: 'Reserved' },
            { key: 'available', header: 'Available' },
            { key: 'reorderThreshold', header: 'Reorder At' },
            { key: 'status', header: 'Status', render: (i) => i.available <= (i.reorderThreshold || 10) ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="success">OK</Badge> },
          ]} />
        </CardContent></Card>
      )}
    </div>
  );
}
