'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { QuantityControl } from '@/components/ui/quantity-control';
import { useToast } from '@/lib/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Banknote, FileUp, Loader2, Package, Search, ShoppingCart, Trash2 } from 'lucide-react';

type PaymentOption = 'PAY_LATER' | 'PAID_ONLINE' | 'PAID_CHEQUE';

interface CartItem {
  skuId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export function AsmOrderPos() {
  const router = useRouter();
  const { addToast } = useToast();
  const [skus, setSkus] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('PAY_LATER');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/marketplace?storeType=DISTRIBUTOR')
      .then((res) => res.json())
      .then((data) => {
        setSkus(Array.isArray(data.skus) ? data.skus : []);
        setProducts(Array.isArray(data.products) ? data.products : []);
        const stores = Array.isArray(data.stores) ? data.stores : [];
        setDistributors(stores);
        setSelectedDistributor(stores[0]?.id ?? '');
      })
      .catch(() => addToast({ title: 'Failed to load POS', message: 'Please refresh and try again.', type: 'error' }))
      .finally(() => setLoading(false));
  }, [addToast]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const filteredSkus = useMemo(() => skus.filter((sku) => {
    const product = productsById.get(sku.productId);
    const haystack = `${sku.sku || ''} ${product?.name || ''} ${product?.brand || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [skus, productsById, search]);

  function addToCart(sku: any) {
    const product = productsById.get(sku.productId);
    const unitPrice = Number.isFinite(Number(sku.sellingPrice)) ? Math.round(Number(sku.sellingPrice)) : 0;
    const taxRate = Number.isFinite(Number(sku.taxRate)) ? Math.min(100, Math.max(0, Number(sku.taxRate))) : 0;
    const existing = cart.find((item) => item.skuId === sku.id);
    if (existing) {
      setCart(cart.map((item) => item.skuId === sku.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, {
        skuId: sku.id,
        productId: sku.productId,
        productName: product?.name || sku.sku,
        sku: sku.sku,
        quantity: 1,
        unitPrice,
        taxRate,
      }]);
    }
    addToast({ title: 'Added to cart', message: `${product?.name || sku.sku} added.`, type: 'success' });
  }

  function updateQty(skuId: string, qty: number) {
    if (qty <= 0) {
      setCart(cart.filter((item) => item.skuId !== skuId));
      return;
    }
    setCart(cart.map((item) => item.skuId === skuId ? { ...item, quantity: qty } : item));
  }

  async function uploadProof(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'order-proof');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload payment proof');
    return data as { url: string; fileName: string; mimeType: string };
  }

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxTotal = cart.reduce((sum, item) => sum + Math.round(item.unitPrice * item.quantity * item.taxRate / 100), 0);
  const total = subtotal + taxTotal;
  const proofRequired = paymentOption !== 'PAY_LATER';

  async function placeOrder() {
    if (!selectedDistributor) {
      addToast({ title: 'Select distributor', message: 'Choose a distributor before checkout.', type: 'error' });
      return;
    }
    if (cart.length === 0) return;
    if (proofRequired && !proofFile) {
      addToast({ title: 'Payment proof required', message: 'Attach a photo, PDF, or document proof before checkout.', type: 'error' });
      return;
    }

    setPlacing(true);
    try {
      const proof = proofFile ? await uploadProof(proofFile) : null;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributorId: selectedDistributor,
          paymentMode: paymentOption === 'PAY_LATER' ? 'PAY_LATER' : 'UPFRONT',
          paymentProofType: paymentOption === 'PAID_ONLINE' ? 'ONLINE' : paymentOption === 'PAID_CHEQUE' ? 'CHEQUE' : null,
          paymentProofUrl: proof?.url ?? null,
          paymentProofFileName: proof?.fileName ?? null,
          paymentProofMimeType: proof?.mimeType ?? null,
          paymentReference: paymentReference.trim() || null,
          items: cart.map((item) => ({ skuId: item.skuId, productId: item.productId, quantity: item.quantity })),
          notes: 'Placed by ASM',
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place order');

      addToast({
        title: 'Order created',
        message: data.otpCode ? `Pending distributor OTP. OTP: ${data.otpCode}` : 'Order is pending distributor OTP.',
        type: 'success',
      });
      setCart([]);
      setProofFile(null);
      setPaymentReference('');
      router.push(`/asm/orders/${data.orderId || data.id}`);
    } catch (error) {
      addToast({ title: 'Order failed', message: error instanceof Error ? error.message : 'Please try again.', type: 'error' });
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading POS...</div>;

  if (distributors.length === 0) {
    return <Card className="p-4 text-center"><p className="text-muted-foreground">No distributors available for your assignment.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Create distributor orders. ASM orders stay pending until distributor OTP verification.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[260px_1fr]">
            <select className="h-11 rounded-md border bg-background px-3 text-sm" value={selectedDistributor} onChange={(event) => setSelectedDistributor(event.target.value)}>
              {distributors.map((distributor) => <option key={distributor.id} value={distributor.id}>{distributor.name}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search product, brand, or SKU..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSkus.slice(0, 60).map((sku) => {
              const product = productsById.get(sku.productId);
              return (
                <button key={sku.id} type="button" onClick={() => addToCart(sku)} className="rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <div className="flex gap-3">
                    {product?.imageUrl ? <img src={product.imageUrl} alt={product.name || sku.sku} className="h-14 w-14 rounded-md object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product?.name || sku.sku}</p>
                      <p className="text-xs text-muted-foreground">{sku.sku}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">{sku.unit}</Badge>
                        <span className="text-sm font-semibold">{formatCurrency(sku.sellingPrice)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredSkus.length === 0 && <Card className="p-4 text-center text-muted-foreground">No products found.</Card>}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShoppingCart className="h-4 w-4" />Cart ({cart.length})</CardTitle></CardHeader>
            <CardContent className="max-h-[360px] space-y-3 overflow-y-auto">
              {cart.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Add products to checkout.</p> : cart.map((item) => (
                <div key={item.skuId} className="border-b pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.sku} · {formatCurrency(item.unitPrice)}</p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => updateQty(item.skuId, 0)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <QuantityControl value={item.quantity} onChange={(qty) => updateQty(item.skuId, qty)} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(taxTotal)}</span></div>
                <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              <div className="grid gap-2">
                <Button type="button" variant={paymentOption === 'PAY_LATER' ? 'default' : 'outline'} onClick={() => setPaymentOption('PAY_LATER')} className="justify-start"><Banknote className="mr-2 h-4 w-4" />Pay later</Button>
                <Button type="button" variant={paymentOption === 'PAID_ONLINE' ? 'default' : 'outline'} onClick={() => setPaymentOption('PAID_ONLINE')} className="justify-start"><FileUp className="mr-2 h-4 w-4" />Paid online + proof</Button>
                <Button type="button" variant={paymentOption === 'PAID_CHEQUE' ? 'default' : 'outline'} onClick={() => setPaymentOption('PAID_CHEQUE')} className="justify-start"><FileUp className="mr-2 h-4 w-4" />Paid by cheque + proof</Button>
              </div>

              {proofRequired && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <label className="text-sm font-medium">Payment proof *</label>
                  <Input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} />
                  <Input placeholder={paymentOption === 'PAID_CHEQUE' ? 'Cheque number / bank reference (optional)' : 'Transaction reference (optional)'} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                  {proofFile && <p className="text-xs text-muted-foreground">Selected: {proofFile.name}</p>}
                </div>
              )}

              <Button className="w-full" size="lg" disabled={placing || cart.length === 0 || !selectedDistributor} onClick={placeOrder}>
                {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {placing ? 'Creating order...' : 'Checkout'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
