'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Search } from 'lucide-react';

export default function StorefrontCatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const storeId = 'store-cust-001';

  useEffect(() => {
    Promise.all([
      fetch('/api/catalog?storeId='+storeId).then(r => r.json()),
      fetch('/api/skus').then(r => r.json()),
    ]).then(([p, s]) => { setProducts(Array.isArray(p) ? p : []); setSkus(Array.isArray(s) ? s : []); setLoading(false); });
  }, []);

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
        <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(product => {
          const productSkus = skus.filter((s:any) => s.productId === product.id);
          return (
            <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-28 w-full object-cover sm:h-40" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center bg-muted text-xs text-muted-foreground sm:h-40 sm:text-sm">No image</div>
              )}
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="line-clamp-2 text-sm sm:text-lg">{product.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{product.brand}</p>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <p className="mb-3 hidden text-sm text-muted-foreground sm:block">{product.description?.slice(0, 100)}</p>
                <div className="space-y-2">
                  {productSkus.slice(0, 2).map((sku:any) => (
                    <div key={sku.id} className="grid grid-cols-[1fr_auto] items-end gap-2 border-t pt-2">
                      <div>
                        <p className="truncate text-xs font-medium sm:text-sm">{sku.sku}</p>
                        <p className="text-xs text-muted-foreground">{sku.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold sm:text-base">{formatCurrency(sku.sellingPrice)}</p>
                        <p className="hidden text-xs text-muted-foreground sm:block">MRP {formatCurrency(sku.mrp)}</p>
                      </div>
                    </div>
                  ))}
                  {productSkus.length > 2 && <Badge variant="outline">+{productSkus.length - 2} more</Badge>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground"><p>No products found</p></div>}
      </div>
    </div>
  );
}
