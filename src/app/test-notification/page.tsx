'use client'

import { useState } from 'react'
import { usePushNotifications } from '@/lib/hooks/use-push-notifications'

export default function TestNotificationPage () {
  const {
    permission,
    token,
    isRequesting,
    isRegistering,
    requestPermission,
    error
  } = usePushNotifications()

  const [sent, setSent] = useState(false)

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token)
    }
  }

  return (
    <div className='flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center'>
      <h1 className='text-2xl font-bold'>🔔 Push Notification Test</h1>

      {/* Permission status */}
      <div
        className={`rounded-full px-4 py-1 text-sm font-medium ${
          permission === 'granted'
            ? 'bg-green-100 text-green-800'
            : permission === 'denied'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}
      >
        Permission: {permission}
      </div>

      {/* Request button */}
      {permission !== 'granted' && (
        <button
          onClick={requestPermission}
          disabled={isRequesting}
          className='rounded-lg bg-primary px-6 py-3 text-white disabled:opacity-50'
        >
          {isRequesting ? 'Requesting...' : 'Enable Notifications'}
        </button>
      )}

      {/* Token display */}
      {isRegistering && (
        <p className='text-sm text-muted-foreground'>Generating FCM token...</p>
      )}

      {token && (
        <div className='w-full max-w-md space-y-3'>
          <div className='rounded-lg bg-green-50 p-4 text-left'>
            <p className='mb-1 text-xs font-medium text-green-800'>
              ✅ FCM Token Generated
            </p>
            <p className='break-all font-mono text-xs text-green-900'>
              {token}
            </p>
          </div>
          <button
            onClick={copyToken}
            className='rounded bg-green-600 px-4 py-2 text-sm text-white'
          >
            📋 Copy Token
          </button>
        </div>
      )}

      {error && (
        <div className='rounded-lg bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      <p className='mt-4 text-xs text-muted-foreground'>
        Open this page on your phone at:{' '}
        <code className='rounded bg-muted px-1 py-0.5'>
          http://192.168.29.223:3000/test-notification
        </code>
      </p>
    </div>
  )
}
