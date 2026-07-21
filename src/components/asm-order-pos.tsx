"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowRight, Banknote, Check, FileCheck2, Loader2, Package, Plus,
  RefreshCw, Search, ShoppingCart, Store, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { QuantityControl } from "@/components/ui/quantity-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderCart } from "@/lib/hooks/use-order-cart";
import { useToast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductSku, Store as StoreModel } from "@/types/models";

type PaymentOption = "PAY_LATER" | "PAID_ONLINE" | "PAID_CHEQUE";
type Step = "products" | "review";
type MarketplaceData = { products: Product[]; skus: ProductSku[]; stores: StoreModel[] };

export function AsmOrderPos({ mode = "asm" }: { mode?: "asm" | "cf" }) {
  const router = useRouter();
  const { addToast } = useToast();
  const cart = useOrderCart(mode);
  const [data, setData] = useState<MarketplaceData>({ products: [], skus: [], stores: [] });
  const [selectedDistributor, setSelectedDistributor] = useState("");
  const [step, setStep] = useState<Step>("products");
  const [search, setSearch] = useState("");
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("PAY_LATER");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/marketplace?storeType=DISTRIBUTOR", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to load ASM ordering");
        const clean = {
          products: Array.isArray(payload.products) ? payload.products : [],
          skus: Array.isArray(payload.skus) ? payload.skus : [],
          stores: Array.isArray(payload.stores) ? payload.stores : [],
        };
        setData(clean);
        setError("");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load ASM ordering");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reloadKey, mode]);

  useEffect(() => {
    if (data.stores.length === 0 || selectedDistributor) return;
    const saved = window.localStorage.getItem(`mwpos:${mode}-order:distributor`);
    const next = data.stores.some((store) => store.id === saved) ? saved! : data.stores[0]!.id;
    setSelectedDistributor(next);
  }, [data.stores, selectedDistributor, mode]);

  const productsById = useMemo(() => new Map(data.products.map((product) => [product.id, product])), [data.products]);
  const cartBySku = useMemo(() => new Map(cart.items.map((item) => [item.skuId, item])), [cart.items]);
  const selectedStore = data.stores.find((store) => store.id === selectedDistributor);
  const filteredSkus = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.skus.filter((sku) => {
      const product = productsById.get(sku.productId);
      return !query || `${product?.name || ""} ${product?.brand || ""} ${sku.sku} ${sku.unit}`.toLowerCase().includes(query);
    });
  }, [data.skus, productsById, search]);

  function chooseDistributor(id: string) {
    setSelectedDistributor(id);
    window.localStorage.setItem(`mwpos:${mode}-order:distributor`, id);
  }

  function openQuantity(sku: ProductSku) {
    setSelectedSku(sku);
    setSelectedQty(Math.max(1, cartBySku.get(sku.id)?.quantity || 1));
  }

  function addSelectedItem() {
    if (!selectedSku) return;
    const product = productsById.get(selectedSku.productId);
    cart.addItem({
      skuId: selectedSku.id, productId: selectedSku.productId,
      productName: product?.name || selectedSku.sku, sku: selectedSku.sku, unit: selectedSku.unit,
      quantity: selectedQty, unitPrice: Math.max(0, Math.round(Number(selectedSku.sellingPrice) || 0)),
      taxRate: Math.min(100, Math.max(0, Number(selectedSku.taxRate) || 0)), imageUrl: product?.imageUrl || null,
    });
    setSelectedSku(null);
    addToast({ title: "Cart updated", message: `${selectedQty} × ${product?.name || selectedSku.sku} added.`, type: "success" });
  }

  async function uploadProof(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", "order-proof");
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Unable to upload payment proof");
    return payload as { url: string; fileName: string; mimeType: string };
  }

  async function placeOrder() {
    const proofRequired = paymentOption !== "PAY_LATER";
    if (!selectedDistributor || cart.items.length === 0) return;
    if (proofRequired && !proofFile) {
      addToast({ title: "Payment proof required", message: "Attach the online or cheque payment proof.", type: "error" });
      return;
    }
    setPlacing(true);
    try {
      const proof = proofFile ? await uploadProof(proofFile) : null;
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distributorId: selectedDistributor,
          paymentMode: paymentOption === "PAY_LATER" ? "PAY_LATER" : "UPFRONT",
          paymentProofType: paymentOption === "PAID_ONLINE" ? "ONLINE" : paymentOption === "PAID_CHEQUE" ? "CHEQUE" : null,
          paymentProofUrl: proof?.url ?? null, paymentProofFileName: proof?.fileName ?? null,
          paymentProofMimeType: proof?.mimeType ?? null, paymentReference: paymentReference.trim() || null,
          items: cart.items.map((item) => ({ skuId: item.skuId, productId: item.productId, quantity: item.quantity })),
          notes: orderNotes.trim() || (mode === "cf" ? "Placed directly by C&F" : "Placed by ASM"), idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to place order");
      const orderId = payload.orderId || payload.id;
      cart.clear();
      setProofFile(null);
      setPaymentReference("");
      addToast({
        title: "Order created",
        message: payload.notificationDelivery?.sent
          ? "The distributor was notified and can review the order using Firebase OTP."
          : "The distributor can review the order and request a Firebase OTP from their portal.",
        type: "success",
      });
      router.push(orderId ? `/${mode}/orders/${orderId}` : `/${mode}/orders`);
    } catch (submitError) {
      addToast({ title: "Order not placed", message: submitError instanceof Error ? submitError.message : "Please try again.", type: "error" });
    } finally {
      setPlacing(false);
    }
  }

  if (!cart.ready || (loading && data.stores.length === 0)) return <AsmPosSkeleton />;
  if (!loading && data.stores.length === 0) return <Card><CardContent className="py-12 text-center"><Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">No assigned distributors</p><p className="mt-1 text-sm text-muted-foreground">An admin must assign active distributors to your district.</p></CardContent></Card>;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <Card>
        <CardContent className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div><Badge variant="outline" className="mb-2">{mode === "cf" ? "C&F direct order" : "ASM order desk"}</Badge><h1 className="text-xl font-semibold">Order for {selectedStore?.name || "distributor"}</h1><p className="mt-1 text-sm text-muted-foreground">{mode === "cf" ? "This order is approved directly and inventory is reserved immediately." : "The selected distributor will verify this order by OTP before C&F approval."}</p></div>
          <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Ordering for</span><select aria-label="Select distributor" value={selectedDistributor} onChange={(event) => chooseDistributor(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm font-medium">{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 overflow-hidden rounded-lg border bg-card text-sm">
        <button type="button" onClick={() => setStep("products")} className={`flex min-h-12 items-center justify-center gap-2 ${step === "products" ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><Package className="h-4 w-4" /><span className="hidden sm:inline">1. </span>Products</button>
        <button type="button" onClick={() => setStep("review")} className={`flex min-h-12 items-center justify-center gap-2 border-x ${step === "review" ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">2. </span>Review <Badge variant="outline" className={step === "review" ? "border-primary-foreground/40 text-primary-foreground" : ""}>{cart.totals.itemCount}</Badge></button>
        <button type="button" onClick={() => cart.items.length > 0 && setStep("review")} className={`flex min-h-12 items-center justify-center gap-2 ${cart.items.length ? "text-muted-foreground hover:bg-muted" : "cursor-not-allowed text-muted-foreground/50"}`}><Check className="h-4 w-4" /><span className="hidden sm:inline">3. </span>Confirm</button>
      </div>

      {error && <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span><Button size="sm" variant="outline" onClick={() => { setLoading(true); setReloadKey((value) => value + 1); }}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>}

      {step === "products" ? <section className="space-y-4">
        <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search products" className="h-11 pl-10" placeholder="Search product, brand, SKU, or pack size…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredSkus.map((sku) => { const product = productsById.get(sku.productId); const inCart = cartBySku.get(sku.id)?.quantity || 0; return <Card key={sku.id}><CardContent className="flex items-center gap-3 pt-4">{product?.imageUrl ? <img loading="lazy" decoding="async" src={product.imageUrl} alt="" className="h-14 w-14 rounded-lg border object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>}<div className="min-w-0 flex-1"><p className="truncate font-medium">{product?.name || sku.sku}</p><p className="text-xs text-muted-foreground">{sku.unit} · {sku.sku}</p><p className="mt-1 text-sm font-semibold">{formatCurrency(sku.sellingPrice)}</p>{inCart > 0 && <p className="text-xs font-medium text-primary">{inCart} in cart</p>}</div><Button size="icon" variant={inCart ? "outline" : "default"} aria-label={`Add ${product?.name || sku.sku}`} onClick={() => openQuantity(sku)}><Plus className="h-4 w-4" /></Button></CardContent></Card>; })}</div>
        {filteredSkus.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">No products match your search.</CardContent></Card>}
      </section> : <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Review order</CardTitle><p className="text-sm text-muted-foreground">For {selectedStore?.name} · {cart.totals.itemCount} units</p></div>{cart.items.length > 0 && <Button variant="ghost" size="sm" className="text-destructive" onClick={cart.clear}>Clear</Button>}</CardHeader><CardContent className="space-y-3">{cart.items.length === 0 ? <div className="py-12 text-center"><ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">No items in this order</p><Button className="mt-4" onClick={() => setStep("products")}>Choose products</Button></div> : cart.items.map((item) => <div key={item.skuId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div className="min-w-0"><p className="truncate font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">{item.unit} · {item.sku} · {formatCurrency(item.unitPrice)} each</p></div><QuantityControl compact value={item.quantity} onChange={(quantity) => cart.setQuantity(item.skuId, quantity)} /><div className="flex items-center justify-between sm:w-24 sm:block sm:text-right"><span className="font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</span><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive sm:ml-auto" aria-label={`Remove ${item.productName}`} onClick={() => cart.removeItem(item.skuId)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</CardContent></Card>
        <Card className="h-fit lg:sticky lg:top-4"><CardHeader><CardTitle>Payment & approval</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2"><PaymentChoice active={paymentOption === "PAY_LATER"} icon={<Banknote className="h-4 w-4" />} title="Pay later (Khata)" detail="Creates an outstanding balance." onClick={() => setPaymentOption("PAY_LATER")} /><PaymentChoice active={paymentOption === "PAID_ONLINE"} icon={<FileCheck2 className="h-4 w-4" />} title="Paid online" detail="Requires transaction proof." onClick={() => setPaymentOption("PAID_ONLINE")} /><PaymentChoice active={paymentOption === "PAID_CHEQUE"} icon={<FileCheck2 className="h-4 w-4" />} title="Paid by cheque" detail="Requires cheque proof." onClick={() => setPaymentOption("PAID_CHEQUE")} /></div>{paymentOption !== "PAY_LATER" && <div className="space-y-2 rounded-lg border bg-muted/30 p-3"><label className="text-sm font-medium">Payment proof *</label><Input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} /><Input placeholder={paymentOption === "PAID_CHEQUE" ? "Cheque / bank reference (optional)" : "Transaction reference (optional)"} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />{proofFile && <p className="truncate text-xs text-muted-foreground">Selected: {proofFile.name}</p>}</div>}<label className="block space-y-1.5"><span className="text-sm font-medium">Order comment</span><textarea value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} maxLength={500} rows={3} placeholder="Delivery request or order note (optional)" className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label><div className="space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(cart.totals.subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(cart.totals.tax)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{formatCurrency(cart.totals.total)}</span></div></div><Button size="lg" className="w-full" disabled={placing || cart.items.length === 0 || !selectedDistributor} onClick={placeOrder}>{placing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}{placing ? "Creating order…" : mode === "cf" ? "Place & approve order" : "Create order for OTP"}</Button><p className="text-center text-xs text-muted-foreground">{mode === "cf" ? "This direct order reserves inventory immediately." : "The distributor must verify this order before fulfillment."}</p></CardContent></Card>
      </section>}

      {step === "products" && cart.items.length > 0 && <div className="fixed inset-x-3 bottom-[5.25rem] z-30 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur md:bottom-4 md:left-auto md:right-6 md:w-96"><button type="button" onClick={() => setStep("review")} className="flex w-full items-center justify-between text-left"><span><span className="block font-semibold">{cart.totals.itemCount} units · {formatCurrency(cart.totals.total)}</span><span className="text-xs text-muted-foreground">For {selectedStore?.name}</span></span><span className="inline-flex items-center gap-1 text-sm font-medium text-primary">Review <ArrowRight className="h-4 w-4" /></span></button></div>}

      <Modal open={Boolean(selectedSku)} title="Choose quantity" onClose={() => setSelectedSku(null)} className="max-w-md">{selectedSku && <div className="space-y-5"><div className="rounded-lg border bg-muted/30 p-3"><p className="font-medium">{productsById.get(selectedSku.productId)?.name || selectedSku.sku}</p><p className="text-sm text-muted-foreground">{selectedSku.unit} · {selectedSku.sku} · {formatCurrency(selectedSku.sellingPrice)}</p></div><QuantityControl value={selectedQty} onChange={(quantity) => setSelectedQty(Math.max(1, quantity))} quickQuantities={[10, 25, 50]} /><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setSelectedSku(null)}>Cancel</Button><Button onClick={addSelectedItem}><Plus className="mr-2 h-4 w-4" />Add {selectedQty} to cart</Button></div></div>}</Modal>
    </div>
  );
}

function PaymentChoice({ active, icon, title, detail, onClick }: { active: boolean; icon: React.ReactNode; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border p-3 text-left ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><span className="flex items-center gap-2 font-medium">{icon}{title}</span><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></button>;
}

function AsmPosSkeleton() {
  return <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-12 rounded-lg" /><Skeleton className="h-11" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div></div>;
}
