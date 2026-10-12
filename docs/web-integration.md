# simplytk.com ↔ app integration

The app shows simplytk.com inside native tabs. Nothing on the website has to change for
the app to work, but four small additions on the web side turn on the parts that need a
server: universal links, push alerts, and App Store compliance.

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

## 2. Push alerts

Alerts for new openings and deadlines are the main reason to install the app. The app
handles permission, tokens and opening the right page when a notification is tapped. The
website stores tokens and sends the pushes.

**Ask for a token** wherever a student turns on alerts:

```ts
if (window.SimplytkNative) {
  const result = await window.SimplytkNative.requestPushToken();
  // { status: 'granted', token: 'ExponentPushToken[…]' } | { status: 'denied' }
  // | { status: 'unavailable', reason }
  if (result.status === 'granted') {
    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      token: result.token,
      platform: window.SimplytkNative.platform,
    });
  }
}
```

The OS permission prompt appears the first time this is called, so call it from a button
press ("Turn on alerts"), not on page load.

**Send** from the server with the [Expo push API](https://docs.expo.dev/push-notifications/sending-notifications/).
Put the page to open in `data.url`:

```ts
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: token,
    title: 'Goldman Sachs Spring Week is open',
    body: 'Applications close 30 November.',
    data: { url: 'https://simplytk.com/companies/goldman-sachs' },
  }),
});
```

Tracker pages (`/internship-tracker`, `/companies/…`, `/live`, `/expected-openings`) open
in the Tracker tab, and `/dashboard/…` opens in Home. Any other page opens on top of the
tabs. Remove a token when Expo's push receipt reports `DeviceNotRegistered`.

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
