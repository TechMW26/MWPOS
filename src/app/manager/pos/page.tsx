'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QuantityControl } from '@/components/ui/quantity-control';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/lib/hooks/use-toast';
import { ShoppingCart, Trash2 } from 'lucide-react';

interface CartItem { skuId: string; productId: string; productName: string; sku: string; quantity: number; unitPrice: number; taxRate: number; imageUrl?: string | null; }

export default function POSPage() {
  const router = useRouter();
  const [skus, setSkus] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [paymentMode, setPaymentMode] = useState<'PAY_LATER' | 'UPFRONT'>('PAY_LATER');
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch('/api/skus').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/distributors').then(r => r.json()),
    ]).then(([s, p, d]) => {
      setSkus(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      const dList = Array.isArray(d) ? d : [];
      setDistributors(dList);
      setSelectedDistributor(dList[0]?.id ?? '');
      setLoading(false);
    });
  }, []);

  const filteredSkus = skus.filter(s => s.sku?.toLowerCase().includes(search.toLowerCase()) || s.productId?.toLowerCase().includes(search.toLowerCase()));

  function addToCart(sku: any) {
    const existing = cart.find(c => c.skuId === sku.id);
    if (existing) {
      setCart(cart.map(c => c.skuId === sku.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      const prod = products.find(p => p.id === sku.productId);
      setCart([...cart, { skuId: sku.id, productId: sku.productId, productName: prod?.name || sku.sku, sku: sku.sku, quantity: 1, unitPrice: sku.sellingPrice, taxRate: sku.taxRate, imageUrl: prod?.imageUrl ?? null }]);
    }
    const prod = products.find(p => p.id === sku.productId);
    addToast({ title: 'Added to cart', message: `${prod?.name || sku.sku} is now in your cart.`, type: 'success' });
  }

  function removeFromCart(skuId: string) { setCart(cart.filter(c => c.skuId !== skuId)); }
  function updateQty(skuId: string, qty: number) {
    if (qty <= 0) { removeFromCart(skuId); return; }
    setCart(cart.map(c => c.skuId === skuId ? { ...c, quantity: qty } : c));
  }

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + Math.round(c.unitPrice * c.quantity * c.taxRate / 100), 0);
  const total = subtotal + taxTotal;

  async function placeOrder() {
    if (cart.length === 0) return;
    if (!selectedDistributor) {
      addToast({ title: 'Select distributor', message: 'Choose a distributor before placing the order.', type: 'error' });
      return;
    }
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributorId: selectedDistributor,
        paymentMode,
        items: cart.map(item => ({ skuId: item.skuId, productId: item.productId, quantity: item.quantity })),
        notes: 'Placed by ASM',
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to place order');
      return;
    }
    addToast({
      title: 'Order placed',
      message: data.notificationDelivery?.sent ? 'Distributor notified. Approval uses Firebase OTP.' : 'Order created. Distributor can approve it using Firebase OTP.',
      type: 'success',
    });
    setCart([]);
    const orderId = data.orderId || data.id;
    if (paymentMode === 'PAY_LATER' && orderId) router.push(`/manager/orders/${orderId}`);
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (distributors.length === 0) return <div className="p-6"><Card className="p-4 text-center"><p className="text-muted-foreground">No distributors available. Create distributors first to place orders.</p></Card></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Ordering for distributor</label>
            <select className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:h-10 sm:text-sm" value={selectedDistributor} onChange={e => setSelectedDistributor(e.target.value)}>
              {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <Input placeholder="Search SKU or barcode..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
            {filteredSkus.slice(0, 24).map(sku => (
              <button key={sku.id} onClick={() => addToCart(sku)} className="p-3 border rounded-lg text-left hover:bg-muted transition-colors">
                {products.find(p => p.id === sku.productId)?.imageUrl && (
                  <img src={products.find(p => p.id === sku.productId)?.imageUrl} alt={sku.sku} className="mb-2 h-20 w-full rounded-md object-cover" />
                )}
                <p className="font-medium text-sm">{sku.sku}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(sku.sellingPrice)}</p>
                <Badge variant="outline" className="mt-1 text-xs">{sku.unit}</Badge>
              </button>
            ))}
            {filteredSkus.length === 0 && <p className="col-span-3 text-center text-muted-foreground py-8">No products found</p>}
          </div>
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="h-4 w-4"/>Cart ({cart.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[350px] overflow-y-auto">
              {cart.map(item => (
                <div key={item.skuId} className="flex items-center justify-between border-b pb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.sku} — {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <div className="ml-2 flex flex-col items-end gap-1">
                    <QuantityControl value={item.quantity} onChange={(quantity) => updateQty(item.skuId, quantity)} />
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => removeFromCart(item.skuId)}><Trash2 className="h-3 w-3 mr-1"/>Remove</Button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Cart is empty</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span>Tax</span><span>{formatCurrency(taxTotal)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={paymentMode === 'PAY_LATER' ? 'default' : 'outline'} onClick={() => setPaymentMode('PAY_LATER')}>Khata</Button>
                <Button type="button" variant={paymentMode === 'UPFRONT' ? 'default' : 'outline'} onClick={() => setPaymentMode('UPFRONT')}>Pay upfront</Button>
              </div>
              <Button className="w-full" size="lg" onClick={placeOrder} disabled={cart.length === 0 || !selectedDistributor}>Place Order — {formatCurrency(total)}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
