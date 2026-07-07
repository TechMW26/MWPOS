'use client'

// ============================================================
// NotificationProvider — Client wrapper that initialises FCM,
// registers the service worker, and surfaces notification
// state via React Context.
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import {
  getSwRegistration,
  onForegroundMessage,
  type NotificationPermissionState
} from '@/lib/firebase/messaging'

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface NotificationContextValue {
  /** Current browser notification permission */
  permission: NotificationPermissionState
  /** Whether the service worker is registered */
  swReady: boolean
  /** Latest foreground message (undefined until first message) */
  lastForegroundPayload: unknown
}

const NotificationContext = createContext<NotificationContextValue>({
  permission: 'default',
  swReady: false,
  lastForegroundPayload: null
})

export function useNotificationContext () {
  return useContext(NotificationContext)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NotificationProvider ({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    typeof Notification !== 'undefined'
      ? Notification.permission
      : 'unsupported'
  )
  const [swReady, setSwReady] = useState(false)
  const [lastForegroundPayload, setLastForegroundPayload] =
    useState<unknown>(null)

  // ── Register Service Worker on mount ──────────────────────
  useEffect(() => {
    let cancelled = false

    getSwRegistration()
      .then(reg => {
        if (cancelled || !reg) return
        setSwReady(true)
        console.log('[FCM-Provider] SW registered, scope:', reg.scope)
      })
      .catch(err => {
        console.error('[FCM-Provider] SW registration failed:', err)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ── Track permission changes ──────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator))
      return

    let cancelled = false

    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then(status => {
        if (cancelled) return
        setPermission(status.state as NotificationPermissionState)

        const onChange = () => {
          if (cancelled) return
          setPermission(status.state as NotificationPermissionState)
        }
        status.addEventListener('change', onChange)
      })
      .catch(() => {
        // Permissions API not available
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ── Foreground message listener ───────────────────────────
  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    onForegroundMessage(payload => {
      if (cancelled) return
      console.log('[FCM-Provider] Foreground message:', payload)
      setLastForegroundPayload(payload)

      // Show a local notification for foreground messages too
      if (payload.notification?.title) {
        try {
          const { title, body, icon } = payload.notification
          new Notification(title, {
            body: body ?? '',
            icon: icon ?? '/MW_POS.png',
            tag: payload.data?.tag ?? 'fcm-foreground'
          })
        } catch {
          // Notification constructor may fail silently
        }
      }
    }).then(unsub => {
      if (cancelled) {
        unsub?.()
        return
      }
      cleanup = unsub
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  const value: NotificationContextValue = {
    permission,
    swReady,
    lastForegroundPayload
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
