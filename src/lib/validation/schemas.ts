import { z } from "zod";

const optionalText = z.preprocess((value) => value === "" ? null : value, z.string().nullable().optional());
const optionalEmail = z.preprocess((value) => value === "" ? null : value, z.string().email().nullable().optional());

// ─── Auth Schemas ────────────────────────────────────────────

export const requestOtpSchema = z.object({
  channel: z.enum(["email", "phone"]),
  destination: z.string().min(3).max(255),
});

export const verifyOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().length(6),
});

// ─── Store Schemas ───────────────────────────────────────────

export const createStoreSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(["DISTRIBUTION", "DISTRIBUTOR"]),
  districtId: z.string().min(1).nullable().optional(),
  address: z.string().min(5).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().min(5).max(10),
  phone: z.string().min(10).max(15),
  email: optionalEmail,
  gstin: optionalText,
  ownerUid: optionalText,
  ownerEmail: optionalEmail,
  ownerPhone: optionalText,
  ownerName: optionalText,
  logoUrl: z.string().nullable().optional(),
});

// ─── Product Schemas ─────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).default(""),
  categoryId: z.string().min(1),
  brand: z.string().min(1).max(100),
  imageUrl: z.string().nullable().optional(),
});

export const createSkuSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(100).nullable().optional(),
  unit: z.string().min(1).max(20),
  mrp: z.number().int().positive("MRP must be positive"),
  sellingPrice: z.number().int().positive("Selling price must be positive"),
  costPrice: z.number().int().positive("Cost price must be positive"),
  taxType: z.enum(["GST", "VAT", "NONE"]),
  taxRate: z.number().int().min(0).max(100),
  hsnCode: z.string().max(20).nullable().optional(),
  weightGrams: z.number().positive().nullable().optional(),
});

// ─── Inventory Schemas ───────────────────────────────────────

export const inventoryMovementSchema = z.object({
  storeId: z.string().min(1),
  skuId: z.string().min(1),
  quantity: z.number().int(),
  movementType: z.enum([
    "INITIAL",
    "PURCHASE",
    "ADJUSTMENT",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "WASTAGE",
  ]),
  referenceType: z.string().min(1),
  referenceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
});

// ─── Order Schemas ───────────────────────────────────────────

export const createOrderSchema = z.object({
  distributorId: z.string().min(1).optional(),
  paymentMode: z.enum(["UPFRONT", "PAY_LATER"]).default("PAY_LATER"),
  paymentProofType: z.enum(["ONLINE", "CHEQUE"]).nullable().optional(),
  paymentProofUrl: optionalText,
  paymentProofFileName: optionalText,
  paymentProofMimeType: optionalText,
  paymentReference: optionalText,
  items: z
    .array(
      z.object({
        skuId: z.string().min(1),
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  notes: z.string().max(500).nullable().optional(),
  idempotencyKey: z.string().min(1),
});

export const verifyOrderOtpSchema = z.object({
  orderId: z.string().min(1),
  otpCode: z.string().length(6),
});

export const createDistrictSchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
});

export const createDistributorSchema = z.object({
  name: z.string().min(2).max(200),
  districtId: z.string().min(1),
  address: z.string().min(5).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().min(5).max(10),
  phone: z.string().min(10).max(15),
  email: optionalEmail,
  gstin: optionalText,
  ownerUid: optionalText,
  ownerEmail: optionalEmail,
  ownerPhone: optionalText,
  ownerName: optionalText,
  logoUrl: z.string().nullable().optional(),
});

export const transitionOrderSchema = z.object({
  orderId: z.string().min(1),
  toStatus: z.enum([
    "PENDING_OTP",
    "OTP_VERIFIED",
    "CF_APPROVED",
    "ALLOCATED",
    "PICKING",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REJECTED",
  ]),
  notes: z.string().max(500).nullable().optional(),
  idempotencyKey: z.string().min(1),
});

// ─── POS Schemas ─────────────────────────────────────────────

export const createSaleSchema = z.object({
  storeId: z.string().min(1),
  registerSessionId: z.string().min(1),
  customerId: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        skuId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
  discountPaise: z.number().int().min(0).default(0),
  idempotencyKey: z.string().min(1),
});

export const returnSaleSchema = z.object({
  saleId: z.string().min(1),
  items: z
    .array(
      z.object({
        skuId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  reason: z.string().min(1).max(500),
  idempotencyKey: z.string().min(1),
});

// ─── Register Schemas ────────────────────────────────────────

export const openRegisterSchema = z.object({
  registerId: z.string().min(1),
  openingFloatPaise: z.number().int().min(0),
});

export const closeRegisterSchema = z.object({
  sessionId: z.string().min(1),
  actualCashPaise: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
});

// ─── User Management ─────────────────────────────────────────

export const updateUserSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(2).max(200).optional(),
  email: optionalEmail,
  phone: optionalText,
  role: z.enum(["SUPERADMIN", "ADMIN", "ASM", "C_AND_F", "DISTRIBUTOR"]).optional(),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  districtId: optionalText,
  cfId: optionalText,
  avatarUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─── Catalog ─────────────────────────────────────────────────

export const assignProductToStoreSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
});

// ─── Price List ──────────────────────────────────────────────

export const createPriceListSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).default(""),
});
