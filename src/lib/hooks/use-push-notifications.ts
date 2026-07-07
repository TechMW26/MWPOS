'use client'

// ============================================================
// usePushNotifications — React Hook for FCM Push Notifications
// Handles: permission flow, token lifecycle, foreground
// listener, and auto-sync to backend.
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  getFcmToken,
  deleteFcmToken,
  getSwRegistration,
  onForegroundMessage,
  requestNotificationPermission,
  type FcmForegroundCallback,
  type NotificationPermissionState
} from '@/lib/firebase/messaging'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePushNotificationsOptions {
  /** Auto-request permission on mount (default: false) */
  autoRequest?: boolean
  /** Callback for foreground messages */
  onForeground?: FcmForegroundCallback
  /** Backend API endpoint for storing/removing tokens */
  tokenApiEndpoint?: string
  /** Current user ID — when provided, syncs token to backend */
  userId?: string
}

export interface UsePushNotificationsReturn {
  /** Current notification permission state */
  permission: NotificationPermissionState
  /** Loading states */
  isRequesting: boolean
  isRegistering: boolean
  /** The current FCM token (null if unavailable) */
  token: string | null
  /** Error message if something went wrong */
  error: string | null
  /** Request notification permission */
  requestPermission: () => Promise<NotificationPermissionState>
  /** Manually refresh the FCM token */
  refreshToken: () => Promise<void>
  /** Delete token + cleanup (call on logout) */
  cleanup: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Token sync helpers
// ---------------------------------------------------------------------------

async function sendTokenToBackend (
  endpoint: string,
  token: string,
  userId: string
): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId })
    })
    if (!res.ok) {
      console.error('[FCM] Backend rejected token:', res.status)
      return false
    }
    console.log('[FCM] Token synced to backend')
    return true
  } catch (err) {
    console.error('[FCM] Token sync failed:', err)
    return false
  }
}

async function removeTokenFromBackend (
  endpoint: string,
  token: string,
  userId: string
): Promise<void> {
  try {
    await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId })
    })
    console.log('[FCM] Token removed from backend')
  } catch (err) {
    console.error('[FCM] Token removal failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePushNotifications (
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const {
    autoRequest = false,
    onForeground,
    tokenApiEndpoint = '/api/notifications/register',
    userId
  } = options

  const [permission, setPermission] = useState<NotificationPermissionState>(
    typeof Notification !== 'undefined'
      ? Notification.permission
      : 'unsupported'
  )
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  const tokenRef = useRef<string | null>(null)
  const fgUnsubscribeRef = useRef<(() => void) | null>(null)

  // ── Sync token state to ref ──────────────────────────────────
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  // ── Core registration flow ───────────────────────────────────
  const registerToken = useCallback(async () => {
    setIsRegistering(true)
    setError(null)

    try {
      // Ensure service worker is registered first
      await getSwRegistration()

      const newToken = await getFcmToken()
      if (!newToken) {
        setToken(null)
        return
      }

      // Avoid duplicate backend calls
      if (newToken === tokenRef.current) {
        console.log('[FCM] Token unchanged, skipping sync')
        return
      }

      setToken(newToken)

      // Sync to backend if configured
      if (tokenApiEndpoint && userId) {
        await sendTokenToBackend(tokenApiEndpoint, newToken, userId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown FCM error'
      console.error('[FCM] Registration error:', msg)
      setError(msg)
    } finally {
      setIsRegistering(false)
    }
  }, [tokenApiEndpoint, userId])

  // ── Request permission ───────────────────────────────────────
  const requestPermission =
    useCallback(async (): Promise<NotificationPermissionState> => {
      setIsRequesting(true)
      setError(null)

      try {
        const result = await requestNotificationPermission()
        setPermission(result)

        if (result === 'granted') {
          // Kick off token registration after permission is granted
          await registerToken()
        }

        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Permission error'
        console.error('[FCM] Permission error:', msg)
        setError(msg)
        return 'denied'
      } finally {
        setIsRequesting(false)
      }
    }, [registerToken])

  // ── Refresh token ────────────────────────────────────────────
  const refreshToken = useCallback(async () => {
    if (permission !== 'granted') return
    await registerToken()
  }, [permission, registerToken])

  // ── Cleanup ──────────────────────────────────────────────────
  const cleanup = useCallback(async () => {
    const currentToken = tokenRef.current
    if (currentToken) {
      await deleteFcmToken()
      if (tokenApiEndpoint && userId) {
        await removeTokenFromBackend(tokenApiEndpoint, currentToken, userId)
      }
    }
    setToken(null)
    setError(null)
  }, [tokenApiEndpoint, userId])

  // ── Auto-request on mount ────────────────────────────────────
  useEffect(() => {
    if (autoRequest) {
      requestPermission()
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Foreground listener ──────────────────────────────────────
  useEffect(() => {
    if (!onForeground || permission !== 'granted') return

    let cancelled = false

    onForegroundMessage(onForeground).then(unsub => {
      if (cancelled) {
        unsub?.()
        return
      }
      fgUnsubscribeRef.current = unsub
    })

    return () => {
      cancelled = true
      fgUnsubscribeRef.current?.()
      fgUnsubscribeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, !!onForeground])

  // ── Permission change listener ───────────────────────────────
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
          if (status.state === 'granted') {
            registerToken()
          }
        }

        status.addEventListener('change', onChange)
        // Store for cleanup — we use the status object itself
        ;(
          fgUnsubscribeRef as React.MutableRefObject<(() => void) | null>
        ).current = () => status.removeEventListener('change', onChange)
      })
      .catch(() => {
        // Permissions API may not be available (e.g. Firefox)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    permission,
    isRequesting,
    isRegistering,
    token,
    error,
    requestPermission,
    refreshToken,
    cleanup
  }
}
