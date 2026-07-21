"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowRight, Check, CreditCard, Loader2, Package, Plus, RefreshCw,
  Search, ShoppingCart, Store as StoreIcon, Trash2, WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { QuantityControl } from "@/components/ui/quantity-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderCart } from "@/lib/hooks/use-order-cart";
import { useSound, useToast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductSku, Store } from "@/types/models";

type MarketplaceRole = "DISTRIBUTOR" | "STORE_MANAGER";
type MarketplaceTab = "browse" | "cart";
type MarketplacePayload = { products: Product[]; skus: ProductSku[]; stores: Store[] };

interface MarketplaceProps {
  storeId?: string;
  role: MarketplaceRole;
  initialTab?: MarketplaceTab;
}

const CACHE_TTL_MS = 60_000;

function sanitizePayload(value: unknown): MarketplacePayload {
  const payload = value as Partial<MarketplacePayload> | null;
  return {
    products: Array.isArray(payload?.products) ? payload.products : [],
    skus: Array.isArray(payload?.skus) ? payload.skus : [],
    stores: Array.isArray(payload?.stores) ? payload.stores : [],
  };
}

export function Marketplace({ storeId: propStoreId, role, initialTab = "browse" }: MarketplaceProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { play } = useSound();
  const cart = useOrderCart("distributor");
  const [data, setData] = useState<MarketplacePayload>({ products: [], skus: [], stores: [] });
  const [selectedStore, setSelectedStore] = useState(propStoreId || "");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<MarketplaceTab>(initialTab);
  const [paymentMode, setPaymentMode] = useState<"PAY_LATER" | "UPFRONT">("PAY_LATER");
  const [notes, setNotes] = useState("");
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const endpoint = role === "DISTRIBUTOR"
      ? "/api/marketplace?storeType=DISTRIBUTOR&mine=1"
      : "/api/marketplace?storeType=DISTRIBUTOR";
    const cacheKey = `mwpos:marketplace:${endpoint}`;
    const controller = new AbortController();

    try {
      const cached = JSON.parse(window.sessionStorage.getItem(cacheKey) || "null") as { at?: number; payload?: unknown } | null;
      if (cached?.at && Date.now() - cached.at < CACHE_TTL_MS) {
        setData(sanitizePayload(cached.payload));
        setLoading(false);
      }
    } catch {
      window.sessionStorage.removeItem(cacheKey);
    }

    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to load products");
        const clean = sanitizePayload(payload);
        setData(clean);
        window.sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), payload: clean }));
        setError("");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load products");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reloadKey, role]);

  useEffect(() => {
    if (propStoreId) {
      setSelectedStore(propStoreId);
      return;
    }
    if (!selectedStore && data.stores[0]) setSelectedStore(data.stores[0].id);
  }, [data.stores, propStoreId, selectedStore]);

  const productsById = useMemo(() => new Map(data.products.map((product) => [product.id, product])), [data.products]);
  const cartBySku = useMemo(() => new Map(cart.items.map((item) => [item.skuId, item])), [cart.items]);
  const groupedProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const groups = new Map<string, { product: Product; skus: ProductSku[] }>();
    for (const sku of data.skus) {
      const product = productsById.get(sku.productId);
      if (!product) continue;
      const searchable = `${product.name} ${product.brand} ${sku.sku} ${sku.unit}`.toLowerCase();
      if (query && !searchable.includes(query)) continue;
      const group = groups.get(product.id) || { product, skus: [] };
      group.skus.push(sku);
      groups.set(product.id, group);
    }
    return Array.from(groups.values());
  }, [data.skus, productsById, search]);

  const storeName = data.stores.find((store) => store.id === selectedStore)?.name || "";

  function openQuantity(sku: ProductSku) {
    setSelectedSku(sku);
    setSelectedQty(Math.max(1, cartBySku.get(sku.id)?.quantity || 1));
  }

  function addSelectedItem() {
    if (!selectedSku) return;
    const product = productsById.get(selectedSku.productId);
    cart.addItem({
      skuId: selectedSku.id,
      productId: selectedSku.productId,
      productName: product?.name || selectedSku.sku,
      sku: selectedSku.sku,
      unit: selectedSku.unit,
      quantity: selectedQty,
      unitPrice: Math.max(0, Math.round(Number(selectedSku.sellingPrice) || 0)),
      taxRate: Math.min(100, Math.max(0, Number(selectedSku.taxRate) || 0)),
      imageUrl: product?.imageUrl || null,
    });
    setSelectedSku(null);
    addToast({ title: "Cart updated", message: `${selectedQty} × ${product?.name || selectedSku.sku} added.`, type: "success" });
  }

  async function placeOrder() {
    if (!selectedStore || cart.items.length === 0) return;
    setPlacing(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distributorId: selectedStore,
          paymentMode,
          notes: notes.trim() || null,
          items: cart.items.map((item) => ({ skuId: item.skuId, productId: item.productId, quantity: item.quantity })),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to place order");
      const orderId = payload.orderId || payload.id;
      play("order");
      cart.clear();
      setNotes("");
      addToast({ title: "Order placed", message: `Order #${String(orderId).slice(0, 8)} is ready to track.`, type: "success" });
      if (orderId) router.push(`/storefront/orders/${orderId}`);
      else router.push("/storefront/orders");
    } catch (submitError) {
      addToast({ title: "Order not placed", message: submitError instanceof Error ? submitError.message : "Please try again.", type: "error" });
    } finally {
      setPlacing(false);
    }
  }

  if (!cart.ready || (loading && data.products.length === 0)) return <MarketplaceSkeleton />;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Create an order</h1>
          <p className="text-sm text-muted-foreground">Choose products, review quantities, then confirm payment.</p>
        </div>
        {role === "DISTRIBUTOR" ? (
          storeName && <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5"><StoreIcon className="h-3.5 w-3.5" />{storeName}</Badge>
        ) : (
          <select aria-label="Order distributor" className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>
            {data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded-lg border bg-card text-sm">
        <button type="button" onClick={() => setActiveTab("browse")} className={`flex min-h-12 items-center justify-center gap-2 px-3 ${activeTab === "browse" ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          <Package className="h-4 w-4" /><span className="hidden sm:inline">1. </span>Products
        </button>
        <button type="button" onClick={() => setActiveTab("cart")} className={`flex min-h-12 items-center justify-center gap-2 border-x px-3 ${activeTab === "cart" ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          <ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">2. </span>Review <Badge variant="outline" className={activeTab === "cart" ? "border-primary-foreground/40 text-primary-foreground" : ""}>{cart.totals.itemCount}</Badge>
        </button>
        <button type="button" onClick={() => cart.items.length > 0 && setActiveTab("cart")} className={`flex min-h-12 items-center justify-center gap-2 px-3 ${cart.items.length ? "text-muted-foreground hover:bg-muted" : "cursor-not-allowed text-muted-foreground/50"}`}>
          <Check className="h-4 w-4" /><span className="hidden sm:inline">3. </span>Confirm
        </button>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" />{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => { setLoading(true); setReloadKey((value) => value + 1); }}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
        </div>
      )}

      {activeTab === "browse" ? (
        <section className="space-y-4" aria-label="Products">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search products" className="h-11 pl-10" placeholder="Search product, brand, SKU, or pack size…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groupedProducts.map(({ product, skus }) => (
              <Card key={product.id} className="overflow-hidden">
                <CardHeader className="flex-row items-start gap-3 space-y-0 pb-3">
                  {product.imageUrl ? <img loading="lazy" decoding="async" src={product.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                  <div className="min-w-0"><CardTitle className="line-clamp-2 text-base">{product.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{product.brand || "General"} · {skus.length} option{skus.length === 1 ? "" : "s"}</p></div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {skus.map((sku) => {
                    const inCart = cartBySku.get(sku.id)?.quantity || 0;
                    return <div key={sku.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{sku.unit}</p><p className="text-xs text-muted-foreground">{sku.sku} · {formatCurrency(sku.sellingPrice)}</p>{inCart > 0 && <p className="mt-1 text-xs font-medium text-primary">{inCart} currently in cart</p>}</div>
                      <Button type="button" size="sm" variant={inCart ? "outline" : "default"} onClick={() => openQuantity(sku)}><Plus className="mr-1.5 h-3.5 w-3.5" />{inCart ? "Add more" : "Add"}</Button>
                    </div>;
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
          {groupedProducts.length === 0 && <EmptyProducts search={search} />}
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]" aria-label="Review order">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Review items</CardTitle><p className="text-sm text-muted-foreground">{cart.totals.itemCount} units across {cart.totals.lineCount} products</p></div>{cart.items.length > 0 && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={cart.clear}>Clear</Button>}</CardHeader>
            <CardContent className="space-y-3">
              {cart.items.length === 0 ? <div className="py-12 text-center"><ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">Your cart is empty</p><p className="mt-1 text-sm text-muted-foreground">Add products to start an order.</p><Button className="mt-4" onClick={() => setActiveTab("browse")}>Browse products</Button></div> : cart.items.map((item) => (
                <div key={item.skuId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div className="min-w-0"><p className="truncate font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">{item.unit} · {item.sku} · {formatCurrency(item.unitPrice)} each</p></div>
                  <QuantityControl compact value={item.quantity} onChange={(quantity) => cart.setQuantity(item.skuId, quantity)} />
                  <div className="flex items-center justify-between gap-2 sm:block sm:w-24 sm:text-right"><span className="font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</span><Button aria-label={`Remove ${item.productName}`} type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive sm:ml-auto sm:mt-1" onClick={() => cart.removeItem(item.skuId)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              ))}
              {cart.items.length > 0 && <Button type="button" variant="outline" onClick={() => setActiveTab("browse")}><Plus className="mr-2 h-4 w-4" />Add another product</Button>}
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader><CardTitle>Payment & total</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <button type="button" onClick={() => setPaymentMode("PAY_LATER")} className={`w-full rounded-lg border p-3 text-left ${paymentMode === "PAY_LATER" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><span className="flex items-center gap-2 font-medium"><WalletCards className="h-4 w-4" />Pay later (Khata)</span><span className="mt-1 block text-xs text-muted-foreground">Amount is added to your outstanding balance.</span></button>
              <button type="button" onClick={() => setPaymentMode("UPFRONT")} className={`w-full rounded-lg border p-3 text-left ${paymentMode === "UPFRONT" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40"}`}><span className="flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4" />Pay upfront</span><span className="mt-1 block text-xs text-muted-foreground">Payment stays pending until confirmed.</span></button>
              <Input aria-label="Order notes" placeholder="Order notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
              <div className="space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(cart.totals.subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(cart.totals.tax)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Order total</span><span>{formatCurrency(cart.totals.total)}</span></div></div>
              <Button className="w-full" size="lg" disabled={placing || cart.items.length === 0 || !selectedStore} onClick={placeOrder}>{placing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}{placing ? "Placing order…" : "Confirm order"}</Button>
              <p className="text-center text-xs text-muted-foreground">Prices and tax are verified again when the order is submitted.</p>
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === "browse" && cart.items.length > 0 && <div className="fixed inset-x-3 bottom-[5.25rem] z-30 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur md:bottom-4 md:left-auto md:right-6 md:w-96"><button type="button" onClick={() => setActiveTab("cart")} className="flex w-full items-center justify-between gap-3 text-left"><span><span className="block font-semibold">{cart.totals.itemCount} units · {formatCurrency(cart.totals.total)}</span><span className="text-xs text-muted-foreground">Cart saved automatically</span></span><span className="inline-flex items-center gap-1 text-sm font-medium text-primary">Review cart <ArrowRight className="h-4 w-4" /></span></button></div>}

      <Modal open={Boolean(selectedSku)} title="Choose quantity" onClose={() => setSelectedSku(null)} className="max-w-md">
        {selectedSku && <div className="space-y-5"><div className="rounded-lg border bg-muted/30 p-3"><p className="font-medium">{productsById.get(selectedSku.productId)?.name || selectedSku.sku}</p><p className="text-sm text-muted-foreground">{selectedSku.unit} · {selectedSku.sku} · {formatCurrency(selectedSku.sellingPrice)}</p></div><div className="space-y-2"><label className="text-sm font-medium">Units to add</label><QuantityControl value={selectedQty} onChange={(quantity) => setSelectedQty(Math.max(1, quantity))} quickQuantities={[10, 25, 50]} /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setSelectedSku(null)}>Cancel</Button><Button type="button" onClick={addSelectedItem}><Plus className="mr-2 h-4 w-4" />Add {selectedQty} to cart</Button></div></div>}
      </Modal>
    </div>
  );
}

function MarketplaceSkeleton() {
  return <div className="space-y-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-12 rounded-lg" /><Skeleton className="h-11" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-52 rounded-xl" />)}</div></div>;
}

function EmptyProducts({ search }: { search: string }) {
  return <Card><CardContent className="py-14 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">{search ? "No matching products" : "No products available"}</p><p className="mt-1 text-sm text-muted-foreground">{search ? "Try a product name, brand, SKU, or pack size." : "Active catalog products will appear here."}</p></CardContent></Card>;
}
