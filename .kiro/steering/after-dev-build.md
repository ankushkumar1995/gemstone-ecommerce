# Pending: work that waits for the app development build

The AstroUnkle app (`d:\PrepMasterProject\astrounkle-app`, Expo SDK 58) runs in Expo Go today, so nothing with custom native code is built yet. The user plans to make the development build (EAS) soon. When the build is ready, or when the user says "build ban gaya", bring this list up and start from it. Keep this file updated: tick items off when done, add new build-only items when they come up.

## Build-only features (cannot work in Expo Go)

1. **Push notifications** (`expo-notifications`, FCM for Android, APNs for iOS)
   - Backend: save Expo push tokens per customer device (many devices per customer, remove on logout or when Expo reports the token invalid), and a send helper using the Expo push API with retries.
   - Send for these events:
     - A followed astrologer goes live (today this is in-app only, via `liveAlertsFor` and `LiveAlertBanner`).
     - A "Remind me" live starts (`live_reminders`).
     - Waitlist "your turn" (today only `ActiveChatBanner` while the app is open).
     - Chat accepted, and new chat messages while the app is in the background.
     - Low wallet balance during a chat.
     - Order and booking status changes.
   - Customer settings to turn each type on or off. Respect quiet hours.
2. **Native Razorpay** (`react-native-razorpay` + config plugin)
   - Wallet recharge, pooja bookings and shop checkout should use the native sheet instead of the current web flow.
   - Server verify and webhooks stay as they are.
3. **Voice and video consultation calls** (paid per minute, like chat)
   - LiveKit React Native SDK (`@livekit/react-native`, `@livekit/react-native-webrtc`).
   - Incoming call UI: CallKit on iOS, ConnectionService on Android.
   - Billing per minute reuses the chat billing rules. Channels `call` and `video` already exist in astrologer presence and rates.
4. **Call-on-live**: a viewer joins the astrologer's live as a guest (audio or video). Needs the LiveKit RN SDK. Do it after live video is on.
5. **Mantra / aarti audio in the background and on the lock screen**: `expo-audio` plugin with `enableBackgroundPlayback: true`, `setAudioModeAsync({ shouldPlayInBackground: true })` and `player.setActiveForLockScreen(...)` in `mantras.tsx` and `library-item/[id].tsx`. Also daily mantra reminders (local notifications).
6. **(Optional) Astrologer goes live from the phone**: today the astrologer publishes the camera from the browser panel (`CameraCard`). Only needed if a partner app is planned.

## Build setup checklist

- [x] Expo project linked: `@ankushkumarnoida/astrounkle-app` (projectId in `app.json`).
- [x] `eas.json`: development (dev client APK), preview (tester APK), production (AAB, versionCode auto-increment on Expo servers), submit to the Play internal track as a draft.
- [x] `app.config.js`: three variants side by side (`com.astrounkle.app.dev`, `.preview`, `com.astrounkle.app`), own scheme each, `google-services.json` from the Expo file variable `GOOGLE_SERVICES_JSON`.
- [x] Native modules in the first build: `expo-dev-client`, `expo-notifications` (+ `expo-device`, `expo-application`), `expo-updates` (OTA, runtime = app version), `expo-system-ui`, `expo-asset`, background playback in `expo-audio`.
- [x] Icons: logo inside the adaptive-icon safe zone, real AstroUnkle monochrome (themed) icon and notification icon (the old ones were Expo template images).
- [x] Permissions: camera, microphone, storage / media read and (store builds) "display over other apps" are blocked. Left: internet, vibrate, notifications, media-playback foreground service.
- [ ] Razorpay native SDK and LiveKit RN are NOT in the first build on purpose (Razorpay's RN package has open New Architecture issues; both get added together with their feature code, then one rebuild).
- [ ] Set `EXPO_PUBLIC_API_URL` (live backend) in the Expo `preview` and `production` environments.
- [ ] Play Console: foreground service declaration for media playback (mantra audio), Data safety form, content rating, privacy policy URL, in-app account deletion (store rule).
- Credentials and keys:
  - Firebase `google-services.json` (FCM).
  - APNs key.
  - Razorpay live keys.
- After the build, test everything again on a real device. Include:
  - Keyboard behaviour on the live screen.
  - Gifts and Super Chat.
  - The 1-to-1 chat line from a live.
  - Topic chips.
  - The blocked-viewer view.

## Pending but NOT build-dependent (can be done any time)

- **Live video**: the code is done. It needs `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in `.env`, plus CORS on the S3 bucket for HLS. Viewers play it with `expo-video`, which works in Expo Go.
- **Load for big lives**: long-poll does a DB read about every second per viewer. Add Redis or another shared cache before lives with hundreds of viewers.
- **"Report live"** for viewers, with an admin review list.
- **Remedy commission and part returns**: commission is reversed on a full cancel or refund of an order, and lowered on a part refund of a pooja booking. A part return of one shop item does not lower it yet, because the Returns module is still mock-only. Fix this when Returns moves to Mongo.
- **Follower attribution in the live report**: store `liveId` on follows made from a live (today the report counts follows by time window).
- **Admin dashboard of live totals**: revenue, top astrologers, lives per day.
- **Money features turned to "coming soon"** (demo removed from the app; each needs a business decision, then a server-side build):
  - Coins: redeem on consultations, server-side, with a cap.
  - Membership plans: what they include and their prices.
  - Paid reports: these need the calculation engine first.
- **Still demo, not money**: the side-menu feedback form, pooja livestream, mantra audio, the notifications screen, and the astrology calculations (sample data). The partner panel also has `demo-store.ts` stores.
- **Deploy reminders**:
  - `OTP_DEMO_MODE=true` is for testing only. Remove it before the public launch.
  - Run `scripts/optimize-astro-photos.ts` once on the live DB: first without `--apply` to see the list, then with `--apply`.
