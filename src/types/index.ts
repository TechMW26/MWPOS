// ============================================================
// MW-POS Core Type Definitions
// All monetary values in integer PAISE (1 INR = 100 paise)
// All timestamps as ISO 8601 UTC strings or server timestamps
// ============================================================

// ─── Roles ───────────────────────────────────────────────────
export type UserRole = "SUPERADMIN" | "ADMIN" | "STORE_MANAGER" | "CUSTOMER";

// ─── Approval Status ─────────────────────────────────────────
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

// ─── Store Types ─────────────────────────────────────────────
export type StoreType = "DISTRIBUTION" | "CUSTOMER";

// ─── Order Statuses ──────────────────────────────────────────
export type OrderStatus =
  | "DRAFT"
  | "PENDING_OWNER_APPROVAL"
  | "SUBMITTED"
  | "APPROVED"
  | "ALLOCATED"
  | "PICKING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REJECTED";

// ─── Payment Methods ─────────────────────────────────────────
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";
export type OrderPaymentMode = "UPFRONT" | "PAY_LATER";

// ─── Payment Status ──────────────────────────────────────────
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CREDIT_DUE";

// ─── Inventory Movement Types ────────────────────────────────
export type InventoryMovementType =
  | "INITIAL"
  | "PURCHASE"
  | "ORDER_ALLOCATION"
  | "ORDER_FULFILLMENT"
  | "SALE"
  | "RETURN"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "WASTAGE";

// ─── Register Session Status ─────────────────────────────────
export type RegisterSessionStatus = "OPEN" | "CLOSED";

// ─── Audit Action ────────────────────────────────────────────
export type AuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "STORE_CREATED"
  | "STORE_UPDATED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "INVENTORY_MOVEMENT"
  | "ORDER_CREATED"
  | "ORDER_STATUS_CHANGE"
  | "SALE_COMPLETED"
  | "RETURN_PROCESSED"
  | "PAYMENT_RECORDED"
  | "ROLE_CHANGED"
  | "APPROVAL_CHANGED"
  | "SETTINGS_CHANGED";

// ─── Tax Type ────────────────────────────────────────────────
export type TaxType = "GST" | "VAT" | "NONE";
