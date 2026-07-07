'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useToast, useSound } from '@/lib/hooks/use-toast';
import { Search, ShoppingCart, Plus, Minus, Trash2, Send, Loader2, Package, Store } from 'lucide-react';

interface CartItem {
  skuId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  imageUrl?: string | null;
}

interface MarketplaceProps {
  storeId?: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'STORE_MANAGER' | 'CUSTOMER';
}

export function Marketplace({ storeId: propStoreId, role }: MarketplaceProps) {
  const [skus, setSkus] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState(propStoreId || '');
  const [paymentMode, setPaymentMode] = useState<'PAY_LATER' | 'UPFRONT'>('PAY_LATER');
  const [placing, setPlacing] = useState(false);
  const [orderMsg, setOrderMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'cart'>('browse');
  const { addToast } = useToast();
  const { play } = useSound();

  useEffect(() => {
    async function load() {
      try {
        const [skuRes, prodRes, storeRes] = await Promise.all([
          fetch('/api/skus'),
          fetch('/api/products'),
          fetch('/api/stores?type=CUSTOMER'),
        ]);
        const s = await skuRes.json();
        const p = await prodRes.json();
        const st = await storeRes.json();
        setSkus(Array.isArray(s) ? s : []);
        setProducts(Array.isArray(p) ? p : []);
        const storeList = Array.isArray(st) ? st : [];
        setStores(storeList);
        if (!propStoreId && storeList.length > 0) setSelectedStore(storeList[0].id);
      } catch {} finally { setLoading(false); }
    }
    load();
  }, [propStoreId]);

  const storeName = stores.find(s => s.id === selectedStore)?.name || '';

  const grouped = useMemo(() => {
    const map: Record<string, { product: any; skus: any[] }> = {};
    const filtered = skus.filter(s => {
      const prod = products.find(p => p.id === s.productId);
      const name = (prod?.name || s.sku || '').toLowerCase();
      return name.includes(search.toLowerCase());
    });
    filtered.forEach(sku => {
      const pid = sku.productId;
      if (!map[pid]) {
        const prod = products.find(p => p.id === pid);
        map[pid] = { product: prod || { id: pid, name: sku.sku, imageUrl: null }, skus: [] };
      }
      map[pid].skus.push(sku);
    });
    return Object.values(map);
  }, [skus, products, search]);

  function addToCart(sku: any) {
    const prod = products.find(p => p.id === sku.productId);
    const existing = cart.find(c => c.skuId === sku.id);
    if (existing) {
      setCart(cart.map(c => c.skuId === sku.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { skuId: sku.id, productId: sku.productId, productName: prod?.name || sku.sku, sku: sku.sku, quantity: 1, unitPrice: sku.sellingPrice, taxRate: sku.taxRate, imageUrl: prod?.imageUrl || null }]);
    }
  }

  function updateQty(skuId: string, qty: number) {
    if (qty <= 0) { setCart(cart.filter(c => c.skuId !== skuId)); return; }
    setCart(cart.map(c => c.skuId === skuId ? { ...c, quantity: qty } : c));
  }

  function removeFromCart(skuId: string) { setCart(cart.filter(c => c.skuId !== skuId)); }

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + Math.round(c.unitPrice * c.quantity * c.taxRate / 100), 0);
  const total = subtotal + taxTotal;

  async function placeOrder() {
    if (cart.length === 0 || !selectedStore) return;
    setPlacing(true); setOrderMsg('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerStoreId: selectedStore,
          paymentMode,
          items: cart.map(c => ({ skuId: c.skuId, productId: c.productId, quantity: c.quantity })),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place order');
      play('order');
      addToast({ title: 'Order Placed!', message: `#${data.orderId?.slice(0,8) || data.id?.slice(0,8)} — ${formatCurrency(total)}`, type: 'success' });
      setCart([]);
    } catch (e: any) {
      addToast({ title: 'Order Failed', message: e.message || 'Please try again', type: 'error' });
    } finally { setPlacing(false); }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Market Place</h1>
          <div className="flex rounded-md border overflow-hidden">
            <button className={`px-3 py-1.5 text-sm ${activeTab === 'browse' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setActiveTab('browse')}><Package className="h-3 w-3 inline mr-1" />Browse</button>
            <button className={`px-3 py-1.5 text-sm ${activeTab === 'cart' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setActiveTab('cart')}><ShoppingCart className="h-3 w-3 inline mr-1" />Cart ({cart.length})</button>
          </div>
        </div>
        {role !== 'CUSTOMER' && (
          <select className="h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-56" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {role === 'CUSTOMER' && storeName && (
          <Badge variant="outline" className="gap-1"><Store className="h-3 w-3" />{storeName}</Badge>
        )}
      </div>

      {orderMsg && (
        <div className={`p-3 rounded-md text-sm ${orderMsg.startsWith('Error') ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-green-50 text-green-700 border border-green-200'}`}>{orderMsg}</div>
      )}

      {activeTab === 'cart' && (
        <Card>
          <CardHeader><CardTitle>Shopping Cart ({cart.length} items)</CardTitle></CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Your cart is empty. Browse products to add items.</p>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.skuId} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                      <p className="text-sm font-medium">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateQty(item.skuId, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateQty(item.skuId, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive ml-1" onClick={() => removeFromCart(item.skuId)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span>Tax</span><span>{formatCurrency(taxTotal)}</span></div>
                  <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
                  <div className="flex items-center gap-3">
                    <select className="h-9 rounded-md border px-2 text-sm" value={paymentMode} onChange={e => setPaymentMode(e.target.value as any)}>
                      <option value="PAY_LATER">Pay Later (Khata)</option>
                      <option value="UPFRONT">Pay Upfront</option>
                    </select>
                    <Button className="flex-1" onClick={placeOrder} disabled={placing || cart.length === 0}>
                      {placing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {placing ? 'Placing...' : 'Place Order'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'browse' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.map(({ product, skus: productSkus }) => (
              <Card key={product.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-16 w-16 rounded-md border object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">IMG</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {productSkus.map(sku => (
                    <div key={sku.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                      <div>
                        <p className="text-sm font-mono font-medium">{sku.sku}</p>
                        <p className="text-xs text-muted-foreground">{sku.unit} · {formatCurrency(sku.sellingPrice)}</p>
                      </div>
                      <Button size="sm" onClick={() => addToCart(sku)}><Plus className="h-3 w-3 mr-1" />Add</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          {grouped.length === 0 && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm">{search ? 'Try a different search' : 'Add products from the catalog first'}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
