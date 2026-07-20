# Kimacha DevOps — BUILD manifest

> **Scoped frame for the CDMX portfolio project #3** ("Kimacha DevOps-osítás").
> This tracks **only the DevOps / CI-CD work** on the existing Kimacha app — it
> does **not** drive app-feature development (see `TASK.md` / iteration plans for
> that). Load this to resume the DevOps work.
>
> **Trigger:** "építsd a kimacha devops-t" / "build the devops" → token-burn the
> queue below per the *Build contract*. (The bare "építsd az appot" is ambiguous
> in this repo — it could mean app features — so use the devops-scoped phrase.)

- **Repo:** `/home/kalmi/ai/kimacha` (Expo / React Native, git)
- **Goal:** Production-grade CI/CD for a **real app** (stronger in interviews
  than a demo): lint, typecheck, tests, signed release builds, release
  automation.
- **Division of labor:** agent **writes code/config + offline checks**; the user
  runs anything needing secrets or a device (signing keystore, EAS account,
  pushing tags). CI itself runs on GitHub Actions.

> **What "% Done" means:** *authored* — workflow/config/test code writable
> offline. A green CI run, a signed APK, store submission = runtime artifacts in
> the **live-verified** bucket + *Definition of Done*.

---

## Status — ~50% authored · tests live-verified locally

Already in place (`.github/workflows/`):
- `ci.yml` — typecheck (`typecheck:ci`, scoped) + lint + **tests** on push/PR,
  npm cache, concurrency-cancel. **Works.**
- `android.yml` — Expo prebuild → debug APK via Gradle → artifact upload.
  **Works.**

| # | Component | Weight | Done | Notes |
|---|-----------|:------:|:----:|-------|
| 1 | CI quality (typecheck + lint) | 15% | 90% | exists; `typecheck:ci` is **scoped** (exam/data subtree mid-refactor) → goal full `tsc` |
| 2 | Debug APK build CI | 10% | 100% | `android.yml` exists ✓ |
| 3 | Automated tests + test CI job | 25% | 100% | jest-expo harness; 17 tests (levenshtein, languages, ProgressMeter) **pass locally**; `test`/`test:ci` scripts; `test` CI job + coverage artifact |
| 4 | Signed **release** build (APK/AAB) | 20% | 100% | `android-release.yml` (workflow_dispatch): prebuild → bundle/assembleRelease → zipalign+apksigner (APK) + jarsigner (AAB) → upload. Needs keystore secrets (runtime) |
| 5 | Release automation (tag → GH Release) | 15% | 100% | `v*` tag → same signed build → `softprops/action-gh-release` attaches APK+AAB + auto notes (contents: write) |
| 6 | EAS build profile | 5% | 100% | `eas.json`: development/preview/production profiles + channels + autoIncrement; optional `eas-build.yml` (workflow_dispatch, profile choice) |
| 7 | Status badges + DevOps section in README | 5% | 100% | `README.md`: CI + APK badges, DevOps/CI-CD section, pipeline mermaid, workflow table, release process |
| 8 | Analytics backend (Terraform) — optional | 5% | 0% | "ha lesz"; deferred/optional |

**Overall: ~94% authored** (Q1–Q6 done; Q2 full-typecheck deferred to the app
refactor, Q7 analytics optional). CI quality + debug build verified by real runs;
the test suite is **live-verified locally** (`npm test` → 17 passed). Signed
release + tag-triggered GitHub Release + EAS profiles + README authored (real
signed/cloud builds are runtime — need the user's keystore / a `v*` tag / an
Expo token).

---

## Build queue (ordered — token-burnable, no device/secret needed)

### Q1 — Test harness + test CI job  (component 3 → 100%) ✅ DONE 2026-06-03
- Add Jest + React Native Testing Library (or `jest-expo` preset); a `test`
  (and `test:ci` with coverage) script in `package.json`.
