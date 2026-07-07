'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function InventoryPage() {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/distributors').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : [];
      setDistributors(list);
      if (list.length > 0) setSelectedDistributor(list[0].id);
      setLoading(list.length === 0 ? false : true);
    });
  }, []);

  useEffect(() => {
    if (!selectedDistributor) return;
    setLoading(true);
    fetch('/api/inventory?storeId=' + selectedDistributor).then(r => r.json()).then(d => { setInventory(Array.isArray(d) ? d : []); setLoading(false); });
  }, [selectedDistributor]);

  if (distributors.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <Card className="p-4 text-center"><p className="text-muted-foreground">No distributors found. Create distributors first from the Distributors page.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Distributor:</label>
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-64" value={selectedDistributor} onChange={e => setSelectedDistributor(e.target.value)}>
          {distributors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.city})</option>)}
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
