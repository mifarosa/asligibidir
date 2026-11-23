This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

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
npm test                    # unit tests
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run `npm run lint`, `npm test` and `npx expo export --platform web` before declaring any task done.

## Project layout

- `App.js` composes the single screen; keep logic out of it (no Expo Router; add it if more screens appear).
- `src/session.js`: scan state (pages + per-page edits) as a pure reducer.
- `src/imaging/`, `src/contact/`, `src/modes.js`: pure, platform-independent logic, unit tested with `npm test` (Node's test runner). Import siblings with explicit `.js` extensions so Node can run them.
- `src/hooks/`: React hooks bridging pure logic and the platform layer.
- `src/ui/`: presentational components; colors and text styles come from `src/ui/theme.js`.
- `src/platform/*.web.js` / `*.native.js`: platform layer (pixel access, export, OCR). Keep both files exporting the same API.
- `public/`: PWA files (`index.html` template, `manifest.webmanifest`, `sw.js`, icons), copied as-is into `dist/` by `expo export`.
- Formatting is Prettier (`npm run format`); CI runs `npm run lint`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
