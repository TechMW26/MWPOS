'use client';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Package, AlertTriangle } from 'lucide-react';

export default function ManagerReportsPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/inventory?storeId=store-cust-001').then(r => r.json()).then(d => { setInventory(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const totalStock = inventory.reduce((s:number,i:any) => s + i.onHand, 0);
  const lowStock = inventory.filter((i:any) => i.available <= (i.reorderThreshold||10)).length;

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard title="Total Stock" value={totalStock.toLocaleString()} icon={<Package className="h-5 w-5"/>} />
        <StatCard title="Low Stock SKUs" value={lowStock} icon={<AlertTriangle className="h-5 w-5"/>} trend={lowStock > 0 ? 'down' : 'neutral'} />
      </div>
      <Card><CardHeader><CardTitle>Store Performance</CardTitle></CardHeader><CardContent>
        <p className="text-muted-foreground">Detailed sales and performance reports will be available in future updates.</p>
      </CardContent></Card>
    </div>
  );
}
