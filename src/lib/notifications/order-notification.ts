import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/db/admin";
import { getFirebaseAdminMessaging } from "@/lib/firebase/admin-auth";
import type { Distributor, OrderItem } from "@/types/models";

export interface OrderNotificationInput {
  orderId: string;
  distributor: Distributor;
  items: OrderItem[];
  totalPaise: number;
}

function amount(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildOrderNotificationBody(input: OrderNotificationInput): string {
  const quantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const shown = input.items.slice(0, 2).map((item) => `${item.productName} ×${item.quantity}`);
  const remaining = input.items.length - shown.length;
  return `${quantity} units: ${shown.join(", ")}${remaining > 0 ? ` +${remaining} more` : ""}. Total ${amount(input.totalPaise)}. Review and approve with Firebase OTP.`;
}

export async function sendOrderApprovalNotification(input: OrderNotificationInput): Promise<{ sent: boolean; devices: number }> {
  try {
    const ownerUid = input.distributor.ownerUid;
    if (!ownerUid) return { sent: false, devices: 0 };

    const userSnap = await adminDb.ref(`users/${ownerUid}`).get();
    const tokensRecord = userSnap.exists()
      ? (userSnap.val() as { fcmTokens?: Record<string, { token?: string }> }).fcmTokens || {}
      : {};
    const tokens = Array.from(new Set(Object.values(tokensRecord).map((entry) => entry.token).filter((token): token is string => Boolean(token)))).slice(0, 500);
    const notificationId = uuidv4();
    const body = buildOrderNotificationBody(input);
    const link = `/storefront/orders/${input.orderId}`;

    await adminDb.ref(`notifications/${ownerUid}/${notificationId}`).set({
      id: notificationId,
      uid: ownerUid,
      title: `Order #${input.orderId.slice(0, 8)} needs approval`,
      body,
      type: "WARNING",
      read: false,
      link,
      createdAt: new Date().toISOString(),
    });

    if (tokens.length === 0) return { sent: false, devices: 0 };
    const response = await getFirebaseAdminMessaging().sendEachForMulticast({
      tokens,
      notification: { title: `Order #${input.orderId.slice(0, 8)} needs approval`, body },
      data: { orderId: input.orderId, click_action: link, type: "ORDER_APPROVAL" },
      webpush: { fcmOptions: { link } },
    });
    return { sent: response.successCount > 0, devices: response.successCount };
  } catch (error) {
    console.error("[Order] Firebase notification failed:", error instanceof Error ? error.message : error);
    return { sent: false, devices: 0 };
  }
}
