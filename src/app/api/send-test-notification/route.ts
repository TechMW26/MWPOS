import { NextResponse } from 'next/server'

// ============================================================
// POST /api/send-test-notification
// Sends a test FCM push notification.
//
// Body: { token: string }  — target device FCM token
//    or: { topic: string } — send to all subscribers of a topic
//    or: {}                 — send to a test broadcast
// ============================================================

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mxpos-bb29e'

async function getAccessToken (): Promise<string> {
  // Try to use the Firebase CLI's refresh token via the Google Identity API
  try {
    const { execSync } = await import('child_process')
    const token = execSync(
      'gcloud auth application-default print-access-token 2>/dev/null || ' +
        'gcloud auth print-access-token 2>/dev/null',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim()
    if (token && token.length > 20) return token
  } catch {
    // gcloud not available
  }

  // Fallback: use a service account if configured
  if (
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    !process.env.FIREBASE_ADMIN_PRIVATE_KEY.includes('...')
  ) {
    try {
      const { GoogleAuth } = await import('google-auth-library')
      const auth = new GoogleAuth({
        credentials: {
          client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(
            /\\n/g,
            '\n'
          )
        },
        scopes: ['https://www.googleapis.com/auth/firebase.messaging']
      })
      const client = await auth.getClient()
      const tokenResponse = await client.getAccessToken()
      return tokenResponse.token || ''
    } catch {
      // fall through
    }
  }

  throw new Error(
    'No valid credentials found. Either:\n' +
      '1. Run `gcloud auth application-default login`\n' +
      '2. Set FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY in .env'
  )
}

export async function POST (request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token, topic } = body as { token?: string; topic?: string }

    if (!token && !topic) {
      return NextResponse.json(
        {
          error: 'Provide `token` (device FCM token) or `topic` to send to.',
          help: 'Get your token at http://192.168.29.223:3000/test-notification'
        },
        { status: 400 }
      )
    }

    // Get access token
    let accessToken: string
    try {
      accessToken = await getAccessToken()
    } catch (err: any) {
      return NextResponse.json(
        { error: `Auth failed: ${err.message}` },
        { status: 500 }
      )
    }

    // Build FCM v1 message
    const message: any = {
      notification: {
        title: '🔔 MW-POS Test',
        body: `Push notification works! Sent at ${new Date().toLocaleTimeString()}`
      },
      data: {
        click_action: '/test-notification',
        timestamp: Date.now().toString()
      },
      webpush: {
        fcmOptions: { link: '/test-notification' }
      }
    }

    if (token) {
      message.token = token
    } else if (topic) {
      message.topic = topic
    }

    // Send via FCM v1 REST API
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`
    const fcmPayload = { message }

    console.log(
      '[FCM-Test] Sending to:',
      token ? `token ${token.substring(0, 20)}...` : `topic ${topic}`
    )

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(fcmPayload)
    })

    const result = await response.json()

    if (response.ok) {
      console.log('[FCM-Test] ✅ Notification sent:', JSON.stringify(result))
      return NextResponse.json({ success: true, result })
    } else {
      console.error('[FCM-Test] ❌ Failed:', JSON.stringify(result))
      return NextResponse.json(
        { success: false, error: result },
        { status: response.status }
      )
    }
  } catch (err: any) {
    console.error('[FCM-Test] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
