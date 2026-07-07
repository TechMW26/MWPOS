import { NextResponse } from 'next/server'

// ============================================================
// Dynamic Service Worker for Firebase Cloud Messaging
// Served at /firebase-messaging-sw.js by Next.js App Router.
//
// Why dynamic? Service Workers cannot read environment
// variables, but Next.js route handlers can. This route
// injects the Firebase config at request time so the SW
// always uses the correct project credentials.
// ============================================================

export async function GET (): Promise<NextResponse> {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ''
  }

  // Derive the sender ID from the appId if not explicitly set
  // (Firebase appId format: "1:{SENDER_ID}:web:{...}")
  if (!firebaseConfig.messagingSenderId && firebaseConfig.appId) {
    const parts = firebaseConfig.appId.split(':')
    if (parts[1]) {
      firebaseConfig.messagingSenderId = parts[1]
    }
  }

  const SW_VERSION = '2.0.0'

  const script = `
// Firebase Cloud Messaging Service Worker v${SW_VERSION}
// Auto-generated at request time — do not edit manually.
console.log("[FCM-SW v${SW_VERSION}] Evaluating");

importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js"
);

firebase.initializeApp(${JSON.stringify(firebaseConfig)});

const messaging = firebase.messaging();

// ── Background messages ──────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM-SW] Background message:", payload);

  const { notification, data } = payload;
  if (!notification) return;

  const options = {
    body: notification.body || "",
    icon: notification.icon || "/MW_POS.png",
    badge: "/MW_POS.png",
    data: {
      ...data,
      fcmMessageId: payload.messageId,
      click_action: data?.click_action || "/",
    },
    tag: data?.tag || "default",
    requireInteraction: data?.requireInteraction === "true",
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  self.registration.showNotification(
    notification.title || "MW-POS",
    options
  );
});

// ── Notification click ───────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clickAction = event.notification.data?.click_action || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(clickAction);
        }
      })
      .catch((err) => {
        console.error("[FCM-SW] Click error:", err);
      })
  );
});

// ── Lifecycle ────────────────────────────────────────
self.addEventListener("install", () => {
  console.log("[FCM-SW] Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[FCM-SW] Activated");
  event.waitUntil(clients.claim());
});

console.log("[FCM-SW v${SW_VERSION}] Ready");
`.trim()

  // Cache aggressively — config rarely changes
  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      // Cache for 1 hour on CDN, but allow revalidation
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      // Prevent BFCache / prefetch issues in WebViews
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
