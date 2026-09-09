# Kimacha

[![CI](https://github.com/kalmi91/kimacha/actions/workflows/ci.yml/badge.svg)](https://github.com/kalmi91/kimacha/actions/workflows/ci.yml)
[![Android APK](https://github.com/kalmi91/kimacha/actions/workflows/android.yml/badge.svg)](https://github.com/kalmi91/kimacha/actions/workflows/android.yml)

A mobile language-learning app (Expo / React Native) with spaced-repetition
flashcards, sentence-ordering and typing cards, and per-level placement exams.
Multilingual UI (hu / en / es / de).

## Tech stack

- **Expo SDK 56** / React Native 0.85 / React 19 / TypeScript
- **expo-router** (file-based navigation), **expo-sqlite** (local store)
- **ts-fsrs** spaced-repetition scheduling

## Development

```bash
npm install
npm start          # Expo dev server
npm run android    # run on a device/emulator
npm test           # Jest (jest-expo) unit + component tests
npm run lint       # eslint (expo config)
npm run typecheck  # tsc --noEmit
```

## DevOps / CI-CD

Production-grade pipeline running entirely on GitHub Actions' free tier — lint,
typecheck and tests on every push/PR; signed release builds and GitHub Releases
on `v*` tags. Local Gradle builds keep CI at $0; EAS is available as an optional
cloud path.

```mermaid
flowchart LR
  dev["git push / PR"] --> ci["ci.yml<br/>typecheck · lint · tests"]
  ci -->|coverage| art["coverage artifact"]
  dev -->|push main| apk["android.yml<br/>debug APK"]
  tag["git tag v*"] --> rel["android-release.yml<br/>signed AAB + APK"]
  rel --> ghr["GitHub Release<br/>(artifacts + notes)"]
  disp["workflow_dispatch"] -.-> eas["eas-build.yml<br/>(optional EAS cloud build)"]
```

### Workflows

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | push / PR | typecheck (full project) + lint + **Jest tests** (+ coverage artifact); concurrency-cancels superseded runs |
| `android.yml` | push to `main`, manual | Expo prebuild → **debug APK** via Gradle → artifact |
| `android-release.yml` | `v*` tag, manual | prebuild → release build → **sign** (apksigner APK + jarsigner AAB) → on a tag, publish a **GitHub Release** with the artifacts |
| `eas-build.yml` | manual | optional **EAS** cloud build (profile choice); EAS manages signing |

### Tests

`jest-expo` preset. Pure-logic suites (`lib/__tests__/`) plus a component render
test (`components/__tests__/`). Run locally with `npm test`, in CI with
`npm run test:ci` (coverage).

### Release process

1. The user adds the signing secrets once — `ANDROID_KEYSTORE_B64`,
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
   (Settings → Secrets and variables → Actions).
2. `git tag v2.0.1 && git push --tags`.
3. `android-release.yml` builds + signs the AAB/APK and publishes a GitHub
   Release with auto-generated notes.
