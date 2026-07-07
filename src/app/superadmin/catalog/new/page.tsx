"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Package } from "lucide-react";
import Link from "next/link";

interface SkuForm {
  key: string;
  id?: string;
  sku: string;
  barcode: string;
  unit: string;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  taxType: string;
  taxRate: number;
}

function emptySku(): SkuForm {
  return { key: crypto.randomUUID(), sku: "", barcode: "", unit: "piece", mrp: 0, sellingPrice: 0, costPrice: 0, taxType: "GST", taxRate: 5 };
}

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [product, setProduct] = useState({ name: "", description: "", brand: "", categoryId: "cat-grocery", imageUrl: "" });
  const [skus, setSkus] = useState<SkuForm[]>([emptySku()]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  const isEdit = !!editId;

  // Load existing product + SKUs for edit mode
  useEffect(() => {
    if (!editId) { setLoadingEdit(false); return; }
    (async () => {
      try {
        const [prodRes, skusRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/skus"),
        ]);
        const products = await prodRes.json();
        const allSkus = await skusRes.json();
        const found = (Array.isArray(products) ? products : []).find((p: any) => p.id === editId);
        if (found) {
          setProduct({ name: found.name || "", description: found.description || "", brand: found.brand || "", categoryId: found.categoryId || "cat-grocery", imageUrl: found.imageUrl || "" });
          const productSkus = (Array.isArray(allSkus) ? allSkus : []).filter((s: any) => s.productId === editId);
          if (productSkus.length > 0) {
            setSkus(productSkus.map((s: any) => ({ key: crypto.randomUUID(), id: s.id, sku: s.sku || "", barcode: s.barcode || "", unit: s.unit || "piece", mrp: s.mrp || 0, sellingPrice: s.sellingPrice || 0, costPrice: s.costPrice || 0, taxType: s.taxType || "GST", taxRate: s.taxRate ?? 5 })));
          }
        } else {
          setError("Product not found");
        }
      } catch { setError("Failed to load product"); }
      finally { setLoadingEdit(false); }
    })();
  }, [editId]);

  function addSku() { setSkus([...skus, emptySku()]); }
  function updateSku(key: string, field: keyof SkuForm, value: string | number) {
    setSkus(skus.map(s => s.key === key ? { ...s, [field]: value } : s));
  }
  function removeSku(key: string) { if (skus.length <= 1) return; setSkus(skus.filter(s => s.key !== key)); }

  async function handleImageUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setProduct({ ...product, imageUrl: url });
    } catch { setError("Image upload failed"); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    if (!product.name || !product.brand) { setError("Product name and brand are required."); return; }
    const validSkus = skus.filter(s => s.sku && s.sellingPrice > 0);
    if (validSkus.length === 0) { setError("At least one SKU with a code and selling price is required."); return; }

    setSaving(true); setError("");
    try {
      let productId: string;

      if (isEdit) {
        // Update existing product
        const prodRes = await fetch("/api/products", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, ...product }),
        });
        if (!prodRes.ok) throw new Error("Failed to update product");
        productId = editId;
      } else {
        // Create new product
        const prodRes = await fetch("/api/products", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(product),
        });
        if (!prodRes.ok) throw new Error("Failed to create product");
        const newProduct = await prodRes.json();
        productId = newProduct.id;
      }

      // Save all SKUs in parallel
      await Promise.all(validSkus.map(sku =>
        fetch("/api/skus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(sku.id ? { id: sku.id } : {}), productId, sku: sku.sku, barcode: sku.barcode || null, unit: sku.unit, mrp: sku.mrp, sellingPrice: sku.sellingPrice, costPrice: sku.costPrice, taxType: sku.taxType, taxRate: sku.taxRate }),
        })
      ));

      router.push("/superadmin/catalog");
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading product...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/superadmin/catalog" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Product" : "New Product"}</h1>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>
      )}

      {/* Product Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Product Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">Product Name *</label>
            <Input placeholder="e.g. Organic Honey 500g" value={product.name}
              onChange={e => setProduct({ ...product, name: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">Product Image</label>
            <Input type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files?.[0] ?? null)} disabled={uploading} />
            {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
            {product.imageUrl && (
              <img src={product.imageUrl} alt="Product preview" className="mt-3 h-28 w-28 rounded-md border object-cover" />
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Brand *</label>
            <Input placeholder="e.g. NatureFresh" value={product.brand}
              onChange={e => setProduct({ ...product, brand: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Category</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={product.categoryId}
              onChange={e => setProduct({ ...product, categoryId: e.target.value })}>
              <option value="cat-grocery">Grocery</option>
              <option value="cat-beverages">Beverages</option>
              <option value="cat-dairy">Dairy</option>
              <option value="cat-snacks">Snacks</option>
              <option value="cat-household">Household</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">Description</label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Brief product description..." value={product.description}
              onChange={e => setProduct({ ...product, description: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* SKUs Section */}
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">SKUs ({skus.length})</h2>
        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={addSku}>
          <Plus className="h-4 w-4 mr-1" />Add SKU
        </Button>
      </div>

      <div className="space-y-3">
        {skus.map((sku, idx) => (
          <Card key={sku.key} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">SKU #{idx + 1}</Badge>
                {skus.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-destructive sm:w-auto" onClick={() => removeSku(sku.key)}>
                    <Trash2 className="h-3 w-3 mr-1" />Remove
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">SKU Code *</label>
                  <Input placeholder="e.g. WF-5KG" value={sku.sku}
                    onChange={e => updateSku(sku.key, "sku", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Barcode</label>
                  <Input placeholder="e.g. 8901001001001" value={sku.barcode}
                    onChange={e => updateSku(sku.key, "barcode", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Unit</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={sku.unit} onChange={e => updateSku(sku.key, "unit", e.target.value)}>
                    <option value="piece">Piece</option>
                    <option value="kg">Kilogram</option>
                    <option value="gram">Gram</option>
                    <option value="litre">Litre</option>
                    <option value="ml">Millilitre</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Tax Type</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={sku.taxType} onChange={e => updateSku(sku.key, "taxType", e.target.value)}>
                    <option value="GST">GST</option>
                    <option value="VAT">VAT</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Tax Rate (%)</label>
                  <Input type="number" placeholder="5" value={sku.taxRate || ""}
                    onChange={e => updateSku(sku.key, "taxRate", Number(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Cost Price (paise) *</label>
                  <Input type="number" placeholder="e.g. 28000" value={sku.costPrice || ""}
                    onChange={e => updateSku(sku.key, "costPrice", Number(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Selling Price (paise) *</label>
                  <Input type="number" placeholder="e.g. 32000" value={sku.sellingPrice || ""}
                    onChange={e => updateSku(sku.key, "sellingPrice", Number(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">MRP (paise)</label>
                  <Input type="number" placeholder="e.g. 35000" value={sku.mrp || ""}
                    onChange={e => updateSku(sku.key, "mrp", Number(e.target.value) || 0)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save */}
      <div className="grid gap-3 border-t pt-4 sm:flex sm:justify-end">
        <Link href="/superadmin/catalog" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto" variant="outline">Cancel</Button>
        </Link>
        <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving || uploading} size="lg">
          {(saving || uploading) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : uploading ? "Uploading..." : isEdit ? "Update Product" : "Save Product"}
        </Button>
      </div>
    </div>
  );
}
