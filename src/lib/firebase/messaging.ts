// ============================================================
// Firebase Cloud Messaging — Client-Side Module
//
// IMPORTANT — WebView Compatibility:
// This project is loaded inside Android/iOS WebViews, which
// have LIMITED support for the Web Push API:
//
//   Android WebView: No Service Worker support (API 95+ only,
//     and most apps target lower API levels). The Notification
//     API works but SW-based background messages will NOT fire.
//     Use the native Android FCM SDK instead for background push.
//
//   iOS WKWebView: No Service Worker / Notification API support.
//     Push MUST be handled natively via APNs → FCM.
//
// This module gracefully degrades — it detects missing APIs and
// returns null instead of crashing, so the app works in WebViews
// but native FCM integration is required for reliable push.
// ============================================================

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  deleteToken,
  type Messaging
} from 'firebase/messaging'
import { getFirebaseApp } from '@/lib/db/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** VAPID key from env. MUST be set in production. */
export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let messagingInstance: Messaging | null = null

/** Lazily initialise the Messaging singleton. Returns `null` when unsupported. */
export async function getMessagingInstance (): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance
  if (!(await isSupported())) {
    console.warn('[FCM] Messaging not supported in this browser/WebView')
    return null
  }
  messagingInstance = getMessaging(getFirebaseApp())
  return messagingInstance
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export type NotificationPermissionState = NotificationPermission | 'unsupported'

/** Request notification permission. Returns the resulting state. */
export async function requestNotificationPermission (): Promise<NotificationPermissionState> {
  if (typeof Notification === 'undefined') {
    console.warn('[FCM] Notification API not available (likely WebView)')
    return 'unsupported'
  }

  const current = Notification.permission

  // Already granted
  if (current === 'granted') return 'granted'

  // Denied — don't prompt again
  if (current === 'denied') return 'denied'

  // "default" — prompt the user
  try {
    const result = await Notification.requestPermission()
    return result
  } catch (err) {
    console.error('[FCM] Permission request failed:', err)
    return 'denied'
  }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/**
 * Retrieve the current FCM registration token.
 * Requires notification permission to be granted first.
 *
 * NOTE: In Android WebViews, the token will be generated but
 * background delivery depends on native FCM SDK integration.
 * In iOS WKWebViews, this will return null (no SW support).
 */
export async function getFcmToken (): Promise<string | null> {
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    console.warn('[FCM] Notification permission not granted, cannot get token')
    return null
  }

  if (!VAPID_KEY) {
    console.error(
      '[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set. ' +
        'Add it to your .env file (find it in Firebase Console > ' +
        'Project Settings > Cloud Messaging > Web Push certificate).'
    )
    return null
  }

  const messaging = await getMessagingInstance()
  if (!messaging) return null

  try {
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await getSwRegistration()
    })
    if (!currentToken) {
      console.warn(
        '[FCM] No registration token available — may need to request permission first, ' +
          'or this WebView does not support Service Workers.'
      )
      return null
    }
    console.log('[FCM] Token obtained:', currentToken.substring(0, 20) + '...')
    return currentToken
  } catch (err) {
    console.error('[FCM] getToken error:', err)
    return null
  }
}

/** Delete the current token (e.g. on logout). */
export async function deleteFcmToken (): Promise<boolean> {
  const messaging = await getMessagingInstance()
  if (!messaging) return false
  try {
    await deleteToken(messaging)
    console.log('[FCM] Token deleted')
    return true
  } catch (err) {
    console.error('[FCM] deleteToken error:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Service Worker registration
// ---------------------------------------------------------------------------

let swRegistration: ServiceWorkerRegistration | null = null

/**
 * Register the Firebase Messaging Service Worker.
 *
 * The SW is served dynamically by Next.js at /firebase-messaging-sw.js
 * (see src/app/firebase-messaging-sw.js/route.ts) so it always uses
 * the correct Firebase project config from environment variables.
 *
 * NOTE: Service Workers are NOT supported in:
 *   - Android WebView (API < 95)
 *   - iOS WKWebView (all versions)
 * In these environments, this function will fail gracefully.
 */
export async function getSwRegistration (): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (swRegistration) return swRegistration

  if (!('serviceWorker' in navigator)) {
    console.warn(
      '[FCM] Service Worker API not available — this is expected in WebViews'
    )
    return undefined
  }

  try {
    swRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    )
    console.log('[FCM] Service Worker registered:', swRegistration.scope)

    // Wait until the SW is ready
    await navigator.serviceWorker.ready
    console.log('[FCM] Service Worker is ready')

    return swRegistration
  } catch (err) {
    console.error('[FCM] Service Worker registration failed:', err)
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Foreground notification listener
// ---------------------------------------------------------------------------

export type FcmPayload = {
  messageId: string
  notification?: {
    title?: string
    body?: string
    icon?: string
    image?: string
  }
  data?: Record<string, string>
  from: string
  collapseKey: string
}

export type FcmForegroundCallback = (payload: FcmPayload) => void

/**
 * Listen for foreground push messages.
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage (
  callback: FcmForegroundCallback
): Promise<(() => void) | null> {
  const messaging = await getMessagingInstance()
  if (!messaging) return null

  const unsubscribe = onMessage(messaging, payload => {
    console.log('[FCM] Foreground message received:', payload)
    callback(payload as unknown as FcmPayload)
  })

  return unsubscribe
}

// ---------------------------------------------------------------------------
// Token refresh handler
// ---------------------------------------------------------------------------

export type TokenRefreshCallback = (token: string) => void

/**
 * Listen for token refresh events (when the FCM token is rotated).
 * NOTE: Firebase JS SDK v11 uses onTokenRefresh via the compat layer;
 * for the modular SDK we poll via getToken in the hook.
 * This is exported as a convenience wrapper for manual refresh logic.
 */
export async function onTokenRefresh (
  callback: TokenRefreshCallback
): Promise<() => void> {
  // The modular SDK doesn't expose onTokenRefresh directly.
  // We handle token refresh in the hook via periodic checks.
  const interval = setInterval(async () => {
    const token = await getFcmToken()
    if (token) callback(token)
  }, 30 * 60 * 1000) // every 30 minutes

  return () => clearInterval(interval)
}
