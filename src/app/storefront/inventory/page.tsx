'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

export default function StorefrontInventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/inventory?storeId=store-cust-001').then(r => r.json()).then(d => { setInventory(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const withStock = inventory.filter((i:any) => i.onHand > 0 || i.reserved > 0);

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Stock Levels ({withStock.length})</CardTitle></CardHeader><CardContent>
        <DataTable data={withStock} columns={[
          { key: 'skuId', header: 'SKU ID' }, { key: 'onHand', header: 'On Hand' }, { key: 'reserved', header: 'Reserved' }, { key: 'available', header: 'Available' },
          { key: 'status', header: 'Status', render: (i:any) => i.available <= (i.reorderThreshold||10) ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="success">OK</Badge> },
        ]} emptyMessage="No inventory yet. Place an order and wait for delivery to receive stock." />
      </CardContent></Card>
    </div>
  );
}
