---
name: build-apk
description: >-
  Autonomous EAS cloud APK build for this Expo app. Pre-flights expo-doctor, a
  clean git tree, and known native issues (react-native-reanimated / worklets),
  then triggers an EAS cloud build of the installable `preview` profile, monitors
  it, and on failure parses the log, applies a known-safe fix, and retries up to
  3 builds total. Returns a verified, reachable install link. Trigger when the
  user says: "build apk", "build the app", "make an apk", "eas build",
  "cloud build", or "/build-apk".
---

# build-apk: autonomous EAS cloud APK build

Goal: hand back one **verified, downloadable install link** for an Android APK,
having fixed the common things that break the build on the way.

## Guardrails (read first)

Cloud builds cost real EAS build minutes and ~10-20 min each, so this skill is
careful with them:

- **Cap: 3 cloud builds per run, total** (first attempt plus at most 2
  fix-and-retry). After that, stop and report. Never loop forever.
- **Never `git push`, never `--force`, never rewrite history.** Local only.
- **Do not auto-commit the user's working changes.** A dirty tree is parked with a
  labelled `git stash` (recoverable), the build runs off the committed state, and
  the stash is restored at the end.
- **Auto-fix only from the known-safe table below.** Any error outside it: stop,
  show the parsed error plus the EAS log URL, and ask. No guessing fixes on native
  build failures.
- **Requires `eas` logged in.** If `eas whoami` fails, stop and ask the user to run
  `eas login` in their own terminal (interactive, cannot be done from here).

## Step 0: pre-flight (all must pass before the first build)

1. **EAS auth**: `eas whoami`. Empty or error: stop, ask user to `eas login`.
2. **Versions**: `npx expo-doctor`.
   - On version-mismatch findings: `npx expo install --check`, then
     `npx expo install --fix` to align deps to the installed SDK. Re-run
     `npx expo-doctor`. Still failing: stop and report.
3. **Native sanity, reanimated / worklets** (this app uses
   react-native-reanimated 4.x, which needs react-native-worklets plus its babel
   plugin; a missing plugin is the classic "reanimated linker / worklet" failure):
   - Confirm `react-native-worklets` is in package.json.
   - Confirm the babel config lists `react-native-worklets/plugin` as the **last**
     plugin. Reanimated 4 moved the babel plugin into worklets, so a stale
     `react-native-reanimated/plugin` entry is wrong for 4.x. Fix if needed.
4. **Clean tree**: `git status --porcelain`. Non-empty:
   `git stash push -u -m "build-apk autostash"`. Remember to pop it in Step 5.

## Step 1: trigger the build

Installable APK = the `preview` profile (eas.json: `preview` is internal
distribution, `buildType: apk`). Production is an `.aab` (Play Store), not directly
installable, so do not use it for an install link.

```bash
eas build -p android --profile preview --non-interactive --json
```

Capture the build `id` from the JSON.

## Step 2: monitor

Poll until done:

```bash
eas build:view <id> --json
```

Read `.status` (`finished` / `errored` / `canceled`) and, when finished,
`.artifacts.buildUrl`.

## Step 3: on failure, parse + fix + retry (within the 3-build cap)

Pull the error: `eas build:view <id> --json` (`.error`) plus the log URL. Match
against the known-safe fixes:

| Symptom in log | Fix |
|---|---|
| dependency / SDK version mismatch | `npx expo install --fix`, rebuild |
| reanimated worklet / "Reanimated babel plugin" / linker on reanimated | ensure `react-native-worklets/plugin` is the last babel plugin; remove stale `react-native-reanimated/plugin`; rebuild |
| `react-native-worklets` missing | `npx expo install react-native-worklets`, rebuild |
| Gradle OOM / Java heap | add `org.gradle.jvmargs=-Xmx4g` to android gradle.properties (config plugin / app.json if managed), rebuild |
| stale native dirs after a dep change | `npx expo prebuild --clean`, then rebuild |

Apply exactly one fix, then return to Step 1. Anything not in the table, or the
3rd build still failing: **stop**, report the parsed error plus log URL, restore the
stash, hand control back.

## Step 4: verify the link

From the finished build's `.artifacts.buildUrl`:
- Confirm it is non-empty and reachable:
  `curl -sI -o /dev/null -w '%{http_code}' <url>` should be 2xx or 3xx.
- Only then report it as the install link.

## Step 5: restore

If Step 0 stashed: `git stash pop`. Confirm the tree matches the pre-run state.

## Output to the user

- The verified install link plus the EAS build id / page.
- Any fixes that were auto-applied, so the diff can be reviewed.
- If it stopped early: which gate, the parsed error, the log URL.

## Notes

- eas.json profiles: `development` (dev-client apk), `preview` (internal apk, use
  this one), `production` (aab, store). `appVersionSource: remote`.
- Related helper, out of scope here: `~/.config/personal-auto/deploy_kimacha_apk.py`
  pushes an already-built APK onward.
