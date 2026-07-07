'use client'

// ============================================================
// PwaRegister — Registers the PWA service worker (sw.js)
// for offline caching and installability.
//
// IMPORTANT: This does NOT auto-reload on update. The new
// SW activates on the next manual navigation/refresh to
// avoid infinite reload loops.
// ============================================================

import { useEffect } from 'react'

export function PwaRegister () {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] Service Worker registered:', reg.scope)

        // Listen for updates — but DO NOT auto-reload (causes infinite loops)
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log('[PWA] Update available — will activate on next load')
            }
          })
        })
      })
      .catch(err => {
        console.error('[PWA] Service Worker registration failed:', err)
      })
  }, [])

  return null
}
