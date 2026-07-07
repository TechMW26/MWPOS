/**
 * Send a test FCM push notification via the FCM v1 REST API.
 *
 * Usage:
 *   npx tsx scripts/send-test-notification.ts <FCM_TOKEN>
 *
 * The VAPID key is read from .env.
 * Authentication uses the Firebase CLI's cached token.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mxpos-bb29e'
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`

async function sendTestNotification () {
  const token = process.argv[2]
  if (!token) {
    console.error(
      'Usage: npx tsx scripts/send-test-notification.ts <FCM_TOKEN>'
    )
    process.exit(1)
  }

  // Get Firebase CLI access token
  const { execSync } = await import('child_process')
  let accessToken: string
  try {
    accessToken = execSync('npx firebase auth:print-access-token 2>/dev/null', {
      encoding: 'utf-8',
      cwd: __dirname + '/..'
    }).trim()
    if (!accessToken) throw new Error('No token')
  } catch {
    console.error(
      'Could not get Firebase CLI token. Make sure you are logged in:\n  npx firebase login'
    )
    process.exit(1)
  }

  const message = {
    message: {
      token,
      notification: {
        title: '🔔 Test Notification',
        body:
          'MW-POS push notification is working! Sent at ' +
          new Date().toLocaleTimeString()
      },
      data: {
        click_action: '/test-notification',
        tag: 'test'
      },
      webpush: {
        fcmOptions: {
          link: '/test-notification'
        }
      }
    }
  }

  console.log('Sending test notification to:', token.substring(0, 30) + '...')
  console.log('URL:', FCM_URL)

  const response = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(message)
  })

  const result = await response.json()
  console.log('Status:', response.status)
  console.log('Response:', JSON.stringify(result, null, 2))

  if (response.ok) {
    console.log('\n✅ Notification sent successfully!')
  } else {
    console.log('\n❌ Failed to send notification.')
    console.log(
      'Make sure the FCM token is valid and you have the FCM API enabled.'
    )
  }
}

sendTestNotification().catch(console.error)