- Write a first batch of tests (a util + a component) so the job is meaningful.
- Add a `test` job to `ci.yml` (after typecheck/lint), upload coverage.
- **Acceptance:** ✓ `jest.config.js` (jest-expo preset); `test`/`test:ci`
  scripts; devDeps jest@29 + jest-expo@~56 + @testing-library/react-native@13 +
  react-test-renderer@19.2.3 + @types/jest. Tests: `lib/__tests__/levenshtein`
  (6), `lib/__tests__/languages` (8), `components/__tests__/ProgressMeter` (3) —
  **`npm test` → 17 passed locally** (deps installed, real run, not just
  authored). `test` job added to `ci.yml` (npm ci → test:ci → coverage artifact);
  YAML valid. `coverage/` gitignored.

### Q2 — Full typecheck goal  (component 1 → 100%)
- Track the exam/data refactor; once done, switch CI from `typecheck:ci` to full
  `typecheck`. Until then, document the scope gap in a comment (already present).
- **Acceptance:** `npm run typecheck` passes (or the remaining scope is listed).

### Q3 — Signed release build  (component 4 → 100%) ✅ DONE 2026-06-03
- `android-release.yml`: prebuild → `assembleRelease`/`bundleRelease`, signing
  from a base64 keystore + passwords in **GitHub Secrets**.
- Document required secrets (`ANDROID_KEYSTORE_B64`, `KEYSTORE_PASSWORD`, …) in
  this file; the **user** generates the keystore + adds the secrets.
