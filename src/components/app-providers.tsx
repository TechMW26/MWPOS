'use client'

// ============================================================
// AppProviders — Single client boundary for all providers.
// Extracted from the root layout so the server component
// only renders one clean client boundary.
// ============================================================

import { type ReactNode } from 'react'
import { NotificationProvider } from '@/components/notification-provider'
import { NativeFcmBridge } from '@/components/native-fcm-bridge'
import { PwaRegister } from '@/components/pwa-register'
import { ToastProvider } from '@/lib/hooks/use-toast'

export function AppProviders ({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      <ToastProvider>
        {children}
        <NativeFcmBridge />
        <PwaRegister />
      </ToastProvider>
    </NotificationProvider>
  )
}
