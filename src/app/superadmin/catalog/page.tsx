'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Package, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const productsLive = useRealtimeList({ path: 'products', fallbackUrl: '/api/products' });
  const skusLive = useRealtimeList({ path: 'skus', fallbackUrl: '/api/skus' });
  const products = productsLive.data;
  const skus = skusLive.data;
  const loading = productsLive.loading || skusLive.loading;
  const error = productsLive.error || skusLive.error;
  const live = productsLive.live && skusLive.live;

  const filtered = products.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  function getSkusForProduct(productId: string) {
    return skus.filter((s: any) => s.productId === productId);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-muted-foreground">Loading catalog...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{live ? 'Live catalog updates on' : 'Auto refresh on'}</p>
        <div className="flex gap-2">
          <Link href="/superadmin/catalog/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />New Product</Button>
          </Link>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products by name or brand..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>
      {error ? (
        <Card className="border-destructive"><CardContent className="py-8 text-center"><p className="text-destructive">{error}</p></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-lg font-medium text-muted-foreground">No products found</p><p className="text-sm text-muted-foreground mt-1">{search ? 'Try a different search term.' : 'Click New Product to add your first product.'}</p>{!search && <Link href="/superadmin/catalog/new" className="block sm:inline-block"><Button className="mt-4 w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />New Product</Button></Link>}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((product: any) => {
            const productSkus = getSkusForProduct(product.id);
            const isExpanded = expandedProduct === product.id;
            return (
              <Card key={product.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedProduct(isExpanded ? null : product.id)}>
                  <div className="flex items-start justify-between gap-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-14 w-14 rounded-md border object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">IMG</div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">{product.name}<Badge variant={product.isActive ? 'success' : 'destructive'} className="text-xs">{product.isActive ? 'Active' : 'Inactive'}</Badge></CardTitle>
                      <p className="text-sm text-muted-foreground">{product.brand} · {product.categoryId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{productSkus.length}</span> SKU{productSkus.length !== 1 ? 's' : ''}</div>
                      <Link href={`/superadmin/catalog/new?edit=${product.id}`} onClick={e => e.stopPropagation()}><Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" />Edit</Button></Link>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="border-t pt-4">
                    {product.description && <p className="text-sm text-muted-foreground mb-4">{product.description}</p>}
                    {productSkus.length === 0 ? <p className="text-sm text-muted-foreground">No SKUs defined.</p> : (
                      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground uppercase"><th className="py-2 px-3">SKU</th><th className="py-2 px-3">Barcode</th><th className="py-2 px-3">Unit</th><th className="py-2 px-3">Cost</th><th className="py-2 px-3">Sell Price</th><th className="py-2 px-3">MRP</th><th className="py-2 px-3">Tax</th></tr></thead><tbody>{productSkus.map((sku: any) => (<tr key={sku.id} className="border-b last:border-0 hover:bg-muted/30"><td className="py-2 px-3 font-mono font-medium">{sku.sku}</td><td className="py-2 px-3 font-mono text-xs text-muted-foreground">{sku.barcode || '—'}</td><td className="py-2 px-3">{sku.unit}</td><td className="py-2 px-3">{formatCurrency(sku.costPrice)}</td><td className="py-2 px-3 font-medium">{formatCurrency(sku.sellingPrice)}</td><td className="py-2 px-3 text-muted-foreground">{formatCurrency(sku.mrp)}</td><td className="py-2 px-3">{sku.taxType} {sku.taxRate}%</td></tr>))}</tbody></table></div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
