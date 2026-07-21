'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QuantityControl } from '@/components/ui/quantity-control';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/lib/hooks/use-toast';
import { ShoppingCart, Trash2, Banknote, CreditCard, Smartphone } from 'lucide-react';

interface CartItem { skuId: string; productName: string; sku: string; quantity: number; unitPrice: number; taxRate: number; }

export default function StorefrontPOSPage() {
  const [skus, setSkus] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => { fetch('/api/skus').then(r => r.json()).then(d => { setSkus(Array.isArray(d) ? d : []); setLoading(false); }); }, []);

  const filteredSkus = skus.filter(s => s.sku?.toLowerCase().includes(search.toLowerCase()));

  function addToCart(sku: any) {
    const existing = cart.find(c => c.skuId === sku.id);
    if (existing) {
      setCart(cart.map(c => c.skuId === sku.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { skuId: sku.id, productName: sku.sku, sku: sku.sku, quantity: 1, unitPrice: sku.sellingPrice, taxRate: sku.taxRate }]);
    }
    addToast({ title: 'Added to cart', message: `${sku.sku} is now in your cart.`, type: 'success' });
  }
  function removeFromCart(skuId: string) { setCart(cart.filter(c => c.skuId !== skuId)); }
  function updateQty(skuId: string, qty: number) {
    if (qty <= 0) { removeFromCart(skuId); return; }
    setCart(cart.map(c => c.skuId === skuId ? { ...c, quantity: qty } : c));
  }

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + Math.round(c.unitPrice * c.quantity * c.taxRate / 100), 0);
  const total = subtotal + taxTotal;

  async function completeSale() {
    if (cart.length === 0) return;
    addToast({ title: 'Sale completed', message: `${formatCurrency(total)} paid via ${paymentMethod}.`, type: 'success' });
    setCart([]);
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Input placeholder="Search SKU..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
            {filteredSkus.slice(0, 24).map(sku => (
              <button key={sku.id} onClick={() => addToCart(sku)} className="p-3 border rounded-lg text-left hover:bg-muted transition-colors">
                <p className="font-medium text-sm">{sku.sku}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(sku.sellingPrice)}</p>
              </button>
            ))}
            {filteredSkus.length === 0 && <p className="col-span-3 text-center text-muted-foreground py-8">No products found</p>}
          </div>
        </div>
        <div className="space-y-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="h-4 w-4"/>Cart</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[300px] overflow-y-auto">
              {cart.map(item => (
                <div key={item.skuId} className="flex items-center justify-between border-b pb-2">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{item.sku}</p><p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)}</p></div>
                  <div className="flex flex-col items-end gap-1"><QuantityControl value={item.quantity} onChange={(quantity) => updateQty(item.skuId, quantity)} /><Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => removeFromCart(item.skuId)}><Trash2 className="h-3 w-3 mr-1"/>Remove</Button></div>
                </div>
              ))}
              {cart.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Cart is empty</p>}
            </CardContent>
          </Card>
          <Card><CardContent className="pt-4 space-y-3">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span>Tax</span><span>{formatCurrency(taxTotal)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={paymentMethod === 'CASH' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('CASH')}><Banknote className="h-3 w-3 mr-1"/>Cash</Button>
              <Button variant={paymentMethod === 'CARD' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('CARD')}><CreditCard className="h-3 w-3 mr-1"/>Card</Button>
              <Button variant={paymentMethod === 'UPI' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('UPI')}><Smartphone className="h-3 w-3 mr-1"/>UPI</Button>
              <Button variant={paymentMethod === 'BANK_TRANSFER' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('BANK_TRANSFER')}>Bank</Button>
            </div>
            <Button className="w-full" size="lg" onClick={completeSale} disabled={cart.length === 0}>Complete Sale — {formatCurrency(total)}</Button>
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
