// ============================================================
// MW-POS Core Type Definitions
// All monetary values in integer PAISE (1 INR = 100 paise)
// All timestamps as ISO 8601 UTC strings or server timestamps
// ============================================================

// ─── Roles ───────────────────────────────────────────────────
export type UserRole = "SUPERADMIN" | "ADMIN" | "ASM" | "C_AND_F" | "DISTRIBUTOR";

// ─── Approval Status ─────────────────────────────────────────
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

// ─── Store Types ─────────────────────────────────────────────
export type StoreType = "DISTRIBUTION" | "DISTRIBUTOR";

// ─── Order Statuses ──────────────────────────────────────────
export type OrderStatus =
  | "DRAFT"
  | "PENDING_OTP"
  | "OTP_VERIFIED"
  | "PENDING_CF_APPROVAL"
  | "CF_APPROVED"
  | "ALLOCATED"
  | "PICKING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REJECTED"
  | "CF_REJECTED";

// ─── OTP Verification Status ─────────────────────────────────
export type OtpVerificationStatus = "PENDING" | "VERIFIED" | "EXPIRED" | "FAILED";

// ─── Payment Methods ─────────────────────────────────────────
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";
export type OrderPaymentMode = "UPFRONT" | "PAY_LATER";
export type OrderPaymentProofType = "ONLINE" | "CHEQUE";

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
  | "DISTRIBUTOR_CREATED"
  | "DISTRIBUTOR_UPDATED"
  | "DISTRICT_CREATED"
  | "DISTRICT_UPDATED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "INVENTORY_MOVEMENT"
  | "ORDER_CREATED"
  | "ORDER_STATUS_CHANGE"
  | "OTP_SENT"
  | "OTP_VERIFIED"
  | "CF_APPROVED"
  | "CF_REJECTED"
  | "SALE_COMPLETED"
  | "RETURN_PROCESSED"
  | "PAYMENT_RECORDED"
  | "ROLE_CHANGED"
  | "APPROVAL_CHANGED"
  | "SETTINGS_CHANGED";

// ─── Tax Type ────────────────────────────────────────────────
export type TaxType = "GST" | "VAT" | "NONE";
