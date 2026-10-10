# Kimacha

[![CI](https://github.com/Kalmi91/kimacha/actions/workflows/ci.yml/badge.svg)](https://github.com/Kalmi91/kimacha/actions/workflows/ci.yml)
[![Smoke](https://github.com/Kalmi91/kimacha/actions/workflows/smoke.yml/badge.svg)](https://github.com/Kalmi91/kimacha/actions/workflows/smoke.yml)
[![Hygiene](https://github.com/Kalmi91/kimacha/actions/workflows/hygiene.yml/badge.svg)](https://github.com/Kalmi91/kimacha/actions/workflows/hygiene.yml)

Kimacha is a spaced-repetition language trainer for Android (an Expo build also runs on the web).
English speakers learn Spanish, Spanish speakers learn English. You learn words on cards, practise
grammar by building sentences, and check your progress with level exams. Spanish audio is Mexican
Spanish (`es-MX`).

The repository is published for viewing and evaluation. It is not open source: see
[Licence](#licence).

## Features

The app has four tabs.

- **Learn** (the `PCIC` tab): a deck per level, A1 to B2. Word cards ask you to type the answer, and
  Spanish nouns come with an article picker. Sentence cards appear once you know the words in them.
  A daily limit caps the new cards. Cards can be read aloud. The tab also holds the level exams and
  the 3 minute placement test.
- **Grammar**: a course from A1 to C1, split into units and lessons. A lesson explains a point and then
  drills it: choose, article, match, form the word, say why, transform, spot the mistake, order,
  dictation.
- **Stats**: study minutes, streak, weekly goal, and the A1 and A2 practice exams.
- **Settings**: direction (en to es or es to en), 24 themes plus a custom mix, colour palettes,
  backup and restore to a file, loading your own mistakes from a file to practise them, credits,
  feedback.

## How learning works

- **One scheduler.** Cards follow SM-2, an Anki-style scheduler (`lib/sm2.ts`): new, learning and
  review states, an ease factor that starts at 2.5 and never drops below 1.3, and four grades. A word
  comes back when you are about to forget it.
- **Never a sentence with an unknown word.** A sentence card is shown only when every word in it is
  one you already answered correctly, an inflected form of such a word, or a function word
  (`lib/knownSentence.ts`). A sentence also stays inside the grammar its level has unlocked
  (`lib/grammar/tenseGate.ts`).
- **Grammar course.** Lessons live in `data/games/grammar/<lang>/`, one JSON file per topic, in the
  order of the syllabus (`lib/grammar/syllabus.ts`).
- **Level exams.** A level exam (words, grammar, reading) unlocks when enough words of that level are
  learned and one grammar lesson of the level is done (`lib/exam/unlock.ts`). There are no lives: a
  missed question shows the right answer.
- **Practice exams.** A1 and A2 practice exams with reading, writing, listening and speaking papers,
  modelled on the official exam format. They are shorter than the real exams and the points are
  scaled, so treat the result as a guide.
- **UI languages.** English and Spanish. The interface follows your native language of the pair.

## Tech stack

- Expo SDK 56, React Native 0.85, React 19, TypeScript 6
- `expo-router` for file-based navigation, `expo-sqlite` for the local store (progress never leaves
  the device unless you export a backup), `expo-speech` for audio
- `react-native-reanimated`, `react-native-web`
- Jest (`jest-expo`) and React Native Testing Library, ESLint with the Expo config

## Project structure

```text
app/          screens and routes (expo-router); app/(tabs) holds the four tabs
components/   shared UI: learn cards, grammar drills, exam screens, themes
constants/    colours, fonts, themes
data/         word lists, grammar lessons, topics (JSON); .ts files only wire them up
lib/          scheduler, exam logic, grammar syllabus, i18n, database, speech
scripts/      content audits and checks run by hand (word lists, sentences, UI overlap)
store/        Google Play listing assets and the privacy policy
docs/         docs/NORTH-STAR.md, the product rules the code is built to
assets/       fonts, images, word photos, branding
```

Data layout: Spanish words are in `data/words-open/{a1,a2,b1,b2}.json`, English words in
`data/words/en/`. Add or edit entries in those JSON files, never in the `.ts` wiring files.

## Getting started

Requirements: Node.js 20 and npm.

```bash
git clone https://github.com/Kalmi91/kimacha.git
cd kimacha
npm ci
git config core.hooksPath .githooks   # local guards, see CONTRIBUTING
npm start                              # Expo dev server
npm run web                            # run in the browser
npm run android                        # needs an emulator or device and the Android SDK
```

## Quality gates

Run these before every push. CI runs the same three.

```bash
npm run typecheck:ci   # tsc --noEmit
npm run lint           # expo lint
npm run test:ci        # jest with coverage
```

`npm run ui:overlap` renders the web build in headless Chrome and reports clipped, overlapping,
overflowing or low-contrast text for every theme. Run it after UI changes.

## CI

All workflows are in `.github/workflows/`. Superseded runs on the same ref are cancelled.

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | push to `main`, pull request | typecheck and lint in one job, Jest with coverage in another |
| `smoke.yml` | push to `main`, pull request | bundles the app for Android with Metro, so a broken import or data file fails the check; also bundles the Play flavour and fails if the feedback endpoint is in it |
| `hygiene.yml` | push to `main`, pull request | no agent working documents, no file both tracked and ignored, Conventional Commits, no AI attribution lines, release tags exist |
| `android.yml` | manual | `expo prebuild`, then a debug APK with Gradle |
| `android-release.yml` | manual | prebuild, release build, signing from repository secrets, GitHub Release on a `v*` tag |
| `eas-build.yml` | manual | optional EAS cloud build |

The badges above show the three workflows that run on every change. The manual workflows are not
part of the normal release path.

## Release process

1. Bump `expo.version` and `expo.android.versionCode` in `app.json` and commit as
   `chore(release): X.Y.Z (versionCode)`.
2. The native project is `android/`. `npx expo prebuild --platform android --clean` generates it
   from `app.json` and the config plugins in `plugins/`, so it is gitignored and never committed or
   edited by hand. Native settings belong in `app.json` (permissions, R8 and resource shrinking
   through `expo-build-properties`) or in a plugin (`withPlaySigning.js`, `withNativeDebugSymbols.js`).
3. Build on Windows. It needs JDK 17 and the Android SDK (platform 36, build-tools 36, NDK 27.1.12297006,
   licences accepted). In PowerShell:

   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"   # any JDK 17
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   npm ci
   npx expo prebuild --platform android --clean
   cd android
   .\gradlew.bat assembleRelease   # android\app\build\outputs\apk\release\app-release.apk
   ```

   Without further flags the release is signed with the public React Native debug key that the
   prebuild template ships. That is the sideload APK, and it keeps updating over the one already
   installed.
4. Build the Play bundle, again from `android\`, with `.\gradlew.bat :app:bundleRelease -PplayStore=true` and
   `$env:EXPO_PUBLIC_PLAY_STORE = "1"`. That flag switches the Play flavour on (`lib/buildFlavor.ts`):
   feedback goes through the share sheet instead of a network call. Metro does not key its cache on
   the variable, so delete `$env:TEMP\metro-*` and `node_modules\.cache` first. `-PplayStore=true` makes
   `plugins/withPlaySigning.js` sign with the upload key. The key is described by a
   `keystore.properties` file (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`; a relative
   `storeFile` is resolved next to the properties file). Its path comes from the environment variable
   `KIMACHA_KEYSTORE_PROPERTIES`, default `%USERPROFILE%\.kimacha\keystore.properties`; the build fails
   with a message when it is missing. Keys and passwords stay on the maintainer's machine and never
   enter the repository (`*.jks` and `keystore.properties` are gitignored).
5. Upload the bundle in the Google Play Console.
6. Tag the commit `vX.Y.Z` and publish a GitHub Release. `hygiene.yml` warns when a release commit has
   no tag.

## Privacy

Learning progress and settings are stored in a local database on the device. The full policy, including
what the app sends and what it does not, is in [`store/privacy-policy.html`](store/privacy-policy.html).

## Contributing

Kimacha is maintained by one person. Read [CONTRIBUTING](.github/CONTRIBUTING.md) and
[docs/NORTH-STAR.md](docs/NORTH-STAR.md) before opening a pull request, and follow the
[code of conduct](.github/CODE_OF_CONDUCT.md). Report security problems privately, see
[SECURITY](.github/SECURITY.md).

## Licence

Copyright (c) 2026 Fekete Kálmán. All rights reserved. The code, the word data and the assets may be
viewed and evaluated, but not copied, modified or distributed without written permission. See
[LICENSE](LICENSE).

Third-party components keep their own licences: the English B1 word list (CEFR-J), the Wikimedia
Commons word photos and the bundled fonts. Details are in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
