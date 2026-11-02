# The app's endpoints on simplytk.com

The native app reads openings and stars straight from the website's Supabase project
(`jobs` and `companies` are public to read, `saved_jobs` is each student's own under
row-level security), and signs in through Supabase Auth with the same accounts. Everything
else it needs runs server code that only the website has: the daily challenge's sessions and
marking, the streak, the leaderboards, the league and push tokens. The site's own pages call
that code through TanStack server functions, whose URLs change with every deploy, so the app
needs a few stable routes in front of the same functions.

They all live under `/api/app/` on simplytk.com. Until they are deployed the app shows the
daily challenge and the leaderboards as web pages instead (`SiteApiMissing` in
`src/lib/site-api.ts`), so the app can ship before the site does.

## Conventions

- **Auth.** `Authorization: Bearer <Supabase access token>`, the same token the site's server
  functions take as `data.token`. A missing or expired token gets `401`.
- **Body and replies** are JSON. Errors are `{ "error": "Message a student can read" }` with a
  4xx or 5xx status, and always `Content-Type: application/json`, so the app can tell them
  from the site's HTML 404 page.
- **No CORS** is needed: the app is not a browser.
- **Caching:** `Cache-Control: no-store` on all of them.

Each route is a thin wrapper: read the token, call the existing server function with
`{ data: { token, ... } }`, and return its result. Shapes below are the server functions' own
return types unless noted.

## GET /api/app/daily

Today's state, from `getDailyState` in `src/lib/daily.functions.ts`. Like the site's `/daily`
page, it reuses an unfinished session from today or starts one.

```json
{
  "day": "2026-11-02",
  "number": 210,
  "total": 20,
  "result": null,
  "sessionId": "3b1d…",
  "problems": [
    { "kind": "sequence", "terms": ["2", "6", "18"], "answer": { "n": 54, "d": 1 }, "id": 41 },
    { "kind": "mental_maths", "text": "48 × 7", "answer": 336 },
    { "kind": "fast_fractions", "numerator": 3, "denominator": 8, "answer": "0.375", "options": ["0.375", "…"] },
    { "kind": "sprint", "id": "an-12", "type": "analogy", "prompt": "…", "options": ["…"], "answer": 2, "explanation": "…" }
  ]
}
```

`result` is `{ score, total, durationMs, detail: ("c" | "w" | "s")[] }` once played, and then
`sessionId` is null and `problems` is the set that was played.

## POST /api/app/daily

Submits a run, through `submitDaily`, which claims the session and marks the answers itself.

```json
{ "sessionId": "3b1d…", "answers": [{ "i": 0, "a": "54", "t": 2140 }, { "i": 1, "a": "!skip", "t": 5020 }] }
```

`i` is the question index (consecutive from 0), `a` the answer as typed (an option's text for
multiple choice, `!skip` for a skip), `t` milliseconds since the run started, at least 200 ms
apart. Reply: the `DailyResult` above.

## GET /api/app/streak

`fetchDailyStreak`: `{ current, best, playedToday, atRisk, week: [{ day, played, frozen, isToday }], freezesLeft }`.

## GET /api/app/leaderboard?board=daily|overall&period=…

One shape for both boards, so the app draws them the same way:

```json
{
  "entries": [{ "rank": 1, "username": "ada", "isYou": false, "university": "LSE", "score": 20, "durationMs": 61200 }],
  "players": 812,
  "you": { "rank": 140, "username": "rohan", "isYou": true, "university": null, "score": 15, "durationMs": 95000 }
}
```

- `board=daily`, `period=today|month|all`: from `fetchDailyBoard`. `score` and `durationMs`
  are the entry's own. `you` is the student's row: the matching entry, or for a rank below the
  board, a row built from `yourRank` and the student's own result. Null before they have
  played in the period.
