"use client";

import { useEffect, useState } from "react";
import { Box, Minus, PackageOpen, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getPiecesPerBox, MAX_ORDER_PIECES } from "@/lib/cart/order-cart";
import { formatCurrency } from "@/lib/utils";
import type { ProductSku } from "@/types/models";

type PurchaseUnit = "PIECE" | "BOX";

export function SkuQuantitySheet({
  sku,
  productName,
  onClose,
  onAdd,
}: {
  sku: ProductSku | null;
  productName: string;
  onClose: () => void;
  onAdd: (pieces: number) => void;
}) {
  const [purchaseUnit, setPurchaseUnit] = useState<PurchaseUnit>("BOX");
  const [quantity, setQuantity] = useState(1);
  const piecesPerBox = getPiecesPerBox(sku?.piecesPerBox);
  const maxQuantity = purchaseUnit === "BOX"
    ? Math.max(1, Math.floor(MAX_ORDER_PIECES / piecesPerBox))
    : MAX_ORDER_PIECES;
  const pieces = quantity * (purchaseUnit === "BOX" ? piecesPerBox : 1);
  const total = pieces * (sku?.sellingPrice || 0);

  useEffect(() => {
    setPurchaseUnit("BOX");
    setQuantity(1);
  }, [sku?.id]);

  function updateQuantity(next: number) {
    setQuantity(Math.min(maxQuantity, Math.max(1, Math.floor(next) || 1)));
  }

  function choosePurchaseUnit(next: PurchaseUnit) {
    const nextMax = next === "BOX"
      ? Math.max(1, Math.floor(MAX_ORDER_PIECES / piecesPerBox))
      : MAX_ORDER_PIECES;
    setPurchaseUnit(next);
    setQuantity((current) => Math.min(current, nextMax));
  }

  return (
    <Modal open={Boolean(sku)} title="Choose quantity" onClose={onClose} className="max-w-md">
      {sku && <div className="space-y-5">
        <div>
          <p className="font-black text-slate-950">{productName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{sku.sku} · {formatCurrency(sku.sellingPrice)} per piece</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5" role="group" aria-label="Purchase by piece or box">
          <button type="button" aria-pressed={purchaseUnit === "PIECE"} onClick={() => choosePurchaseUnit("PIECE")} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold transition ${purchaseUnit === "PIECE" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>
            <PackageOpen className="h-5 w-5" />Pieces
          </button>
          <button type="button" aria-pressed={purchaseUnit === "BOX"} onClick={() => choosePurchaseUnit("BOX")} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold transition ${purchaseUnit === "BOX" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}>
            <Box className="h-5 w-5" />Boxes
          </button>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Reduce quantity"><Minus className="h-5 w-5" /></Button>
            <label className="min-w-0 flex-1 text-center">
              <span className="block text-xs font-semibold text-muted-foreground">Number of {purchaseUnit === "BOX" ? "boxes" : "pieces"}</span>
              <input type="number" inputMode="numeric" min="1" max={maxQuantity} value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} className="mt-1 w-full bg-transparent text-center text-3xl font-black outline-none" aria-label={`Number of ${purchaseUnit === "BOX" ? "boxes" : "pieces"}`} />
            </label>
            <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-xl" onClick={() => updateQuantity(quantity + 1)} disabled={quantity >= maxQuantity} aria-label="Increase quantity"><Plus className="h-5 w-5" /></Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[5, 10, 25].filter((value) => value <= maxQuantity).map((value) => <button key={value} type="button" onClick={() => updateQuantity(value)} className="h-9 rounded-lg bg-slate-100 text-xs font-bold text-slate-700">{value}</button>)}
          </div>
        </div>

        <div className="rounded-2xl bg-blue-50 p-4 text-sm">
          <div className="flex justify-between gap-3"><span className="text-blue-700">You are buying</span><span className="font-black text-blue-950">{quantity} {purchaseUnit === "BOX" ? (quantity === 1 ? "box" : "boxes") : (quantity === 1 ? "piece" : "pieces")}</span></div>
          {purchaseUnit === "BOX" && <div className="mt-1 flex justify-between gap-3"><span className="text-blue-700">Pieces in total</span><span className="font-bold text-blue-950">{piecesPerBox} × {quantity} = {pieces}</span></div>}
          <div className="mt-2 flex justify-between gap-3 border-t border-blue-200 pt-2"><span className="font-semibold text-blue-800">Product amount</span><span className="text-lg font-black text-blue-950">{formatCurrency(total)}</span></div>
        </div>

        <Button type="button" size="lg" className="h-14 w-full rounded-2xl text-base font-black" onClick={() => onAdd(pieces)}>
          <ShoppingBag className="mr-2 h-5 w-5" />Add to order
        </Button>
      </div>}
    </Modal>
  );
}
