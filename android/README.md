# MW-POS Android App

Hybrid Android app using WebView to wrap the MW-POS PWA with native Firebase Cloud Messaging for reliable push notifications.

## Architecture

```
┌──────────────────────────────────────┐
│         Android Native Layer         │
│  ┌────────────────────────────────┐  │
│  │  MainActivity (WebView host)   │  │
│  │  ├─ WebView (loads Vercel URL) │  │
│  │  ├─ FCM Token → WebView bridge │  │
│  │  └─ Push data → WebView bridge │  │
│  ├────────────────────────────────┤  │
│  │  MyFirebaseMessagingService    │  │
│  │  ├─ onMessageReceived → notify │  │
│  │  └─ onNewToken → broadcast     │  │
│  ├────────────────────────────────┤  │
│  │  MWPOSApplication              │  │
│  │  └─ Notification channels      │  │
│  └────────────────────────────────┘  │
│              ↕ JavaScript Bridge      │
│  ┌────────────────────────────────┐  │
│  │     MW-POS Web App (PWA)       │  │
│  │  ├─ native-bridge.ts           │  │
│  │  ├─ /api/notifications/register│  │
│  │  └─ FCM token → RTDB           │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Notification Flow

1. **Order Placed** → Backend creates order + sends FCM to distributor's tokens
2. **Order Approved** → Backend updates status + sends FCM to ASM
3. **Status Change** (packed/shipped/delivered) → FCM to all participants
4. **Revenue Target** → FCM when admin sets monthly goal

### Notification Channels
- **Orders** (HIGH) — New orders need immediate attention
- **Approvals** (HIGH) — Order approvals from distributors
- **Tracking** (DEFAULT) — Status: packed, shipped, delivered
- **General** (LOW) — Account updates, targets

## Setup

### 1. Firebase Configuration

Download `google-services.json` from Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`mxpos-bb29e`)
3. ⚙️ Project Settings → Add app → Android
4. Package name: `com.mwpos.app`
5. Download `google-services.json`
6. Replace `android/app/google-services.json`

### 2. Update Base URL

In `android/app/build.gradle.kts`, update:
```kotlin
buildConfigField("String", "BASE_URL", "\"https://your-app.vercel.app\"")
```

### 3. Build

```bash
cd android

# Debug build
./gradlew assembleDebug
# APK at: app/build/outputs/apk/debug/app-debug.apk

# Release build (requires signing config)
./gradlew assembleRelease
```

### 4. Install on Device

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Permissions

The app requests these permissions:
- `INTERNET` — WebView connectivity
- `POST_NOTIFICATIONS` — Push notifications (Android 13+)
- `CAMERA` — Barcode scanning (future)
- `VIBRATE` — Notification vibration
- `FOREGROUND_SERVICE` — Background sync

## Deep Links

Notification taps with `click_action` data will navigate the WebView to the correct page:
- `orderId` → opens order detail
- `click_action` / `link` → navigates to path

## App Icons

- **Launcher**: Adaptive icon (blue background + MW-POS "M/P" mark)
- **Notification**: White-on-transparent vector (Android requirement)
- **Color**: `#1D4ED8` (matches web theme)
