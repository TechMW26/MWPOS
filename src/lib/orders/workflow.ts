import { normalizePhoneNumber } from "@/lib/auth/phone";
import type { OrderStatus } from "@/types";
import type { Order, SessionData } from "@/types/models";

export class OrderOtpValidationError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
    this.name = "OrderOtpValidationError";
  }
}

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  DRAFT: ["PENDING_OTP", "CANCELLED"],
  PENDING_OTP: ["OTP_VERIFIED", "CANCELLED", "DRAFT"],
  OTP_VERIFIED: ["PENDING_CF_APPROVAL", "CF_APPROVED", "CANCELLED"],
  PENDING_CF_APPROVAL: ["CF_APPROVED", "CF_REJECTED", "CANCELLED"],
  CF_APPROVED: ["ALLOCATED", "CANCELLED"],
  CF_REJECTED: ["DRAFT"],
  ALLOCATED: ["PICKING", "CANCELLED"],
  PICKING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function validateOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid order transition: ${from} → ${to}`);
  }
}

export function canSessionVerifyDistributorOrder(session: SessionData, order: Order): boolean {
  if (session.role !== "DISTRIBUTOR") return false;
  const distributorIds = session.distributorIds.length ? session.distributorIds : session.storeIds;
  return distributorIds.includes(order.distributorId);
}

export function validateFirebaseOrderIdentity(input: {
  firebaseUid: string;
  firebasePhone: string | null | undefined;
  firebaseAuthTime: number;
  sessionUid: string;
  sessionPhone: string | null;
  linkedFirebaseUid: string | null | undefined;
  distributorPhone: string;
  nowSeconds?: number;
  maxAgeSeconds?: number;
}): void {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = input.maxAgeSeconds ?? 5 * 60;
  const ageSeconds = nowSeconds - input.firebaseAuthTime;

  if (!input.firebasePhone || !input.sessionPhone) {
    throw new OrderOtpValidationError("A verified distributor phone number is required", 403);
  }
  if (ageSeconds < -60 || ageSeconds > maxAgeSeconds) {
    throw new OrderOtpValidationError("Verification expired. Request a new Firebase OTP.", 401);
  }
  if (input.firebaseUid !== input.sessionUid && input.firebaseUid !== input.linkedFirebaseUid) {
    throw new OrderOtpValidationError("The verified Firebase account does not match this session", 403);
  }

  const verifiedPhone = normalizePhoneNumber(input.firebasePhone);
  if (verifiedPhone !== normalizePhoneNumber(input.sessionPhone)) {
    throw new OrderOtpValidationError("The verified phone does not match the signed-in distributor", 403);
  }
  if (verifiedPhone !== normalizePhoneNumber(input.distributorPhone)) {
    throw new OrderOtpValidationError("The verified phone does not match this distributor", 403);
  }
}

export function requiresDistributorReapproval(order: Pick<Order, "asmId" | "otpStatus" | "status">): boolean {
  return Boolean(order.asmId)
    && order.otpStatus === "VERIFIED"
    && ["OTP_VERIFIED", "PENDING_CF_APPROVAL"].includes(order.status);
}
