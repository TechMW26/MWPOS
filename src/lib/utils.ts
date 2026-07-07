// ============================================================
// Utility Functions
// ============================================================

/**
 * Convert paise (integer) to rupees (string) for display.
 * E.g., 12345 → "123.45"
 */
export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

/**
 * Convert rupees (number/string) to paise (integer).
 * E.g., 123.45 → 12345
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Format paise as INR currency string.
 * E.g., 12345 → "₹123.45"
 */
export function formatCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Calculate tax amount from base amount and tax rate.
 * Both inputs in paise, result in paise.
 */
export function calculateTax(basePaise: number, taxRatePercent: number): number {
  return Math.round(basePaise * taxRatePercent / 100);
}

/**
 * Validate that a value is a positive integer.
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Mask a string for safe logging (show first 3 and last 2 chars).
 */
export function maskSensitive(value: string): string {
  if (value.length <= 5) return "***";
  return value.slice(0, 3) + "***" + value.slice(-2);
}

/**
 * Sleep/delay utility.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return "127.0.0.1";
}

/**
 * Generate a random 6-digit OTP code.
 */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Safe JSON parse.
 */
export function safeJsonParse<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

/**
 * Check if running on server.
 */
export const isServer = typeof window === "undefined";

/**
 * Truncate text for display.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
