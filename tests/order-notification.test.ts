import { describe, expect, it } from "vitest";
import { buildOrderNotificationBody } from "@/lib/notifications/order-notification";
import type { Distributor, OrderItem } from "@/types/models";

const distributor = { id: "dist-1", name: "Sharma Distribution", ownerUid: "owner-1" } as Distributor;
const items: OrderItem[] = [
  { orderId: "order-12345678", skuId: "sku-1", productId: "product-1", productName: "Premium Rice", sku: "RICE-25", quantity: 10, unitPricePaise: 250000, taxRate: 5, taxPaise: 125000, discountPaise: 0, totalPaise: 2500000 },
  { orderId: "order-12345678", skuId: "sku-2", productId: "product-2", productName: "Cooking Oil", sku: "OIL-5", quantity: 4, unitPricePaise: 90000, taxRate: 5, taxPaise: 18000, discountPaise: 0, totalPaise: 360000 },
];

describe("Firebase order approval notification", () => {
  it("includes item names, quantities, aggregate quantity, and amount", () => {
    const body = buildOrderNotificationBody({ orderId: "order-12345678", distributor, items, totalPaise: 3003000 });
    expect(body).toContain("14 units");
    expect(body).toContain("Premium Rice ×10");
    expect(body).toContain("Cooking Oil ×4");
    expect(body).toContain("Total ₹30,030.00");
    expect(body).toContain("Firebase OTP");
  });
});
