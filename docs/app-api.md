# The app's endpoints on simplytk.com

The native app reads openings and stars straight from the website's Lovable Cloud project
(`jobs`, `companies`, `expected_openings` and `opportunities` are public to read;
`saved_jobs` and `applications` are each student's own under row-level security, and the
app writes `applications` the way the site's `src/lib/user-tracker.ts` does), and signs in through its auth with the same accounts. Everything else
runs server code that only the website has, behind a small JSON API under
`https://simplytk.com/api/app/`.

The website's side of the contract is `docs/native-app-api.md` in
[txnujk09/simplytk-mentor-hub](https://github.com/txnujk09/simplytk-mentor-hub); that page is
the source of truth. This one records what the app relies on. The calls are in
`src/lib/site-api.ts`.

## Conventions

- **Auth.** `Authorization: Bearer <access token>`. A missing or expired token gets `401`.
- **Replies** are JSON with `Cache-Control: no-store`. Errors are `{ "error": "..." }`
  (400, 401 or 500). The app shows the message.
- **Time zone.** The daily, streak and leaderboard calls send the phone's IANA zone as
  `tz` (`?tz=Europe/London` on a GET, `"tz"` in a POST body), so "today" is the student's
  day. Without it the site counts in UTC.
- If the site ever answers one of these paths with its HTML 404 page, the call throws
  `SiteApiMissing` and the screen offers the website's own page instead.

## Routes the app calls

| Call | Route | Reply |
| --- | --- | --- |
| `getDaily` | `GET /api/app/daily?tz=` | `{ day, number, total, result, sessionId, problems }` |
| `submitDaily` | `POST /api/app/daily` `{ sessionId, answers, tz }` | the `result`: `{ score, total, durationMs, detail }` |
| `getStreak` | `GET /api/app/streak?tz=` | `{ current, best, playedToday, atRisk, week, freezesLeft }` |
| `getLeaderboards` | `GET /api/app/leaderboard?period=today\|month\|all&tz=` | `{ period, board, universities }` |
| `getLeague` | `GET /api/app/league` | `{ weekStart, endsAt, tier, cohort, members, you, lastWeek }` |
| `savePushToken` | `POST /api/app/push-token` `{ token, platform }` | `{ ok, provider }` |
| `deletePushToken` | `DELETE /api/app/push-token` `{ token }` | `{ ok }` |
| `getOaPrep` | `GET /api/app/oa-prep` (no token needed) | `{ since, firms, providers, assessments, plan, faqs }` |
| `getDuels` | `GET /api/app/duels` | `{ games, duels }` |
| `createDuel` | `POST /api/app/duels` `{ game }` | `{ code }` |
| `getDuel` | `GET /api/app/duels/<code>` | the duel, with `link` and each side's `scoreText` |
| `actOnDuel` | `POST /api/app/duels/<code>` `{ action: accept\|cancel }` | the duel |
| `getCourse` | `GET /api/app/course` | `{ tracks, progress }` |
| `getCourseModule` | `GET /api/app/course?module=<id>` | `{ id, title, objectives, explainer, drills, questions }` |
| `askTutor` | `POST /api/app/course/tutor` `{ questionId, answer }` | `{ band, feedback, socraticQuestion, hint }` |
| `revealSolution` | `POST /api/app/course/solution` `{ questionId, gaveUp }` | `{ solution }` |

Notes:

- **Answers** are the run's timed events, `{ i, a, t }`: question index, the answer as
  typed (an option's text for multiple choice, `!skip` for a skip, as `SKIP_ANSWER` in the
  site's `oa-sessions.ts`), and milliseconds since the start, at least 200 ms apart.
  `createRecorder` in `src/lib/daily/answers.ts` keeps that spacing.
- **Leaderboard.** `board` is the top 100 players with `yourRank` and `percentile`;
  `universities` is each university's points. `playerBoard` and `universityBoard` in
  `src/lib/leaderboard.ts` turn them into the rows the Ranks tab draws, with your own row
  pinned. Below the top 100 the pinned row has your rank and percentile but no score. The
  site's overall board across every drill has no app route, so it stays a web page (Drills).
- **Not live yet.** A route the website doesn't serve yet answers 404 with an HTML page;
  `call` turns that into `SiteApiMissing`, and the screen offers the web page instead
  (`LoadState` in `src/components/load-state.tsx`).
- **1v1.** The app lists, starts, accepts, cancels and shares challenges. The runs
  themselves are played in the drill (`path`), natively when the app has that drill.
- **Push token.** The app registers its Expo push token after every sign-in and on the
  first star, and deletes it on sign-out. Registering it retires the old Capacitor shell's
  APNs rows for that student.

## Notifications

Every push about an opening carries `data.jobId` (open that opening) and `data.url` (where
the web would go, used when there is no `jobId`), plus `data.tag`. The site sends new-opening
alerts, deadline reminders a week, two days and on the day for starred openings, "remind me
to apply" reminders, streak nudges and mentoring check-ins. `hrefForNotificationData` in
`src/lib/routes.ts` maps them to screens.

## Not built yet

- **Web views signed in.** Pages opened from More have their own sign-in. A
  `POST /api/app/web-session` returning a one-time sign-in link would let the app sign
  them in without asking again.
- **Purchases.** The native app's web views send `simplytk-app/<version>` in their user
  agent. On iOS the site should hide checkouts for it, as it does for `simplytk-ios-app`.
