package com.mwfuturetech.mwpos

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class MWPOSApplication : Application() {

    companion object {
        const val CHANNEL_ORDERS = "orders"
        const val CHANNEL_APPROVALS = "approvals"
        const val CHANNEL_TRACKING = "tracking"
        const val CHANNEL_GENERAL = "general"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            val orders = NotificationChannel(
                CHANNEL_ORDERS,
                "New Orders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new orders placed by ASMs and distributors"
                enableVibration(true)
                setShowBadge(true)
            }

            val approvals = NotificationChannel(
                CHANNEL_APPROVALS,
                "Order Approvals",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Order approval requests and status updates"
                enableVibration(true)
                setShowBadge(true)
            }

            val tracking = NotificationChannel(
                CHANNEL_TRACKING,
                "Order Tracking",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Order status changes: packed, shipped, delivered"
                enableVibration(true)
            }

            val general = NotificationChannel(
                CHANNEL_GENERAL,
                "General",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Account updates, targets, and other info"
            }

            manager.createNotificationChannels(
                listOf(orders, approvals, tracking, general)
            )
        }
    }
}
