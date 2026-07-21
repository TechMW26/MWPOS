// ============================================================
// Native FCM Bridge — listens for tokens and push data
// forwarded from the native Android/iOS layer via
// JavaScript evaluateJavascript() / evaluateJavaScript().
//
// USAGE: Call initNativeBridge() in a useEffect or once
// on the client side. It is SSR-safe.
// ============================================================

type NativeFcmTokenHandler = (token: string) => void
type NativePushHandler = (data: Record<string, string>) => void

const listeners = {
  token: new Set<NativeFcmTokenHandler>(),
  push: new Set<NativePushHandler>()
}

let initialized = false

// ── Public API ──────────────────────────────────────────────

/** Listen for FCM tokens forwarded from native Android/iOS */
export function onNativeFcmToken (handler: NativeFcmTokenHandler): () => void {
  listeners.token.add(handler)
  return () => {
    listeners.token.delete(handler)
  }
}

/** Listen for push data forwarded from native Android/iOS */
export function onNativePush (handler: NativePushHandler): () => void {
  listeners.push.add(handler)
  return () => {
    listeners.push.delete(handler)
  }
}

// ── Auto-sync token to backend ──────────────────────────────

async function syncTokenToBackend (token: string): Promise<void> {
  try {
    await fetch('/api/notifications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: 'android' })
    })
    console.log('[NativeFCM] Token synced to backend')
  } catch (err) {
    console.error('[NativeFCM] Token sync failed:', err)
  }
}

// ── Initialize (call only on the client) ────────────────────

export function initNativeBridge (): void {
  if (typeof document === 'undefined') return
  if (initialized) return
  initialized = true

  document.addEventListener('nativeFcmToken', ((event: CustomEvent<string>) => {
    const token = event.detail
    console.log(
      '[NativeFCM] Token from native:',
      token.substring(0, 20) + '...'
    )
    listeners.token.forEach(handler => handler(token))
    syncTokenToBackend(token)
  }) as EventListener)

  // Also listen for fcmToken events from Android WebView
  document.addEventListener('fcmToken', ((event: CustomEvent<string>) => {
    const token = event.detail
    console.log('[NativeFCM] Token from Android:', token.substring(0, 20) + '...')
    listeners.token.forEach(handler => handler(token))
    syncTokenToBackend(token)
  }) as EventListener)

  document.addEventListener('nativePush', ((event: CustomEvent<string>) => {
    try {
      const data = JSON.parse(event.detail) as Record<string, string>
      console.log('[NativeFCM] Push data from native:', data)
      listeners.push.forEach(handler => handler(data))
    } catch {
      console.error('[NativeFCM] Failed to parse native push data')
    }
  }) as EventListener)

  // Also listen for pushData events from Android WebView
  document.addEventListener('pushData', ((event: CustomEvent<string>) => {
    try {
      const data = typeof event.detail === 'string'
        ? JSON.parse(event.detail) as Record<string, string>
        : event.detail as Record<string, string>
      console.log('[NativeFCM] Push data from Android:', data)
      listeners.push.forEach(handler => handler(data))
    } catch {
      console.error('[NativeFCM] Failed to parse Android push data')
    }
  }) as EventListener)

  // Check if native already set __nativeFcmToken before the bridge loaded
  const win = window as unknown as Record<string, unknown>
  const existingToken = win.__nativeFcmToken
  if (existingToken && typeof existingToken === 'string') {
    document.dispatchEvent(
      new CustomEvent('nativeFcmToken', { detail: existingToken })
    )
  }
}
