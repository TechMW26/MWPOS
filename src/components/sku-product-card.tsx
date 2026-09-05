"use client";

import { Box, ImageIcon, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductSku } from "@/types/models";

export function SkuProductCard({
  product,
  sku,
  inCart,
  onBuy,
}: {
  product?: Product;
  sku: ProductSku;
  inCart: number;
  onBuy: () => void;
}) {
  const piecesPerBox = Math.max(1, Number(sku.piecesPerBox) || 1);
  const name = product?.name || sku.sku;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border bg-white shadow-sm transition-transform active:scale-[0.99]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50">
        {product?.imageUrl ? (
          <img loading="lazy" decoding="async" src={product.imageUrl} alt={name} className="h-full w-full object-contain p-2" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageIcon className="h-10 w-10" /></div>
        )}
        {inCart > 0 && <span className="absolute right-2 top-2 rounded-full bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-white">{inCart} pcs in cart</span>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-slate-950">{name}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{product?.brand || "Product"} · {sku.sku}</p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <Box className="h-3.5 w-3.5" />1 box = {piecesPerBox} {piecesPerBox === 1 ? "piece" : "pieces"}
        </div>
        <div className="mt-2">
          <p className="text-base font-black text-slate-950">{formatCurrency(sku.sellingPrice)}<span className="text-[10px] font-medium text-muted-foreground"> / piece</span></p>
          <p className="text-[11px] text-muted-foreground">{formatCurrency(sku.sellingPrice * piecesPerBox)} per box</p>
        </div>
        <Button type="button" onClick={onBuy} className="mt-3 h-10 w-full rounded-xl px-2 text-xs font-bold">
          <ShoppingBag className="mr-1.5 h-4 w-4" />Buy now
        </Button>
      </div>
    </article>
  );
}
