package com.mwfuturetech.mwpos

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.snackbar.Snackbar
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MWPOS_MAIN"
        private const val BASE_URL = BuildConfig.BASE_URL
    }

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private var pendingDeepLink: String? = null

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            fetchAndSendFcmToken()
        } else {
            Snackbar.make(
                webView,
                "Notification permission denied. You won't receive order updates.",
                Snackbar.LENGTH_LONG
            ).show()
        }
    }

    private val tokenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val token = intent?.getStringExtra(MyFirebaseMessagingService.EXTRA_TOKEN) ?: return
            sendTokenToWebView(token)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)

        setupWebView()

        // Handle deep link from notification click
        if (intent?.action == Intent.ACTION_VIEW) {
            intent.data?.let { pendingDeepLink = it.toString() }
        }
        intent?.getStringExtra("deep_link")?.let { pendingDeepLink = it }

        // Load the app
        webView.loadUrl(BASE_URL)

        // Request notification permission on Android 13+
        requestNotificationPermissionIfNeeded()

        // Listen for FCM token refreshes
        registerReceiver(
            tokenReceiver,
            IntentFilter(MyFirebaseMessagingService.ACTION_TOKEN_REFRESH),
            Context.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onDestroy() {
        unregisterReceiver(tokenReceiver)
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra("deep_link")?.let { link ->
            navigateTo(link)
        }
        intent.data?.let { uri ->
            navigateTo(uri.toString())
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(true)
                builtInZoomControls = true
                displayZoomControls = false
                mediaPlaybackRequiresUserGesture = false

                // Enable smooth rendering
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    isForceDarkAllowed = false
                }
            }

            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

            // Inject native FCM bridge into WebView
            addJavascriptInterface(FcmBridge(), "NativeFCM")
            addJavascriptInterface(AppBridge(), "NativeApp")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val url = request.url.toString()
                    // Keep internal navigation in WebView
                    return if (request.url.scheme == "https" && request.url.host == Uri.parse(BASE_URL).host) {
                        false
                    } else {
                        // Open external links in browser
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Exception) {}
                        true
                    }
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    swipeRefresh.isRefreshing = false

                    // Re-inject bridges after page load
                    injectBridges()

                    // Fetch FCM token and send to WebView
                    fetchAndSendFcmToken()

                    // Navigate to pending deep link
                    pendingDeepLink?.let { link ->
                        pendingDeepLink = null
                        navigateTo(link)
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    // Grant audio/video permissions for calls if needed
                    request.grant(request.resources)
                }
            }
        }

        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun injectBridges() {
        // Re-inject the JS bridge — the WebView might have navigated
        webView.evaluateJavascript("""
            if (typeof window.NativeFCM === 'undefined') {
                window.NativeFCM = { onToken: function() {}, onPush: function() {} };
            }
            if (typeof window.NativeApp === 'undefined') {
                window.NativeApp = { share: function() {}, openLink: function() {} };
            }
            // Notify the web app that native bridges are available
            window.dispatchEvent(new CustomEvent('nativeBridgeReady'));
        """.trimIndent(), null)
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this, Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    fetchAndSendFcmToken()
                }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    Snackbar.make(
                        webView,
                        "Notifications keep you updated on orders, approvals, and deliveries.",
                        Snackbar.LENGTH_INDEFINITE
                    ).setAction("Enable") {
                        requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }.show()
                }
                else -> {
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        } else {
            // Pre-Android 13: notifications are always allowed
            fetchAndSendFcmToken()
        }
    }

    private fun fetchAndSendFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                Log.d(TAG, "FCM token: ${token.take(20)}...")
                sendTokenToWebView(token)
            } else {
                Log.w(TAG, "FCM token fetch failed", task.exception)
            }
        }
    }

    private fun sendTokenToWebView(token: String) {
        webView.evaluateJavascript(
            "if(window.NativeFCM && window.NativeFCM.onToken) window.NativeFCM.onToken('$token');" +
            "window.dispatchEvent(new CustomEvent('fcmToken', { detail: '$token' }));",
            null
        )
    }

    private fun navigateTo(path: String) {
        val url = if (path.startsWith("/")) "$BASE_URL$path" else path
        webView.evaluateJavascript(
            "window.location.href = '${url.replace("'", "\\'")}';",
            null
        )
    }

    // ── JavaScript Bridges ──────────────────────────────────

    inner class FcmBridge {
        @JavascriptInterface
        fun onToken(token: String) {
            // Web app acknowledges token receipt
            Log.d(TAG, "WebView acknowledged FCM token")
        }

        @JavascriptInterface
        fun onPush(data: String) {
            // Forward push data to the WebView
            webView.post {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('pushData', { detail: $data }));",
                    null
                )
            }
        }
    }

    inner class AppBridge {
        @JavascriptInterface
        fun share(title: String, text: String) {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, text)
            }
            startActivity(Intent.createChooser(shareIntent, "Share via"))
        }

        @JavascriptInterface
        fun openLink(url: String) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (_: Exception) {}
        }
    }
}
