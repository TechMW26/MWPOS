'use client';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Store, Package, AlertTriangle } from 'lucide-react';

export default function AdminReportsPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      fetch('/api/stores?type=CUSTOMER').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
    ]).then(([s, p]) => {
      setStores(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      setLoading(false);
    });
  }, []);
  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Customer Stores" value={stores.length} icon={<Store className="h-5 w-5"/>} />
        <StatCard title="Total Products" value={products.length} icon={<Package className="h-5 w-5"/>} />
        <StatCard title="Active Stores" value={stores.filter((s:any) => s.isActive).length} icon={<Store className="h-5 w-5"/>} />
      </div>
      <Card><CardHeader><CardTitle>Operations Overview</CardTitle></CardHeader><CardContent>
        <p className="text-muted-foreground">Manage {stores.length} customer stores with {products.length} products in the catalog.</p>
      </CardContent></Card>
    </div>
  );
}
