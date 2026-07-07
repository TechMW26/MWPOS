import { describe, it, expect } from "vitest";
import { calculateTax, paiseToRupees, rupeesToPaise, formatCurrency } from "@/lib/utils";

describe("Money utilities", () => {
  it("converts rupees to paise", () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(1.5)).toBe(150);
    expect(rupeesToPaise(0.01)).toBe(1);
  });

  it("converts paise to rupees string", () => {
    expect(paiseToRupees(10000)).toBe("100.00");
    expect(paiseToRupees(150)).toBe("1.50");
    expect(paiseToRupees(1)).toBe("0.01");
  });

  it("formats currency correctly", () => {
    const result = formatCurrency(12345);
    expect(result).toContain("123.45");
  });

  it("calculates tax correctly", () => {
    expect(calculateTax(10000, 18)).toBe(1800); // 18% GST on ₹100
    expect(calculateTax(10000, 0)).toBe(0);
    expect(calculateTax(999, 5)).toBe(50); // rounds correctly
  });
});