- **Acceptance:** ✓ `android-release.yml` valid (workflow_dispatch). Builds
  unsigned release, then **signs post-build** (zipalign + apksigner for the APK,
  jarsigner for the AAB) — deterministic, independent of the regenerated
  `build.gradle` signingConfig. Fails fast with a clear message if
  `ANDROID_KEYSTORE_B64` is missing. Uploads `kimacha-release.apk` +
  `.aab`. Real signed build is **runtime** (needs the user's keystore secrets).

### Q4 — Release automation  (component 5 → 100%) ✅ DONE 2026-06-03
- On a `v*` tag: build the signed artifact + create a **GitHub Release** with the
  APK/AAB attached and auto-generated notes.
- **Acceptance:** ✓ Implemented in `android-release.yml` (DRY — same signed-build
  job). Added `push: tags: ['v*']` trigger + `permissions: contents: write`; a
  final `softprops/action-gh-release@v2` step (gated `if` tag) attaches the signed
  APK+AAB with `generate_release_notes`. YAML valid. Trigger = tag push.

### Q5 — EAS build profile  (component 6 → 100%) ✅ DONE 2026-06-03
- Flesh out `eas.json` (development/preview/production profiles); optional
  `eas build` job behind `workflow_dispatch`.
- **Acceptance:** ✓ `eas.json` valid — `development` (devClient, internal),
  `preview` (internal apk), `production` (app-bundle, autoIncrement), per-profile
  channels, `appVersionSource: remote`, `submit.production`. Optional
  `eas-build.yml` (workflow_dispatch + profile choice; uses `EXPO_TOKEN`; EAS
  manages signing remotely). Both valid. Cloud build = runtime (Expo token).

### Q6 — Badges + README DevOps section  (component 7 → 100%) ✅ DONE 2026-06-03
- CI/build status badges; a "DevOps" section describing the pipeline + a mermaid
  diagram (push → CI → tests → signed build → release).
- **Acceptance:** ✓ Created `README.md` (none existed): CI + Android-APK badges
  (`kalmi91/kimacha`), tech stack, dev commands, **DevOps/CI-CD** section with a
  mermaid pipeline (push/PR → ci → tests; tag → signed release → GitHub Release;
  dispatch → EAS), a workflow table, tests notes, and the release process. Badge
  targets all exist; mermaid fence balanced. (Badges go live once pushed to the
  GitHub remote.)

### Q7 — (optional) Analytics backend  (component 8)
- Only if an analytics backend lands: Terraform for a small API + DB. Defer
  until there's a real backend to deploy.

---

## Definition of Done (portfolio-ready)

- [ ] CI green on a PR: typecheck + lint + **tests** (with coverage).
- [ ] A pushed `v*` tag produces a **signed release** APK/AAB attached to a
      GitHub Release.
- [ ] README has badges + a DevOps section + pipeline diagram.
- [ ] CV bullets verified (tests + signed CD actually run, not aspirational).

---

## Build contract  (trigger: "építsd a kimacha devops-t" / "build the devops")

1. **Token-burn mode, no confirmation.** Start at the first incomplete queue
   item; execute downward.
2. **Code/config only.** Author files + offline checks (YAML/JSON parse,
   `npm test` if deps present, `bash -n`). Never block on a device, a keystore,
   or an EAS account — those are the user's runtime inputs.
3. **Commit per queue item** (Conventional Commits); update Status + queue in the
   same commit. **Do not touch app-feature code** outside the DevOps scope.
4. **Stop conditions:** queue empty / acceptance fails twice / a step needs a
   secret/device only the user can provide → stop, log, surface.
5. **On resume,** read this file first.

---

## Runtime / user inputs (agent cannot do these)

- Generate the Android signing keystore and add **4 repo Secrets** (Settings →
  Secrets and variables → Actions) — required by `android-release.yml` (Q3):
  - `ANDROID_KEYSTORE_B64` — `base64 -w0 release.keystore`
  - `ANDROID_KEYSTORE_PASSWORD` — keystore (store) password
  - `ANDROID_KEY_ALIAS` — key alias inside the keystore
  - `ANDROID_KEY_PASSWORD` — the key's password (often = store password)

  Generate once:
  ```bash
  keytool -genkeypair -v -keystore release.keystore -alias kimacha \
    -keyalg RSA -keysize 2048 -validity 10000
  base64 -w0 release.keystore   # → paste into ANDROID_KEYSTORE_B64
  ```
- An EAS/Expo account + token if EAS cloud builds are wanted (Q5).
- Push `v*` tags to trigger releases (Q4).

---

## Session log

- **2026-06-01** — DevOps frame created (`docs/DEVOPS.md`). Captured existing CI
  (typecheck/lint + debug APK build). Defined queue Q1–Q7. Next incomplete:
  **Q1** (test harness + test CI job).
- **2026-06-03** — Q1 done (token-burn): jest-expo harness + 17 tests
  (levenshtein/languages/ProgressMeter), `test`/`test:ci` scripts, `test` CI job
  + coverage artifact. **`npm test` → 17 passed locally** (live-verified, not just
  authored). Overall → ~50%. DevOps-scope only; no app-feature code touched.
  Next: **Q3** (signed release build — `android-release.yml` + keystore secrets).
  *(Q2 = full typecheck blocks on the app's exam/data refactor → skip for now.)*
- **2026-06-03** — Q3 done (token-burn): `android-release.yml` (workflow_dispatch)
  — prebuild → bundle/assembleRelease → post-build sign (zipalign+apksigner APK,
  jarsigner AAB) → upload. 4 keystore secrets documented in *Runtime / user
  inputs*. YAML valid. Overall → ~70%. Real signed build = runtime (user keystore).
  Next: **Q4** (release automation — `v*` tag → signed build + GitHub Release).
- **2026-06-03** — Q4 done (token-burn): extended `android-release.yml` with a
  `v*` tag trigger + `contents: write` + `softprops/action-gh-release` step
  (attaches signed APK+AAB, auto notes). DRY (reuses the Q3 signed build). YAML
  valid. Overall → ~85%. Runtime: push a `v*` tag (with keystore secrets set).
  Next: **Q5** (EAS build profiles in `eas.json`).
- **2026-06-03** — Q5 done (token-burn): `eas.json` development/preview/production
  profiles (channels, autoIncrement, appVersionSource remote, submit) + optional
  `eas-build.yml` (workflow_dispatch profile choice, `EXPO_TOKEN`). Valid. Overall
  → ~89%. Cloud build = runtime (Expo token).
  Next: **Q6** (badges + README DevOps section + pipeline mermaid).
- **2026-06-03** — Q6 done (token-burn): created `README.md` (badges, DevOps/CI-CD
  section, pipeline mermaid, workflow table, release process). Overall → ~94%.
  Queue effectively complete: **Q2** (full typecheck) waits on the app's exam/data
  refactor; **Q7** (analytics Terraform) is optional/deferred. Remaining work is
  runtime — keystore secrets + a `v*` tag (+ optional Expo token); push to the
  GitHub remote to light up the badges + run CI.