- `board=overall`, `period=all|month`: from `fetchOaOverallLeaderboard`. `score` is `total`,
  `durationMs` is left out, `players` is `totalPlayers`, and `you` is built from its `you`
  (`rank`, `username`, `total`).

## GET /api/app/league

`fetchLeague`: `{ weekStart, endsAt, tier, cohort, members: [{ rank, points, zone, username, isYou, university }], you: { rank, points, zone }, lastWeek }`.
Placing the student in this week's cohort on first read is the same as on the site.

## POST /api/app/push-tokens and DELETE /api/app/push-tokens

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "ios" }
```

The app registers an **Expo push token**, not a raw APNs token: Expo's push service delivers
to both iOS (APNs) and Android (FCM) from one HTTP call, and that call is plain HTTP/1.1, so
the site's server can send it directly with no outbox. POST upserts the token for the
signed-in student (a token already held moves to whoever signed in, as
`saveNativePushToken` does); DELETE removes it for that student. Reply `{ "ok": true }`.

Storage: the existing `native_push_tokens` table, with one more column:

```sql
alter table public.native_push_tokens
  add column if not exists provider text not null default 'apns';
-- 'apns' rows are the Capacitor app's hex tokens, 'expo' rows the native app's.
```

## Sending: what changes in the site's push code

1. **A sender for Expo tokens.** In `sendNativePushes` (`src/lib/apns.server.ts`), rows with
   `provider = 'expo'` go to `https://exp.host/--/api/v2/push/send` (up to 100 messages per
   request) instead of APNs:

   ```json
   { "to": "ExponentPushToken[…]", "title": "Goldman Sachs Spring Week closes in 2 days",
     "body": "Applications close 20 Nov.", "sound": "default",
     "data": { "jobId": "0f8a7c1e-…", "url": "https://careers.gs.com/…" } }
   ```

   Delete the row when a ticket or receipt comes back with `DeviceNotRegistered`.

2. **`jobId` in opening payloads.** `PushMessage` gains an optional `jobId`, passed through to
   `data`. Tapping a notification with a `jobId` opens that opening in the app with its apply
   link; without one the app falls back to `url`. Set it in `renderPushPayload`
   (`scraper/push.ts`, new openings) and in the reminders below.

3. **Push for starred deadlines.** `scraper/reminders.ts` already emails a week out, two days
   out and on the day for each `saved_jobs` row. Send the same three moments as a push to the
   student's devices too, once per (user, opening, stage), with `jobId` set. This is the alert
   the app is built around.

4. **"A starred firm's portal opened."** New openings already push to students whose
   `alert_subscriptions` match (`sendPushAlerts`). For starred openings that close and come
   back next cycle, push when a `saved_jobs` row's job is relisted (`relisted_at` set) or when
   a new opening appears at a firm the student has starred before. Either can come after v1.

## Other website changes

- **Purchases in the iOS app.** The site hides checkouts when the user agent contains
  `simplytk-ios-app` (the Capacitor shell). The native app's web views send
  `simplytk-app/<version>` instead and, on iOS, need the same hiding, without the Capacitor
  plugin wiring in `initNativeApp`. Treat `simplytk-app/` plus an iPhone or iPad user agent as
  in-app in `isNativeIosApp` for the purchase checks only.
- **Sign in with Apple.** Turn on the Apple provider in Supabase Auth (Lovable Cloud) with the
  app's bundle id `com.simplytk.app` as an authorised client id. App Review requires it,
  because the website offers Google sign-in.
- **Universal links.** `/.well-known/apple-app-site-association` already names
  `com.simplytk.app`, so it serves the native app as soon as `APPLE_TEAM_ID` is set.
- **Web views signed in.** Pages opened from More (CV tools, guides) have their own sign-in
  today. A `POST /api/app/web-session` that returns a one-time sign-in link
  (`auth.admin.generateLink({ type: "magiclink" })` for the token's user) would let the app
  sign those pages in without asking again. Not needed for v1.
