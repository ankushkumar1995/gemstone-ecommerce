# Pending: work that waits for the app development build

The AstroUnkle app (`d:\PrepMasterProject\astrounkle-app`, Expo SDK 58) runs in Expo Go today, so nothing with custom native code is built yet. The user plans to make the development build (EAS) soon. When the build is ready, or when the user says "build ban gaya", bring this list up and start from it. Keep this file updated: tick items off when done, add new build-only items when they come up.

## Build-only features (cannot work in Expo Go)

1. **Push notifications**: CODE DONE (backend `src/modules/push`, app `services/push`, `components/push/PushHost.tsx`, `notification-settings.tsx`, real inbox `notifications.tsx`). Firebase project `astrounkle` (3 Android apps), `GOOGLE_SERVICES_JSON` file variable in Expo (all 3 environments), FCM V1 key uploaded for `.dev` and `.preview`.
   - Needs the next build (google-services.json goes into the binary). Then test on a phone: permission sheet, token registers, admin → Push notifications → Send a test, tap opens the right screen, chat alert hidden while that chat is open, sign-out stops alerts.
   - When the first production build makes `com.astrounkle.app` in Expo credentials, upload the same FCM V1 key there.
   - Optional hardening: create an Expo access token, set `EXPO_ACCESS_TOKEN` on both Vercel projects, then turn on "Enhanced push security" in Expo.
   - Daily live cap is per server (soft) when several servers send at once.
2. **Native Razorpay**: CODE DONE (`react-native-razorpay@3.0.0`, autolinked, no config plugin needed: its `standard-core` AAR already declares the UPI `<queries>`). `src/services/payments/checkout.ts` calls the native module `RNRazorpayCheckout` directly on Android and falls back to the WebView `CheckoutHost` (Expo Go, older builds, iOS, or sheet not opened in 8 s). Every native failure goes back as `dismissed`, so callers ask the server. Server verify and webhooks unchanged.
   - Needs the next build. Then test on a phone (test keys): wallet recharge and pooja booking pay with UPI app, card, netbanking; cancel with back; fail a payment then retry; press Home during the sheet and reopen from the icon; pay in the UPI app and kill our app, reopen (pending list should credit).
3. **Voice and video consultation calls** (paid per minute, like chat)
   - LiveKit React Native SDK (`@livekit/react-native`, `@livekit/react-native-webrtc`).
   - Incoming call UI: CallKit on iOS, ConnectionService on Android.
   - Billing per minute reuses the chat billing rules. Channels `call` and `video` already exist in astrologer presence and rates.
4. **Call-on-live**: a viewer joins the astrologer's live as a guest (audio or video). Needs the LiveKit RN SDK. Do it after live video is on.
5. **Mantra / aarti audio in the background and on the lock screen**: CODE DONE, works in the current dev build (no new build needed). App-wide player `services/audio/player.ts` (repeat counting also from the lock screen, sleep timer, retry), `MiniPlayer`, shared jaap queue `services/devotional/jaapQueue.ts`. Daily mantra reminders + sadhana reminders as local notifications (`services/reminders/reminders.ts`, `ReminderSheet`, Notification settings → Daily reminders). Test on the phone: play a mantra, lock the phone, count continues; reminder at a time 2 minutes ahead; tap opens the mantra.
6. **(Optional) Astrologer goes live from the phone**: today the astrologer publishes the camera from the browser panel (`CameraCard`). Only needed if a partner app is planned.

## Build setup checklist

- [x] Expo project linked: `@ankushkumarnoida/astrounkle-app` (projectId in `app.json`).
- [x] `eas.json`: development (dev client APK), preview (tester APK), production (AAB, versionCode auto-increment on Expo servers), submit to the Play internal track as a draft.
- [x] `app.config.js`: three variants side by side (`com.astrounkle.app.dev`, `.preview`, `com.astrounkle.app`), own scheme each, `google-services.json` from the Expo file variable `GOOGLE_SERVICES_JSON`.
- [x] Native modules in the first build: `expo-dev-client`, `expo-notifications` (+ `expo-device`, `expo-application`), `expo-updates` (OTA, runtime = app version), `expo-system-ui`, `expo-asset`, background playback in `expo-audio`.
- [x] Icons: logo inside the adaptive-icon safe zone, real AstroUnkle monochrome (themed) icon and notification icon (the old ones were Expo template images).
- [x] Permissions: camera, microphone, storage / media read and (store builds) "display over other apps" are blocked. Left: internet, vibrate, notifications, media-playback foreground service.
- [x] Razorpay native SDK added (`react-native-razorpay` 3.0.0 supports the New Architecture). Goes into the next build.
- [ ] LiveKit RN is NOT in a build yet (added together with the call feature code).
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

- **Live video**: code done, with cost control (recorder only while someone watches, idle stop, 540p, portrait/landscape canvas, audio-only lives, webhook `/api/v1/webhooks/livekit`, orphan sweep, `videoSeconds` per live; admin → Astrologer settings → Live video). LiveKit project `astrounkle-1f2giqrb.livekit.cloud`. Still needed:
  - `LIVEKIT_URL` (`wss://astrounkle-1f2giqrb.livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `.env` and both Vercel projects.
  - LiveKit dashboard → Webhooks: `https://www.astrounkle.com/api/v1/webhooks/livekit` (staging: its own project or the staging URL).
  - Optional, before launch: Cloudflare R2 for HLS (no download fees) via `LIVE_S3_BUCKET`, `LIVE_S3_ENDPOINT`, `LIVE_S3_REGION=auto`, `LIVE_PUBLIC_URL`, `LIVE_S3_ACCESS_KEY_ID`, `LIVE_S3_SECRET_ACCESS_KEY`.
  - S3 lifecycle rule on `live/` (delete after 30 days). CORS only if the website plays HLS later.
  - Viewers play it with `expo-video`, which works in Expo Go.
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
- **Servers today (all testing, no real customers yet)**:
  - Live site `www.astrounkle.com` (Vercel project 1) and staging `astrounkle-staging.vercel.app` (Vercel project 2) deploy the same `main` branch and both read the same DB (`astro_unkle_dev`).
  - App variants: Dev app → laptop `next dev`; Preview app → staging (set via an OTA update on channel `preview`, Expo env `preview`); Play Store build → live (Expo env `production`).
  - Before the public launch: give the live Vercel project its own DB (e.g. `astro_unkle_prod`) and live Razorpay keys; keep staging on the dev DB with test keys.
  - Expo free plan: Android builds for the month were used up on 19 Nov 2026 (reset 1 Dec). JS-only changes reach the Preview app with `eas update --channel preview --environment preview` (run with `APP_VARIANT=preview`).
- **Deploy reminders**:
  - `OTP_DEMO_MODE=true` is for testing only. Remove it before the public launch.
  - Run `scripts/optimize-astro-photos.ts` once on the live DB: first without `--apply` to see the list, then with `--apply`.
