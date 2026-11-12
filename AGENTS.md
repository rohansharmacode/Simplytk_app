This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## This project

The simplytk app is native where students spend their time (Home, Tracker, Daily, Ranks)
and opens the rest of https://simplytk.com in web views from the More tab. It uses the
website's backend: its Supabase project directly, and the `/api/app/*` routes in
docs/app-api.md. The website's source is github.com/txnujk09/simplytk-mentor-hub, where
`claude/*` PRs auto-merge to production once CI passes, so never open one there without
the owner's go-ahead. README.md explains the structure. Before changing things, know these rules:

- Pure logic lives in `src/lib` and has unit tests in `src/lib/__tests__`. Keep it that way:
  link classification (`site.ts`), deep-link mapping (`routes.ts`), the injected bridge
  script (`bridge.ts`), the drills' catalogue and question generators (`drills/`), the
  tracker's filters and deadlines (`tracker/openings.ts`), the daily challenge's marking and
  keypad (`daily/answers.ts`), leaderboard wording (`leaderboard.ts`), phone sign-in's
  number parsing and error wording (`phone.ts`), reading Google sign-in's return (`google.ts`),
  1v1 wording (`duels.ts`), the interview course's bands (`course.ts`) and the AI tools'
  allowance lines, timers and counts (`ai-tools.ts`).
- The bridge script is a string run inside web pages. Write it in ES5-style JavaScript and
  test it through `bridge.test.ts`, which executes it in a sandbox.
- `docs/web-integration.md` and `docs/app-api.md` are the contract with the website. Update
  them when the bridge, the link mapping, the notification payload or an endpoint changes.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
