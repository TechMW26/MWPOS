'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuantityControl } from '@/components/ui/quantity-control';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, CreditCard, ShoppingCart, Trash2, WalletCards } from 'lucide-react';

interface CartItem { skuId: string; productName: string; sku: string; quantity: number; unitPrice: number; taxRate: number; }

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState<'PAY_LATER' | 'UPFRONT'>('PAY_LATER');
  const [step, setStep] = useState<'review' | 'payment'>('review');
  const [submitting, setSubmitting] = useState(false);

  function updateQty(skuId: string, qty: number) {
    if (qty <= 0) { setCart(cart.filter(c => c.skuId !== skuId)); return; }
    setCart(cart.map(c => c.skuId === skuId ? { ...c, quantity: qty } : c));
  }
  function removeItem(skuId: string) { setCart(cart.filter(c => c.skuId !== skuId)); }

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + Math.round(c.unitPrice * c.quantity * c.taxRate / 100), 0);
  const total = subtotal + taxTotal;

  async function submitOrder() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          paymentMode,
          items: cart.map(c => ({ skuId: c.skuId, productId: c.skuId, quantity: c.quantity })),
          notes, idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCart([]);
        setNotes('');
        const orderId = data.orderId || data.id;
        if (paymentMode === 'PAY_LATER' && orderId) router.push(`/storefront/orders/${orderId}`);
        else alert('Order placed! Order ID: ' + orderId);
      }
      else { alert('Failed: ' + (data.message || 'Unknown error')); }
    } finally { setSubmitting(false); }
  }

  if (cart.length === 0) return (
    <div className="space-y-6 md:space-y-6">
      <Card><CardContent className="py-12 text-center"><ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4"/><p className="text-muted-foreground">Your cart is empty. Browse the catalog to add products.</p></CardContent></Card>
    </div>
  );

  return (
    <>
      <div className="hidden space-y-6 md:block">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CartItems cart={cart} updateQty={updateQty} removeItem={removeItem} />
          <DesktopSummary
            subtotal={subtotal}
            taxTotal={taxTotal}
            total={total}
            notes={notes}
            setNotes={setNotes}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode}
            submitOrder={submitOrder}
            submitting={submitting}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 top-8 z-40 flex flex-col rounded-t-2xl border bg-background shadow-2xl animate-sheet-up md:hidden">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm text-muted-foreground">{step === 'review' ? 'Review cart' : 'Choose payment'}</p>
            <p className="text-lg font-semibold">{cart.length} item{cart.length !== 1 ? 's' : ''} · {formatCurrency(total)}</p>
          </div>
          {step === 'payment' && (
            <Button variant="ghost" size="icon" onClick={() => setStep('review')} aria-label="Back to cart">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-28">
          {step === 'review' ? (
            <div className="space-y-3">
              <CartItems cart={cart} updateQty={updateQty} removeItem={removeItem} compact />
              <OrderTotals subtotal={subtotal} taxTotal={taxTotal} total={total} />
              <Input placeholder="Order notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <PaymentCard
                title="Pay upfront"
                description="Pay now through Razorpay and keep this order separated as upfront payment."
                icon={<CreditCard className="h-6 w-6" />}
                active={paymentMode === 'UPFRONT'}
                onClick={() => setPaymentMode('UPFRONT')}
              />
              <PaymentCard
                title="Pay later"
                description="Add this order to Khata and settle it later from your account."
                icon={<WalletCards className="h-6 w-6" />}
                active={paymentMode === 'PAY_LATER'}
                onClick={() => setPaymentMode('PAY_LATER')}
              />
              <OrderTotals subtotal={subtotal} taxTotal={taxTotal} total={total} />
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-[4.5rem] z-50 border-t bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          {step === 'review' ? (
            <Button className="w-full" size="lg" onClick={() => setStep('payment')}>
              Order now · {formatCurrency(total)}
            </Button>
          ) : (
            <Button className="w-full" size="lg" onClick={submitOrder} disabled={submitting}>
              {submitting ? 'Placing order...' : `Place order · ${paymentMode === 'UPFRONT' ? 'Pay upfront' : 'Pay later'}`}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function CartItems({
  cart,
  updateQty,
  removeItem,
  compact = false,
}: {
  cart: CartItem[];
  updateQty: (skuId: string, qty: number) => void;
  removeItem: (skuId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-2' : 'lg:col-span-2 space-y-3'}>
      {cart.map(item => (
        <Card key={item.skuId}>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.productName}</p>
              <p className="text-sm text-muted-foreground">{item.sku} · {formatCurrency(item.unitPrice)} each</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <QuantityControl value={item.quantity} onChange={(quantity) => updateQty(item.skuId, quantity)} />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => removeItem(item.skuId)}><Trash2 className="h-3 w-3 mr-1"/>Remove</Button>
            </div>
            {!compact && <span className="ml-2 w-24 text-right font-bold">{formatCurrency(item.unitPrice * item.quantity)}</span>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DesktopSummary({
  subtotal,
  taxTotal,
  total,
  notes,
  setNotes,
  paymentMode,
  setPaymentMode,
  submitOrder,
  submitting,
}: {
  subtotal: number;
  taxTotal: number;
  total: number;
  notes: string;
  setNotes: (value: string) => void;
  paymentMode: 'PAY_LATER' | 'UPFRONT';
  setPaymentMode: (value: 'PAY_LATER' | 'UPFRONT') => void;
  submitOrder: () => void;
  submitting: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Order Summary</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <OrderTotals subtotal={subtotal} taxTotal={taxTotal} total={total} />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={paymentMode === 'PAY_LATER' ? 'default' : 'outline'} onClick={() => setPaymentMode('PAY_LATER')}>Khata</Button>
          <Button type="button" variant={paymentMode === 'UPFRONT' ? 'default' : 'outline'} onClick={() => setPaymentMode('UPFRONT')}>Pay upfront</Button>
        </div>
        <Input placeholder="Order notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
        <Button className="w-full" onClick={submitOrder} disabled={submitting}>{submitting ? 'Placing Order...' : 'Submit Order'}</Button>
      </CardContent>
    </Card>
  );
}

function OrderTotals({ subtotal, taxTotal, total }: { subtotal: number; taxTotal: number; total: number }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
      <div className="flex justify-between text-sm"><span>Tax</span><span>{formatCurrency(taxTotal)}</span></div>
      <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
    </div>
  );
}

function PaymentCard({
  title,
  description,
  icon,
  active,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all active:scale-[0.99] ${active ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{icon}</div>
        <div className="lg:col-span-2 space-y-3">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}
