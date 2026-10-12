# simplytk for iOS and Android

The mobile app for [simplytk.com](https://simplytk.com): the live UK internship and spring
week tracker, AI CV rater, aptitude drills and mentoring, with native tabs, push alerts,
deep links and a share sheet.

It is an [Expo](https://expo.dev) (React Native) app. Each tab hosts simplytk.com in a
WebView, so every feature of the site is in the app from day one, and site deploys reach
the app without an app update. Native code handles what a browser tab can't: the tab bar,
notifications, links into the app, sharing, and offline states.

## What's in the app

| Tab | Shows | Notes |
| --- | --- | --- |
| Home | `/dashboard` | The PWA's start page. Signed-out students get the sign-in screen. |
| Explore | `/explore` | |
| Tracker | `/internship-tracker` | Company pages, `/live` and `/expected-openings` deep-link here. |
| Progress | `/progress` | |
| More | Native menu | AI tools, practice, mentoring, account settings, share, version. |

The tabs match the site's own mobile tab bar, which the app hides so there is only one.
Tapping the open tab again scrolls to the top, and a second tap returns to the tab's start
page. The Tracker tab loads in the background shortly after launch, so it opens instantly.
Menu entries and links from outside the app open as a page pushed over the tabs, with
share and open-in-browser buttons.

Behaviour inside the WebViews:

- **Links.** simplytk.com, Supabase auth and Stripe stay in the app. Other sites (Calendly,
  firm career pages) open in an in-app browser sheet. Mail, phone, calendar subscriptions,
  WhatsApp, Instagram, LinkedIn, TikTok, YouTube, X and store links go to their apps. See
  `classifyUrl` in `src/lib/site.ts`.
- **Theme.** On first launch the site follows the phone's light or dark setting, and the
  native chrome follows whichever theme the site is showing.
- **Signing in.** When a student signs in or out in one tab, the other tabs reload the
  next time they are opened, so they stay in step.
- **Camera and microphone** permissions are set up for mock interviews, and file inputs
  work for CV uploads.
- **Keyboard.** On Android the page is padded by however much the keyboard covers it, so
  the field being typed in stays visible. Edge-to-edge Android apps don't get this for
  free. iOS WebViews handle it themselves.
- **Back.** Swipe back on iOS. The hardware back button on Android goes back in page
  history before leaving the screen.
- **Offline.** A "Can't reach simplytk" screen with a retry button, which also retries by
  itself when the app comes back to the foreground. Pull to refresh on iOS.
- **Sharing.** The site's Share buttons open the native share sheet, including on
  Android, where WebViews have no Web Share API, and for the share-card image.
- **Downloads.** WebViews can't save files a page generates (the add-to-calendar `.ics`,
  the cover letter `.txt`, the share card). The app takes those files and opens the share
  sheet, where they can be saved to Files or Photos or added to Calendar.
- **Copy buttons** fall back to the system clipboard when the WebView refuses.

## How the website talks to the app

The app injects `window.SimplytkNative` into every page (`src/lib/bridge.ts`). Through it,
the site can ask for a push token, and it learns that it is running in the app. Push alerts
need the website to store tokens and send notifications. See
[docs/web-integration.md](docs/web-integration.md), which also covers universal links and
App Store review.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on a phone. Everything works there
except push notifications, which need a build (below).

Checks (CI runs the same on every push):

```bash
npm run typecheck
npm run lint
npm test
```

The tests cover the pure logic (link rules, deep-link mapping), the script injected into
pages (run against a real DOM in jsdom), and the app itself: `src/__tests__/app.test.tsx`
renders the real screens and router with a simulated WebView. It covers launch, tab
loading, link handling, deep links, notification taps, the More menu, theme and sign-in
sync, downloads, copy, push tokens, the retry screen and the Android back button.

## Build and release

Builds run in the cloud with [EAS](https://docs.expo.dev/eas/), so no Mac or Android
Studio is needed.

1. `npx eas-cli login`, then `npx eas-cli init`. This links an EAS project and writes its
   ID into `app.json`, which push tokens need.
2. Test builds to install directly on phones:
   `npx eas-cli build --profile preview --platform android` (an APK) or `--platform ios`
   (registered devices).
3. Store builds: `npx eas-cli build --profile production --platform all`, then
   `npx eas-cli submit --platform ios` / `--platform android`.

Accounts and credentials needed:

- Apple Developer Program membership. EAS creates the certificates and the push key
  when asked.
- Google Play Console account.
- For Android push, a Firebase project with
  [FCM V1 credentials uploaded to EAS](https://docs.expo.dev/push-notifications/fcm-credentials/).

To build an installable Android APK locally instead (needs the Android SDK and JDK 17+):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

The APK is signed with a debug key: fine for testing, not for the Play Store.

The bundle ID and package name are `com.simplytk.app`. Change them in `app.json` before
the first store upload if the stores should list something else.

Before the first store submission, work through
[docs/web-integration.md § App Store review](docs/web-integration.md#4-app-store-review).

## Project layout

```
src/app/                 Screens (Expo Router: every file is a route)
  _layout.tsx            Root stack, theme, notification taps, splash
  (tabs)/_layout.tsx     Native tab bar
  (tabs)/index.tsx …     WebView tabs: Home, Explore, Tracker, Progress
  (tabs)/more.tsx        Native More menu
  page.tsx               Any simplytk.com page pushed over the tabs
  +native-intent.tsx     Maps incoming links to the right tab or page
src/components/
  site-webview.tsx       The WebView: link rules, bridge, errors, back button
  tab-webview.tsx        Lazy-loads a tab's WebView and handles deep links into it
src/hooks/
  use-keyboard-overlap.ts  Keeps typed-in fields above the Android keyboard
  use-notification-routing.ts  Opens the page a tapped notification links to
src/lib/
  site.ts                Origin, link classification, title cleanup
  routes.ts              Which tab owns which site section; deep-link mapping
  bridge.ts              Script injected into pages, and message parsing
  files.ts               Saves page downloads and opens the share sheet
  push.ts                Notification permission and Expo push token
src/__tests__/, src/lib/__tests__/   Tests (src/test/ holds the WebView stand-in)
assets/images/           Icons and splash, drawn from simplytk's logo
```

Common changes:

- **A tab's page:** `TAB_HOME` in `src/lib/routes.ts`.
- **Which links open in the app:** `src/lib/site.ts`.
- **The More menu:** `SECTIONS` in `src/app/(tabs)/more.tsx`.
- **Colours:** `src/constants/theme.ts`. These are converted from the site's CSS tokens,
  so change them together.
