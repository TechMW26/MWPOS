"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addCartItem,
  calculateCartTotals,
  isOrderCart,
  setCartItemQuantity,
  type OrderCartItem,
} from "@/lib/cart/order-cart";

export function useOrderCart(scope: "distributor" | "asm" | "cf") {
  const storageKey = `mwpos:order-cart:v1:${scope}`;
  const [items, setItems] = useState<OrderCartItem[]>([]);
  const [ready, setReady] = useState(false);

  const readStoredCart = useCallback(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      return isOrderCart(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  useEffect(() => {
    setItems(readStoredCart());
    setReady(true);
    const sync = () => setItems(readStoredCart());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [readStoredCart, storageKey]);

  const commit = useCallback((update: (current: OrderCartItem[]) => OrderCartItem[]) => {
    setItems((current) => {
      const next = update(current);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  return {
    items,
    ready,
    totals: useMemo(() => calculateCartTotals(items), [items]),
    addItem: useCallback((item: OrderCartItem) => commit((current) => addCartItem(current, item)), [commit]),
    setQuantity: useCallback((skuId: string, quantity: number) => commit((current) => setCartItemQuantity(current, skuId, quantity)), [commit]),
    removeItem: useCallback((skuId: string) => commit((current) => current.filter((item) => item.skuId !== skuId)), [commit]),
    clear: useCallback(() => commit(() => []), [commit]),
  };
}
