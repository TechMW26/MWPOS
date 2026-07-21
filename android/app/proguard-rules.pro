# MW-POS Android App
# ProGuard Rules (Release only)

# Keep WebView JavaScript interface methods
-keepclassmembers class com.mwpos.app.MainActivity$FcmBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.mwpos.app.MainActivity$AppBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Keep WebView
-keep class android.webkit.** { *; }
