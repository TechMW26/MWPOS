// ============================================================
// MW-POS Database Schema Types
// Maps to Firebase RTDB paths. All money in integer paise.
// ============================================================

import type {
  UserRole,
  ApprovalStatus,
  StoreType,
  OrderStatus,
  OtpVerificationStatus,
  PaymentMethod,
  OrderPaymentMode,
  OrderPaymentProofType,
  PaymentStatus,
  InventoryMovementType,
  RegisterSessionStatus,
  AuditAction,
  TaxType,
} from "./index";

// ─── User ────────────────────────────────────────────────────
export interface User {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: UserRole;
  approvalStatus: ApprovalStatus | null; // for ASM
  isActive: boolean;
  avatarUrl: string | null;
  districtId: string | null; // for ASM — assigned district
  cfId: string | null; // for ASM — assigned C&F
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

// ─── User Distributor Membership ─────────────────────────────
export interface UserDistributorMembership {
  uid: string;
  distributorId: string;
  role: string; // "OWNER" | "STAFF" | etc.
  joinedAt: string;
}

// ─── District ────────────────────────────────────────────────
export interface District {
  id: string;
  name: string;
  city: string;
  state: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Distributor ─────────────────────────────────────────────
export interface Distributor {
  id: string;
  name: string;
  districtId: string;
  ownerUid: string | null;
  logoUrl: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string | null;
  gstin: string | null;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Store (Distribution Center) ─────────────────────────────
export interface Store {
  id: string;
  name: string;
  type: StoreType;
  districtId?: string | null;
  ownerUid: string | null;
  managerUid: string | null;
  logoUrl: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string | null;
  gstin: string | null;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Product ─────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Product SKU ─────────────────────────────────────────────
export interface ProductSku {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  unit: string; // "piece", "kg", "litre", "box"
  mrp: number; // paise
  sellingPrice: number; // paise - base before tax
  costPrice: number; // paise
  taxType: TaxType;
  taxRate: number; // percentage as integer, e.g. 18 = 18%
  hsnCode: string | null;
  weightGrams: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Store Catalog Entry ─────────────────────────────────────
export interface StoreCatalogEntry {
  productId: string;
  storeId: string;
  isAvailable: boolean;
  addedBy: string;
  addedAt: string;
}

// ─── Price List ──────────────────────────────────────────────
export interface PriceList {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Store Price List ────────────────────────────────────────
export interface StorePriceList {
  storeId: string;
  priceListId: string;
  assignedAt: string;
  assignedBy: string;
}

// ─── Price List Entry ────────────────────────────────────────
export interface PriceListEntry {
  priceListId: string;
  skuId: string;
  sellingPrice: number; // paise
  mrp: number; // paise
}

// ─── Inventory Balance ───────────────────────────────────────
export interface InventoryBalance {
  storeId: string;
  skuId: string;
  onHand: number; // physical quantity
  reserved: number; // allocated to orders
  available: number; // onHand - reserved
  reorderThreshold: number;
  reorderQuantity: number;
  lastCountedAt: string | null;
  updatedAt: string;
}

// ─── Inventory Ledger Entry ──────────────────────────────────
export interface InventoryLedgerEntry {
  movementId: string;
  storeId: string;
  skuId: string;
  movementType: InventoryMovementType;
  quantity: number; // positive for in, negative for out
  onHandBefore: number;
  onHandAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  referenceType: string; // "ORDER", "SALE", "RETURN", "ADJUSTMENT"
  referenceId: string;
  idempotencyKey: string;
  performedBy: string;
  notes: string | null;
  createdAt: string;
}

// ─── Cart ────────────────────────────────────────────────────
export interface Cart {
  id: string;
  uid: string;
  storeId: string;
  status: "ACTIVE" | "CONVERTED" | "ABANDONED";
  createdAt: string;
  updatedAt: string;
}

// ─── Cart Item ───────────────────────────────────────────────
export interface CartItem {
  cartId: string;
  skuId: string;
  productId: string;
  quantity: number;
  unitPrice: number; // snapshot at add time (paise)
  addedAt: string;
}

// ─── Order ───────────────────────────────────────────────────
export interface Order {
  id: string;
  distributorId: string; // destination distributor
  sourceStoreId: string; // distribution store (C&F's warehouse)
  asmId: string; // ASM who placed the order
  placedByUid: string;
  otpStatus: OtpVerificationStatus;
  otpRequestId: string | null;
  otpExpiresAt: string | null;
  otpChannel: string | null; // "email" | "whatsapp"
  otpDestination: string | null;
  cfId: string | null; // assigned C&F for approval
  cfApprovalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  paymentMode: OrderPaymentMode;
  paymentProvider: "RAZORPAY" | "KHATA" | "ONLINE" | "CHEQUE" | null;
  paymentProofType: OrderPaymentProofType | null;
  paymentProofUrl: string | null;
  paymentProofFileName: string | null;
  paymentProofMimeType: string | null;
  paymentReference: string | null;
  paymentStatus: PaymentStatus;
  paidAmountPaise: number;
  khataEntryId: string | null;
  status: OrderStatus;
  subtotalPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  notes: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: Record<string, OrderStatusChange>;
}

// ─── Khata Ledger Entry ─────────────────────────────────────
export interface KhataLedgerEntry {
  id: string;
  storeId: string;
  orderId: string;
  type: "DEBIT" | "CREDIT";
  amountPaise: number;
  balanceAfterPaise: number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

// ─── Order Item ──────────────────────────────────────────────
export interface OrderItem {
  orderId: string;
  skuId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPricePaise: number; // snapshot
  taxRate: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
}

// ─── Order Status Change ─────────────────────────────────────
export interface OrderStatusChange {
  from: OrderStatus | null;
  to: OrderStatus;
  changedBy: string;
  changedAt: string;
  notes: string | null;
}

// ─── Order OTP Verification Request ──────────────────────────
export interface OrderOtpRequest {
  id: string;
  orderId: string;
  distributorId: string;
  distributorPhone: string | null;
  distributorEmail: string | null;
  requestedByUid: string;
  channels: string[]; // ["email", "whatsapp"]
  hashedOtp: string;
  status: OtpVerificationStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  createdAt: string;
  verifiedAt: string | null;
}

// ─── C&F Assignment ──────────────────────────────────────────
export interface CfAssignment {
  id: string;
  cfUid: string;
  asmUid: string;
  districtId: string | null;
  assignedBy: string;
  createdAt: string;
}

// ─── Fulfillment ─────────────────────────────────────────────
export interface Fulfillment {
  orderId: string;
  status: "PENDING" | "PICKING" | "PACKED" | "SHIPPED";
  pickedBy: string | null;
  packedBy: string | null;
  shippedBy: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Stock Reservation ───────────────────────────────────────
export interface StockReservation {
  storeId: string;
  skuId: string;
  orderId: string;
  quantity: number;
  reservedAt: string;
  releasedAt: string | null;
}

// ─── Register ────────────────────────────────────────────────
export interface Register {
  id: string;
  storeId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Register Session ────────────────────────────────────────
export interface RegisterSession {
  id: string;
  registerId: string;
  storeId: string;
  openedBy: string;
  openingFloatPaise: number; // starting cash
  expectedCashPaise: number;
  actualCashPaise: number | null;
  variancePaise: number | null;
  status: RegisterSessionStatus;
  openedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  notes: string | null;
}

// ─── Sale ────────────────────────────────────────────────────
export interface Sale {
  id: string;
  storeId: string;
  registerSessionId: string;
  customerId: string | null; // optional walk-in
  subtotalPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  idempotencyKey: string;
  createdAt: string;
  createdBy: string;
}

// ─── Sale Item ───────────────────────────────────────────────
export interface SaleItem {
  saleId: string;
  skuId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  taxRate: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
}

// ─── Payment ─────────────────────────────────────────────────
export interface Payment {
  id: string;
  saleId: string | null;
  orderId: string | null;
  amountPaise: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null; // transaction ID
  paidAt: string;
  customerId: string | null;
}

// ─── Return ──────────────────────────────────────────────────
export interface Return {
  id: string;
  saleId: string;
  storeId: string;
  totalPaise: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
  idempotencyKey: string;
  createdAt: string;
  createdBy: string;
}

// ─── Return Item ─────────────────────────────────────────────
export interface ReturnItem {
  returnId: string;
  saleItemSkuId: string;
  quantity: number;
  refundPaise: number;
}

// ─── OTP Challenge ───────────────────────────────────────────
export interface OtpChallenge {
  id: string;
  destination: string;
  channel: "email" | "phone";
  hashedCode: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  createdAt: string;
  verifiedAt: string | null;
  ipAddress: string;
}

// ─── Notification ────────────────────────────────────────────
export interface Notification {
  id: string;
  uid: string;
  title: string;
  body: string;
  type: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  read: boolean;
  link: string | null;
  createdAt: string;
}

// ─── Audit Log ───────────────────────────────────────────────
export interface AuditLog {
  id: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ─── System Settings ─────────────────────────────────────────
export interface SystemSettings {
  appName: string;
  currency: string;
  defaultTaxRate: number;
  lowStockThreshold: number;
  otpExpiryMinutes: number;
  otpResendCooldownSeconds: number;
  maxOtpAttempts: number;
  enableAppCheck: boolean;
}

// ─── Session ─────────────────────────────────────────────────
export interface SessionData {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: UserRole;
  storeIds: string[];
  distributorIds: string[];
  districtId: string | null; // for ASM
  cfId: string | null; // for ASM's assigned C&F
  approvalStatus: ApprovalStatus | null;
}
