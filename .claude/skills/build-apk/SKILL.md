---
name: build-apk
description: >-
  Build the installable Kimacha release APK locally with Gradle and upload it to
  Google Drive, on the stable share link Kálmán installs from. Local is the only
  path that produces an APK the phone will accept, because the installed app is
  signed with this repo's debug keystore and an EAS cloud build is signed with a
  different key. Trigger when the user says: "build", "kimacha build", "build
  apk", "csináld meg a buildet", "töltsd fel az apk-t", or "/build-apk".
---

# build-apk: local release build, then Drive

Goal: one installable APK on the usual Drive link, which installs **over** the
copy already on the phone without losing the learner's progress.

Every rule below comes from a build round that went wrong on 2026-09-05. Follow
the order; the verification step in particular is what makes this repeatable.

## Why local, not EAS

`eas build` works and produces a valid APK, but EAS signs with its own release
keystore. The app on Kálmán's phone is signed with `android/app/debug.keystore`
(this project's `release` buildType points at `signingConfigs.debug`), so the
phone rejects an EAS build with **"App not installed as package conflicts with
an existing package"**. The reference fingerprint every good build must carry:

```
SHA-256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
```

EAS also keeps its own version counter. With `appVersionSource: remote` it
stamped versionCode 3 over the phone's 36, which Android reports as
**"App not installed as package appears to be invalid"** (a downgrade, not a
corrupt file). `eas.json` is back on `"appVersionSource": "local"`; leave it.

## Step 1: bump the version in BOTH places

The native project is checked in and is **not** regenerated from `app.json`
(no `expo prebuild` in this flow), so `app.json` alone does not reach the APK.
Patch-bump both, to the same numbers:

| File | Fields |
|---|---|
| `app.json` | `expo.version`, `expo.android.versionCode` |
| `android/app/build.gradle` | `versionCode`, `versionName` |

The new `versionCode` has to be higher than what the phone has, or Android
refuses the install. Read the current value from the phone's APK if unsure:
`aapt2 dump badging <apk>` on the copy currently in Drive.

Commit this as `chore(release): <version> (<code>)`. This repo is public and
kept free of AI markers, so the commit message carries no `Co-Authored-By`,
no `Claude-Session`, and no "Generated with" line.

## Step 2: build

Two environment variables are required, and neither is set in the agent's
shell by default:

```bash
cd /home/kalmi/ai/kimacha/android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
ANDROID_HOME=/home/kalmi/Android/Sdk \
ANDROID_SDK_ROOT=/home/kalmi/Android/Sdk \
./gradlew :app:assembleRelease --console=plain
```

- Without `JAVA_HOME`: `default-java` is JVM 11 and Gradle stops with
  *"Gradle requires JVM 17 or later"*.
- Without `ANDROID_HOME`: *"SDK location not found"*.
- Name the task `:app:assembleRelease`, not bare `assembleRelease`. The bare
  name resolved only inside the included builds and reported
  *"28 actionable tasks: 28 up-to-date"* without touching the app module.
- A real full build reports roughly **529 actionable tasks** and takes 2-15
  minutes. Run it in the background and wait for the completion notification.

Output path: `android/app/build/outputs/apk/release/app-release.apk`

## Step 3: verify the artifact before uploading

This step exists because a stale August APK was verified and nearly shipped:
Gradle can fail while the background wrapper still reports exit code 0, and the
previous APK stays on disk looking perfectly valid.

```bash
APK=/home/kalmi/ai/kimacha/android/app/build/outputs/apk/release/app-release.apk
ls -l --time-style=+%m-%d_%H:%M "$APK"
~/Android/Sdk/build-tools/36.0.0/aapt2 dump badging "$APK" | head -1
~/Android/Sdk/build-tools/36.0.0/apksigner verify --print-certs "$APK" | grep -i 'SHA-256 digest'
```

All three have to line up before the upload:

1. **Timestamp** is from this build, not an earlier day.
2. **versionCode / versionName** match what Step 1 set.
3. **Signer SHA-256** equals `fac61745…033b9c`.

Any mismatch means the build did not actually run. Read the Gradle log the
wrapper points at (`~/.local/share/rtk/tee/*_gradlew_build.log`), fix the cause,
and build again; never upload an artifact that fails these three.

## Step 4: upload to Drive

```bash
python3 ~/.config/personal-auto/deploy_kimacha_apk.py "$APK"
```

The helper finds-or-creates the `kimacha` folder in My Drive, replaces the
contents of `kimacha-a1-release.apk`, and keeps the same file ID, so the share
link Kálmán already has stays valid. It prints `SIZE_MATCH True` plus the
FILE_ID and view link; treat anything else as a failed upload.

Stable link: https://drive.google.com/file/d/1SwZFdG5mLk1-Bh29G6HVQjNKmZTxdCiQ/view

These credentials work from the agent's sandbox, so there is no need to send
the user to their own terminal for this.

## Step 5: hand over

Report the Drive link, the version and versionCode, and confirmation that the
signer matched. Worth adding: the Drive filename never changes, so if a
download of the previous APK is still in the phone's Downloads folder, Android
may offer that stale file again; deleting it avoids a confusing repeat of an
install error that is already fixed.

## Reading an install failure

| Phone says | Cause | Fix |
|---|---|---|
| package appears to be invalid | versionCode lower than installed | bump both version fields, rebuild |
| package conflicts with an existing package | signed with a different key | build locally, never EAS |
| nothing happens / same error as before | phone reused a cached download | delete the old APK from Downloads |

If a signing key ever has to change on purpose, the learner's data survives via
the app's own Settings → Backup, uninstall, install, Settings → Restore.

## Notes

- Never `git push` and never rewrite history here; the release commit stays local.
- One shell gotcha: the command wrapper mangles `case … ;;` blocks in bash, so
  write polling loops with `if` instead.
- `npx expo-doctor` currently reports an SDK 57 Hermes advisory and patch-level
  package drift. Both were present for the last several successful releases;
  they are not blockers, and `expo install --fix` has caused more trouble than
  it solved in this project.
