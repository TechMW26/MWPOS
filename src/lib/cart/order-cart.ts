export interface OrderCartItem {
  skuId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  imageUrl?: string | null;
}

export interface OrderCartTotals {
  lineCount: number;
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
}

export function addCartItem(cart: OrderCartItem[], item: OrderCartItem): OrderCartItem[] {
  const quantity = Math.max(1, Math.floor(item.quantity));
  const existing = cart.find((entry) => entry.skuId === item.skuId);
  if (!existing) return [...cart, { ...item, quantity }];
  return cart.map((entry) => entry.skuId === item.skuId
    ? { ...entry, quantity: entry.quantity + quantity }
    : entry);
}

export function setCartItemQuantity(cart: OrderCartItem[], skuId: string, quantity: number): OrderCartItem[] {
  const safeQuantity = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  if (safeQuantity === 0) return cart.filter((item) => item.skuId !== skuId);
  return cart.map((item) => item.skuId === skuId ? { ...item, quantity: safeQuantity } : item);
}

export function calculateCartTotals(cart: OrderCartItem[]): OrderCartTotals {
  return cart.reduce<OrderCartTotals>((totals, item) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const lineTax = Math.round(lineSubtotal * item.taxRate / 100);
    return {
      lineCount: totals.lineCount + 1,
      itemCount: totals.itemCount + item.quantity,
      subtotal: totals.subtotal + lineSubtotal,
      tax: totals.tax + lineTax,
      total: totals.total + lineSubtotal + lineTax,
    };
  }, { lineCount: 0, itemCount: 0, subtotal: 0, tax: 0, total: 0 });
}

export function isOrderCart(value: unknown): value is OrderCartItem[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const entry = item as Partial<OrderCartItem>;
    return typeof entry.skuId === "string"
      && typeof entry.productId === "string"
      && typeof entry.productName === "string"
      && typeof entry.sku === "string"
      && Number.isFinite(entry.quantity)
      && Number(entry.quantity) > 0
      && Number.isFinite(entry.unitPrice)
      && Number.isFinite(entry.taxRate);
  });
}
