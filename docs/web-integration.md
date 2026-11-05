# simplytk.com ↔ app integration

The app's main screens are native and talk to the website's backend: Supabase directly for
sign-in, openings and stars, and the routes in [app-api.md](app-api.md) for the daily
challenge, leaderboards, league and push tokens. Everything else on the site opens in a
web view. This page covers those web views, push, universal links and App Store review.

## 1. Detecting the app

Every page loaded in the app has:

- `window.SimplytkNative`, which is `{ platform: 'ios' | 'android', appVersion, requestPushToken(), share() }`.
- The classes `simplytk-native-app` and `simplytk-native-ios` or `simplytk-native-android` on `<html>`.
- `simplytk-app/<version>` at the end of the user agent, for server-side analytics.
- `?source=app` on the first URL each tab loads, matching the PWA's `?source=pwa`.

The app already hides the site's mobile tab bar (`nav[aria-label="Primary"].fixed.bottom-0`)
and the body padding kept for it, because the native tab bar replaces it. If that markup
changes, move the rule into the site's CSS so it keeps working:

```css
html.simplytk-native-app .mobile-tab-bar { display: none; }
html.simplytk-native-app body { padding-bottom: 0; }
```

Downloads made from a blob or data URL (`<a download>` clicked from script, as the
add-to-calendar, cover letter and share card buttons do) are handed to the app, which
offers them through the share sheet. `navigator.clipboard.writeText` falls back to the
system clipboard if the WebView refuses it. Neither needs changes on the website.

## 2. Push alerts

Alerts for starred openings are the main reason to install the app. The app asks for
permission on the first star, registers its Expo push token with `POST /api/app/push-token`
after every sign-in, and removes it on sign-out. The website stores tokens and sends the
pushes through the [Expo push API](https://docs.expo.dev/push-notifications/sending-notifications/).
[app-api.md](app-api.md#notifications) has the details.

The notification payload's `data`:

- `jobId`: the opening an alert is about. Tapping opens it in the app with its apply link.
- `url`: a simplytk.com URL or path, used when there is no `jobId`. `/internship-tracker`
  opens the Tracker, `/openings/<slug>` the opening, `/daily` the Daily tab,
  `/oa-leaderboard` and `/league` the Ranks tab, `/dashboard` Home, native drills their
  drill, and any other page opens in a web view. A link to another site opens the Tracker.

Pages in web views can still ask for a token with
`window.SimplytkNative.requestPushToken()`, which resolves to
`{ status: 'granted', token: 'ExponentPushToken[…]' }`, `{ status: 'denied' }` or
`{ status: 'unavailable', reason }`.

## 3. Universal links

These files make `https://simplytk.com/...` links in emails and messages open the app on
phones that have it installed. Serve both as `application/json` with no redirects.

`/.well-known/apple-app-site-association`, with `TEAMID` set to the Apple Developer Team ID:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.simplytk.app"],
        "components": [{ "/": "/admin/*", "exclude": true }, { "/": "*" }]
      }
    ]
  }
}
```

`/.well-known/assetlinks.json`, with the SHA-256 fingerprint shown by `npx eas-cli credentials -p android`
(or, when Google signs the app, Play Console → App integrity):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.simplytk.app",
      "sha256_cert_fingerprints": ["AA:BB:…"]
    }
  }
]
```

## 4. App Store review

- **Digital purchases on iOS.** Apple requires In-App Purchase for digital content and
  subscriptions bought inside an iOS app, such as the playbooks or a paid pass. Before
  submitting, either hide those checkouts in the iOS app
  (`html.simplytk-native-ios .checkout-button { display: none; }`) or add In-App
  Purchase. Live 1:1 mentoring calls fall under Apple's person-to-person services rule,
  which allows other payment methods.
- **Account deletion.** Apple requires that accounts created in the app can be deleted
  in the app. The More tab links to `/dashboard/settings`, which has "Delete account".
  Keep it there.
- **More than a website.** Apps that only wrap a website get rejected. Native tabs,
  share sheet, deep links and offline handling help. Push alerts (section 2) are the
  strongest argument, so ship them before the first submission.
