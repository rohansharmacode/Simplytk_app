# simplytk for iOS and Android

The mobile app for [simplytk.com](https://simplytk.com): the live UK internship and spring
week tracker, AI CV rater, aptitude drills and mentoring, with native tabs, push alerts,
deep links and a share sheet.

It is an [Expo](https://expo.dev) (React Native) app. Version one is native where students
spend their time: Home, the tracker with stars and alerts, the daily challenge and the
leaderboards. Everything else on the site (CV tools, interview prep, guides, settings)
opens in an in-app web view from the More tab.

It talks to the same backend as the website, so an account, a star, a streak or a score is
the same in both places:

- **Sign-in** is Supabase Auth on the website's project: email and password, a texted code,
  or Sign in with Apple. As on the website, a code to a new number or a first Apple sign-in
  makes the account; email accounts can no longer be made. Google sign-in is not in the app yet.
- **Openings and stars** are read straight from the website's database (`jobs`,
  `companies`, `saved_jobs`) under its row-level security. See `src/lib/tracker/queries.ts`.
- **The daily challenge, streak, leaderboards, league and push tokens** go through a few
  routes on simplytk.com under `/api/app/`, described in [docs/app-api.md](docs/app-api.md).
  Until the site serves them, those screens offer the website's page instead.

## What's in the app

| Tab | What it is |
| --- | --- |
| Home | Starred openings closing soonest, today's challenge with a Start button, the streak and the league place. |
| Tracker | Every opening, filtered by firm, type, deadline and region. Star one for its deadline alerts. Tapping an opening shows it with its apply link. |
| Daily | Today's challenge: the website's set of questions, a clock, a big number pad, and a review afterwards. |
| Ranks | The daily challenge’s player and university boards (today, month, all time) and the weekly league, with your own row pinned at the bottom. |
| More | Drills, progress, 1v1, AI tools, mentoring, guides, account settings and sign out. Web pages open over the tabs. |

The look follows Rohan's Orbit design system (mono kickers over two-tone titles, quiet
hairline cards, one blue accent, tabular numbers) in simplytk's blue, light and dark.

The first star asks for notification permission, since alerts for starred openings are
why the app exists. Tapping an alert opens the opening it is about.

Behaviour inside the web views:

- **Links.** simplytk.com, Supabase auth and Stripe stay in the app. Other sites (Calendly,
  firm career pages) open in an in-app browser sheet. Mail, phone, calendar subscriptions,
  WhatsApp, Instagram, LinkedIn, TikTok, YouTube, X and store links go to their apps. See
  `classifyUrl` in `src/lib/site.ts`.
- **Signing in.** Web pages keep their own website sign-in for now (docs/app-api.md has the
  endpoint that would hand them the app's session).
- **Camera and microphone** permissions are set up for mock interviews, and file inputs
  work for CV uploads.
- **Keyboard.** On Android the page is padded by however much the keyboard covers it.
- **Back.** Swipe back on iOS. The hardware back button on Android goes back in page
  history before leaving the screen.
- **Offline.** A "Can't reach simplytk" screen with a retry button, which also retries by
  itself when the app comes back to the foreground.
- **Sharing and downloads.** The site's Share buttons open the native share sheet, and files
  a page generates (`.ics`, cover letters, share cards) are handed to the share sheet.
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

The tests cover the pure logic (link rules, deep-link mapping, deadlines and filters, daily
answer marking and the keypad, leaderboard rows), the script injected into pages (run
against a real DOM in jsdom), and the app itself: `src/__tests__/app.test.tsx` renders the
real screens and router with Supabase, the site's endpoints and the WebView stubbed. It
covers sign-in, Home, the tracker and stars, playing the daily challenge, the leaderboards,
link handling, deep links, notification taps, the More menu, downloads, copy, push tokens,
the retry screen and the Android back button.

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
  when asked. Turn on Sign in with Apple for `com.simplytk.app` (EAS does this from
  `ios.usesAppleSignIn`) and add the Apple provider in Supabase Auth.
- Google Play Console account.
- For Android push, a Firebase project with
  [FCM V1 credentials uploaded to EAS](https://docs.expo.dev/push-notifications/fcm-credentials/).

To build an installable Android APK locally instead (needs the Android SDK and JDK 17+):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

The APK lands in `android/app/build/outputs/apk/release/` and is signed with a debug
key: fine for installing on test phones, not for the Play Store.

The bundle ID and package name are `com.simplytk.app`. Change them in `app.json` before
the first store upload if the stores should list something else.

Before the first store submission, work through
[docs/web-integration.md § App Store review](docs/web-integration.md#4-app-store-review).

## Project layout

```
src/app/                 Screens (Expo Router: every file is a route)
  _layout.tsx            Root stack, sign-in gate, theme, notification taps, splash
  sign-in.tsx            Email and password, phone code, Sign in with Apple
  (tabs)/_layout.tsx     Native tab bar
  (tabs)/index.tsx       Home
  (tabs)/tracker.tsx     Openings, filters, starred
  (tabs)/daily.tsx       Today's challenge and the streak
  (tabs)/ranks.tsx       Player and university boards, the weekly league
  (tabs)/more.tsx        Everything else, as web pages
  opening/[id].tsx       One opening with its apply link
  challenge.tsx          Playing the daily challenge, full screen
  drills.tsx             The drill list; play/[slug].tsx plays a native drill
  page.tsx               Any simplytk.com page in a web view
  +native-intent.tsx     Maps incoming links to the right screen
src/components/
  ui.tsx                 The building blocks: title, card, button, chip, stat
  opening-card.tsx       An opening in a list, with its star
  number-pad.tsx         The daily challenge's keypad
  streak-strip.tsx       The last seven days
  drills/                Native drills on top of drill-shell.tsx
  site-webview.tsx       The WebView: link rules, bridge, errors, back button
src/lib/
  supabase.ts, session.ts  The website's Supabase project and the signed-in student
  site-api.ts            The website's /api/app endpoints (docs/app-api.md)
  tracker/               Filters and deadlines (pure, tested) and the queries
  stars.ts               Starred openings, shared by every screen
  daily/                 Answer marking, keypad input and run recording (pure, tested);
                         store.ts shares today's state, the streak and the league
  leaderboard.ts         Pinned rows, league wording (pure, tested)
  routes.ts              Deep-link and notification mapping
  bridge.ts              Script injected into pages, and message parsing
  push.ts                Notification permission and the Expo push token
src/__tests__/, src/lib/__tests__/   Tests (src/test/ holds the WebView stand-in)
```

Common changes:

- **Which site links open a native screen:** `NATIVE_SECTIONS` in `src/lib/routes.ts`.
- **Which links open in the app:** `src/lib/site.ts`.
- **The More menu:** `SECTIONS` in `src/app/(tabs)/more.tsx`.
- **Porting a drill:** write the game in `src/components/drills/` on top of `DrillShell`,
  add it to `registry.ts`, and set `native: true` on it in `src/lib/drills/catalogue.ts`.
  Links to its simplytk.com page then open it in the app. The question ranges and clocks
  of the two native drills are guesses until they're aligned with the site's code.
- **Colours:** `src/constants/theme.ts`. Light is the site's own palette; dark follows
  Orbit's midnight ground.
