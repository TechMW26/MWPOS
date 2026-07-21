import { describe, expect, it } from "vitest";
import { addCartItem, calculateCartTotals, setCartItemQuantity, type OrderCartItem } from "@/lib/cart/order-cart";

const item: OrderCartItem = {
  skuId: "sku-1", productId: "product-1", productName: "Product", sku: "P-1", unit: "box",
  quantity: 2, unitPrice: 1000, taxRate: 18,
};

describe("order cart", () => {
  it("merges repeated SKUs", () => {
    expect(addCartItem([item], { ...item, quantity: 3 })[0]?.quantity).toBe(5);
  });

  it("removes a line when quantity reaches zero", () => {
    expect(setCartItemQuantity([item], item.skuId, 0)).toEqual([]);
  });

  it("calculates item, subtotal, tax, and grand totals", () => {
    expect(calculateCartTotals([item])).toEqual({ lineCount: 1, itemCount: 2, subtotal: 2000, tax: 360, total: 2360 });
  });
});
