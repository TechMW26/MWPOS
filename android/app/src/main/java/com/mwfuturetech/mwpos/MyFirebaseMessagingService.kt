package com.mwfuturetech.mwpos

import android.app.PendingIntent
import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "MWPOS_FCM"
        const val ACTION_TOKEN_REFRESH = "com.mwpos.app.TOKEN_REFRESH"
        const val EXTRA_TOKEN = "fcm_token"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token: ${token.take(20)}...")

        // Broadcast to MainActivity so it can inject the token into the WebView
        val intent = Intent(ACTION_TOKEN_REFRESH).apply {
            putExtra(EXTRA_TOKEN, token)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message from: ${message.from}")

        val data = message.data
        val type = data["type"] ?: "GENERAL"
        val notification = message.notification

        val title = notification?.title ?: data["title"] ?: "MW-POS"
        val body = notification?.body ?: data["body"] ?: ""
        val orderId = data["orderId"]
        val clickAction = data["click_action"] ?: data["link"] ?: ""

        val channelId = when (type) {
            "ORDER_APPROVAL" -> MWPOSApplication.CHANNEL_APPROVALS
            "ORDER_STATUS" -> MWPOSApplication.CHANNEL_TRACKING
            "NEW_ORDER" -> MWPOSApplication.CHANNEL_ORDERS
            else -> MWPOSApplication.CHANNEL_GENERAL
        }

        val clickIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (clickAction.isNotEmpty()) {
                putExtra("deep_link", clickAction)
            }
            if (orderId != null) {
                putExtra("order_id", orderId)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationId = (orderId?.hashCode() ?: System.currentTimeMillis().toInt())
            .let { if (it < 0) -it else it }

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(BitmapFactory.decodeResource(resources, R.drawable.notification_logo))
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_SERVICE)

        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build())
        } catch (e: SecurityException) {
            Log.w(TAG, "Notification permission not granted", e)
        }
    }
}
