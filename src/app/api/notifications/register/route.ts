import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/db/admin'

// ============================================================
// POST /api/notifications/register
// Registers an FCM token for the current user.
// Stores tokens keyed by user ID to support multiple devices.
// ============================================================
export async function POST (request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = (await request.json()) as { token?: string }
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const userId = session.uid

    // Store the token under the user's node
    // Path: /users/{uid}/fcmTokens/{sanitizedToken}
    // This supports multiple devices per user
    const tokenKey = token.replace(/[.#$/[\]]/g, '_')
    await adminDb.ref(`users/${userId}/fcmTokens/${tokenKey}`).set({
      token,
      createdAt: new Date().toISOString(),
      platform: 'web'
    })

    console.log(`[FCM-API] Token registered for user ${userId}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[FCM-API] POST error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/notifications/register
// Removes an FCM token (e.g. on logout or token invalidation).
// ============================================================
export async function DELETE (request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = (await request.json()) as { token?: string }
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const userId = session.uid
    const tokenKey = token.replace(/[.#$/[\]]/g, '_')

    await adminDb.ref(`users/${userId}/fcmTokens/${tokenKey}`).remove()

    console.log(`[FCM-API] Token removed for user ${userId}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[FCM-API] DELETE error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
