# OTPLESS React Native Headless SDK — Demo App

A reference React Native app showing how to integrate the **OTPLESS Headless SDK**
([`otpless-headless-rn`](https://www.npmjs.com/package/otpless-headless-rn))
into your own app, using your own UI.

It is a single test screen that covers the phone authentication journey:

- **Silent Network Authentication (SNA)**, with **SNA → OTP fallback**
- **SMS OTP**
- **WhatsApp OTP**
- **Automatic OTP reading** (Android) and **manual OTP verification**
- **Status and error handling**, with a message for every documented error code
- **SDK event log** (OTPs and tokens redacted), with **Share logs** for bug reports

The same layout as the [Android](https://github.com/guru-otpless/OtplessHeadlessDemo-public)
and [Flutter](https://github.com/otpless-tech/otpless-flutter-headless-demo) demos.
Email and social login aren't on the screen, but the wrapper supports them
(see [3.5](#35-start-authentication)).

> **SDK:** `otpless-headless-rn: ^3.0.0` (Android `otpless-headless-sdk 2.0.1`, iOS `OtplessBM/Core 3.0.1`)
> **Built with:** React Native 0.79.7 (New Architecture), React 19.0, TypeScript
> **Official docs:** https://otpless.com/docs/frontend-sdks/app-sdks/react-native/new/headless/headless

> [!IMPORTANT]
> **React Native version:** `otpless-headless-rn` 3.0.0 builds on React Native
> **0.79.x and older**. From 0.80, React Native's `ActivityEventListener` is
> Kotlin with non-null parameters and `currentActivity` is deprecated (removed
> by 0.87), so the SDK's Android module no longer compiles. On RN 0.80+, use the
> TurboModule package [`headless-sdk-turborn`](https://www.npmjs.com/package/headless-sdk-turborn).

---

## Contents

1. [Run the demo](#1-run-the-demo)
2. [How the demo is organised](#2-how-the-demo-is-organised)
3. [Integrate OTPLESS into your app](#3-integrate-otpless-into-your-app)
4. [Response types](#4-response-types)
5. [Error codes](#5-error-codes)
6. [Troubleshooting](#6-troubleshooting)
7. [Security checklist](#7-security-checklist)

---

## 1. Run the demo

### Prerequisites

| | Requirement |
|---|---|
| Node | 18+ |
| Android | Android Studio, **JDK 17** (Gradle 8.13 doesn't run on newer JDKs such as Android Studio's bundled JDK 25), a **physical device** |
| iOS | Xcode 16+, CocoaPods, iOS 15.1+ (React Native's minimum) |
| OTPLESS | An App ID from the [OTPLESS dashboard](https://otpless.com/dashboard) with phone OTP, SNA, SMS and WhatsApp turned on |

> Use a physical device. The emulator has no SIM / mobile network for SNA, SMS or WhatsApp.

### Steps

```bash
# 1. Install packages (also creates config/otpless_config.json)
npm install

# 2. Set your App ID (writes config for JS, Android and iOS)
./scripts/configure.sh YOUR_APP_ID

# 3a. Android
npm run android

# 3b. iOS
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

If you skip step 2, the app opens a screen that tells you how to set the App ID.

`configure.sh` writes:

| File | Used by | Purpose |
|---|---|---|
| `config/otpless_config.json` (git-ignored) | `App.tsx`, `android/app/build.gradle` | App ID, plus the Android deep-link scheme `otpless.<appid lowercase>` |
| `ios/OtplessHeadlessDemo/Info.plist` | iOS | URL scheme `otpless.<appid lowercase>` |

> `Info.plist` is tracked by git, so don't commit it after running the script
> if you don't want your App ID in the repo. In your own app, just hard-code the
> App ID; it is not a secret.

### Trying each flow

| Button | What it does | How to test |
|---|---|---|
| **SNA → OTP** | No channel forced. The SDK tries SNA first, then falls back to OTP per the dashboard | SNA: mobile data on, Wi-Fi off, supported carrier. Fallback: test on Wi-Fi |
| **SMS OTP** | `deliveryChannel: "SMS"` | Enter the OTP in **Verify OTP**, or let Android auto-read it |
| **WhatsApp OTP** | `deliveryChannel: "WHATSAPP"` | Same as SMS |

The **Verify OTP** card appears only after an OTP has been sent (`authType: OTP`
from `INITIATE`, or after `FALLBACK_TRIGGERED`). The **Status** card shows SDK
readiness, `authType`, `deliveryChannel` and the last error. Use **Cancel** if a
request never answers; the app also stops waiting after 45 seconds.

The **Event log** under the cards lists every request and SDK callback, newest
first. **Share logs** opens the share sheet with the whole log, oldest first.

---

## 2. How the demo is organised

```
App.tsx                           Root: setup screen or DemoScreen
src/
├── DemoScreen.tsx                The single screen (status, phone, verify, log)
├── DemoController.ts             ★ Maps each SDK responseType to UI state
├── otpless/
│   ├── otplessService.ts         ★ The SDK wrapper: initialize, start, verify, callback
│   ├── otplessResponse.ts        Typed view over the raw callback object
│   └── otplessErrors.ts          Error code → user message
├── SetupRequiredScreen.tsx       Shown until the App ID is set
└── theme.ts                      OTPLESS colors
config/otpless_config.json        App ID (demo convenience only)
```

The two files marked ★ hold the integration logic. `DemoScreen.tsx` is ordinary
React Native UI. `DemoController` is plain TypeScript, so you can move its logic
into Redux, Zustand, a context, or a hook without changing how the SDK is called.

```
 DemoScreen ──► DemoController ──► otplessService ──► headlessModule.start(...)
     ▲                │                                        │
     └──── state ◄────┴──────── onResponseReceived ◄── setResponseCallback
```

---

## 3. Integrate OTPLESS into your app

### 3.1 Install

```bash
npm i otpless-headless-rn
cd ios && pod install
```

The package is a native module, so it doesn't work in Expo Go. Use a development build.

### 3.2 Android setup

React Native's `MainActivity` extends `ReactActivity`, which is already a
`FragmentActivity`, so no activity change is needed.

**Build config** ([android/build.gradle](android/build.gradle)). The SDK pulls in
`androidx.core 1.18`, which needs **`compileSdkVersion` 36+** and **Android Gradle
Plugin 8.9.1+**. React Native 0.79 defaults to 35 and 8.8.2, so the demo raises both:

```groovy
ext { compileSdkVersion = 36 }
dependencies { classpath("com.android.tools.build:gradle:8.9.1") }
```

**`AndroidManifest.xml`** ([file](android/app/src/main/AndroidManifest.xml))

```xml
<application
    ...
    android:networkSecurityConfig="@xml/network_security_config">  <!-- SNA only -->

    <activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTask" ...>
        <!-- Magic Link / OAuth redirect. Replace with your App ID in lowercase. -->
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:host="otpless" android:scheme="otpless.YOUR_APP_ID_LOWERCASE" />
        </intent-filter>
    </activity>
</application>
```

**Network security config (SNA only).** The SDK ships
`@xml/otpless_network_security_config`, but in React Native you usually need
your own: once an app sets a network security config, Android ignores
`usesCleartextTraffic`, so **debug builds can no longer reach Metro**. This demo
uses its own config with the OTPLESS carrier domains, plus plain HTTP in debug only:

- [`src/main/res/xml/network_security_config.xml`](android/app/src/main/res/xml/network_security_config.xml): carrier domains (all builds)
- [`src/debug/res/xml/network_security_config.xml`](android/app/src/debug/res/xml/network_security_config.xml): same, plus `base-config cleartextTrafficPermitted="true"` for Metro

### 3.3 iOS setup

**a) `Info.plist`** ([file](ios/OtplessHeadlessDemo/Info.plist))

```xml
<!-- Magic Link / OAuth redirect -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>otpless</string>
    <key>CFBundleURLSchemes</key>
    <array><string>otpless.YOUR_APP_ID_LOWERCASE</string></array>
  </dict>
</array>

<key>LSApplicationQueriesSchemes</key>
<array>
  <string>whatsapp</string>
  <string>otpless</string>
  <string>gootpless</string>
  <string>com.otpless.ios.app.otpless</string>
  <string>googlegmail</string>
</array>

<!-- SNA only: add inside your existing NSAppTransportSecurity dict -->
<key>NSExceptionDomains</key>
<dict>
  <key>80.in.safr.sekuramobile.com</key>
  <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/><key>NSIncludesSubdomains</key><true/></dict>
  <key>api-csp.airtel.in</key>
  <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/><key>NSIncludesSubdomains</key><true/></dict>
  <key>in-vil.ipification.com</key>
  <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/><key>NSIncludesSubdomains</key><true/></dict>
  <key>partnerapi.jio.com</key>
  <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/><key>NSIncludesSubdomains</key><true/></dict>
</dict>
```

**b) Pass redirects back to the SDK.** New React Native apps have a Swift
`AppDelegate` ([file](ios/OtplessHeadlessDemo/AppDelegate.swift)):

```swift
import OtplessBM

func application(_ app: UIApplication, open url: URL,
                 options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
  if Otpless.shared.isOtplessDeeplink(url: url) {
    Task(priority: .userInitiated) { await Otpless.shared.handleDeeplink(url) }
    return true
  }
  return false // or RCTLinkingManager.application(app, open: url, options: options)
}
```

If your `AppDelegate` is Objective-C (`AppDelegate.mm`), use the small Swift
`Connector` class from the [official docs](https://otpless.com/docs/frontend-sdks/app-sdks/react-native/new/headless/headless)
and call it from `application:openURL:options:`.

### 3.4 Initialize once and listen for responses

See [otplessService.ts](src/otpless/otplessService.ts).

```ts
import { OtplessHeadlessModule } from 'otpless-headless-rn';

// One instance for the whole app.
const headlessModule = new OtplessHeadlessModule();

useEffect(() => {
  headlessModule.setDevLogging(__DEV__);         // optional
  headlessModule.initialize('YOUR_APP_ID');
  headlessModule.setResponseCallback(onHeadlessResult); // AFTER initialize
  return () => {
    headlessModule.clearListener();
    headlessModule.cleanup();
  };
}, []);

const onHeadlessResult = (result: any) => {
  headlessModule.commitResponse(result); // always acknowledge first
  switch (result.responseType) {
    case 'SDK_READY':          /* ready to start */ break;
    case 'INITIATE':           /* OTP sent / SNA started, or error */ break;
    case 'OTP_AUTO_READ':      /* Android: fill + verify */ break;
    case 'VERIFY':             /* 200 = OTP accepted, otherwise failed */ break;
    case 'ONETAP':             /* SUCCESS: send token to backend */ break;
    case 'FALLBACK_TRIGGERED': /* moved to next channel */ break;
    case 'DELIVERY_STATUS':    /* delivered on channel */ break;
    case 'FAILED':             /* SDK-level failure */ break;
  }
};
```

> ⚠️ **Call `setResponseCallback` after `initialize`.** The module creates its
> event emitter inside `initialize`, so a callback registered before it is
> silently dropped and you never get `SDK_READY`.

### 3.5 Start authentication

```ts
// Phone. countryCode has no "+".
headlessModule.start({ phone: '9876543210', countryCode: '91' });

// Optional: force a channel instead of the dashboard order
headlessModule.start({ phone: '9876543210', countryCode: '91', deliveryChannel: 'WHATSAPP' });

// Email
headlessModule.start({ email: 'user@example.com' });

// OAuth / social
headlessModule.start({ channelType: 'WHATSAPP' });
```

Supported `channelType` values: `WHATSAPP`, `APPLE`, `GMAIL`, `TWITTER`, `DISCORD`,
`SLACK`, `FACEBOOK`, `LINKEDIN`, `MICROSOFT`, `LINE`, `LINEAR`, `NOTION`, `TWITCH`,
`GITHUB`, `BITBUCKET`, `ATLASSIAN`, `GITLAB`.

Other optional request keys: `otpLength` (`"4"` / `"6"`), `expiry` (seconds),
`tid` (template id).

> ⚠️ **Pass every value as a `string`.** Both native bridges read them as
> strings, so `countryCode: 91` or `otpLength: 6` is silently ignored.

Check `await headlessModule.isSdkReady()` before calling `start`.

### 3.6 Verify the OTP

Verification uses the same `start` call with the same identity plus `otp`:

```ts
headlessModule.start({ phone: '9876543210', countryCode: '91', otp: '123456' });
headlessModule.start({ email: 'user@example.com', otp: '123456' });
```

To resend, call `start` again **without** `otp`.

### 3.7 Validate the token on your backend

When you receive `ONETAP`, send `response.token` to **your server** and
validate it with the OTPLESS server-side token validation API, using your
Client ID / Client Secret. Create the user session only after that succeeds.
Never put the Client Secret in the app.

---

## 4. Response types

All callbacks look like `{ responseType, statusCode, response: {...} }`.
[`DemoController.onResponse`](src/DemoController.ts) is a full, working example
of handling each one.

| `responseType` | When | What your UI should do |
|---|---|---|
| `SDK_READY` | `initialize` finished | Enable the login button |
| `FAILED` | SDK could not initialize (`5003`) or SSL pinning failed (`5004`) | Show an error; retry `initialize` |
| `INITIATE` (200) | Request accepted. Check `response.authType` | `OTP` → OTP screen · `OTP_LINK` → OTP screen (link also works) · `MAGICLINK` → "check your inbox" · `SILENT_AUTH` → loader |
| `INITIATE` (≠200) | Request rejected | Show `errorCode` message, stay on the input screen |
| `OTP_AUTO_READ` | Android read the OTP from SMS / WhatsApp | Fill the field and verify |
| `DELIVERY_STATUS` | OTP / link delivered | Optional: "Delivered via WhatsApp" |
| `FALLBACK_TRIGGERED` | Primary channel failed, SmartAuth retried | Update "sent via …" (e.g. SNA → SMS OTP: show the OTP screen) |
| `VERIFY` (200) | OTP accepted | Treat as authenticated. `ONETAP` may follow with `userId` / `token`, but don't wait on it |
| `VERIFY` (≠200) | Verification failed | Wrong / expired OTP → show error. `SILENT_AUTH` + `9106` → every method failed, restart. `SILENT_AUTH` otherwise → wait for the next `INITIATE` |
| `ONETAP` | **Success** | Read `userId` and `token` (or `response.data.token`) → send the token to your backend |
| `AUTH_TERMINATED` | Flow ended without success | Return to the login screen |

---

## 5. Error codes

Mapped in [otplessErrors.ts](src/otpless/otplessErrors.ts).

| Code | Meaning |
|---|---|
| 7101 | Invalid parameters |
| 7102 | Invalid phone number |
| 7103 | Invalid delivery channel for phone |
| 7104 | Invalid email |
| 7105 | Invalid delivery channel for email |
| 7106 | Invalid phone or email |
| 7113 | Invalid expiry |
| 7116 | OTP length must be 4 or 6 |
| 7121 | Invalid app hash |
| 4000 / 4001 / 4003 | Invalid request / 2FA not supported / channel not enabled |
| 401 / 7025 | Unauthorized / country not enabled |
| 7020 / 7022 / 7023 / 7024 | Rate limited |
| 7112 | Empty OTP |
| 7115 | OTP already verified |
| 7118 | Incorrect OTP |
| 7303 | OTP expired |
| 9106 | Silent Auth and all fallbacks failed |
| 9100–9105 | Network errors (9101, 9102, 9105 iOS only) |
| 9110 | Request cancelled (iOS) |
| 5900 | Needs a newer iOS version (iOS) |
| 5003 | SDK initialization failed |
| 5004 | SSL pin validation failed (only with `{ sslPinning: 'enabled' }`) |

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| No callbacks at all / never `SDK_READY` | Call `setResponseCallback` **after** `initialize`, and keep one `OtplessHeadlessModule` instance |
| Android: `Unresolved reference 'currentActivity'` / `'onNewIntent' overrides nothing` | You're on React Native 0.80+. Use RN ≤ 0.79 or `headless-sdk-turborn` |
| Android: `requires Android Gradle plugin 8.9.1 or higher` | Pin AGP 8.9.1 and `compileSdkVersion` 36 (see [3.2](#32-android-setup)) |
| Android: `Unsupported class file major version` | Build with JDK 17 (`JAVA_HOME`) |
| `The package 'otpless-headless-rn' doesn't seem to be linked` | Rebuild the native app after installing; run `pod install` on iOS; don't use Expo Go |
| Debug build shows "Unable to load script" after adding SNA config | Your network security config blocks Metro. Allow cleartext in debug (see [3.2](#32-android-setup)) |
| `FAILED` 5003 on launch | Wrong App ID, or no network |
| `INITIATE` 401 / 4003 | Method or channel not enabled in the dashboard for this App ID |
| Magic Link / OAuth opens the browser but never returns | Scheme must be `otpless.<appid in lowercase>` (Android intent filter + iOS `CFBundleURLSchemes`); on iOS also forward the URL in `AppDelegate` |
| iOS / Android ignores `countryCode` / `otpLength` | Pass them as strings |
| SNA always falls back | Turn Wi-Fi off, use mobile data, check the carrier is supported, and keep the network security config / ATS exceptions |
| `FAILED` 5004 | SSL pinning is on and a proxy (Charles, Proxyman) is intercepting traffic |
| App shows "Add your OTPLESS App ID" | Run `./scripts/configure.sh YOUR_APP_ID`, then rebuild |

---

## 7. Security checklist

- [ ] Validate the `ONETAP` token **on your backend** before trusting the user
- [ ] Never ship your OTPLESS Client Secret in the app
- [ ] Turn off `setDevLogging` in release builds (the demo enables it only in `__DEV__`)
- [ ] Remove the event log and **Share logs** from production builds
- [ ] Consider `initialize(appId, null, { sslPinning: 'enabled' })` for production
