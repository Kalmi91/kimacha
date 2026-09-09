#!/usr/bin/env bash
# Installs the release APK on the running emulator, opens it, and fails if the
# process is gone or the log carries a fatal exception. This is a "does it come
# up" check, not a UI test: anything deeper belongs in the jest suite.
set -euo pipefail

PACKAGE="com.kimachaapp.kimacha"
APK=$(find android/app/build/outputs/apk/release -name '*.apk' | head -1)

if [ -z "$APK" ]; then
  echo "::error::No release APK was produced by the gradle build."
  exit 1
fi

adb install -r "$APK"
adb logcat -c
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1

# React Native needs a moment to mount the first screen; a crash on startup
# usually lands well inside this window.
sleep 30

adb logcat -d > launch-logcat.txt

if ! adb shell pidof "$PACKAGE" > /dev/null; then
  echo "::error::$PACKAGE is not running 30s after launch, it started and died."
  tail -200 launch-logcat.txt
  exit 1
fi

if grep -qE 'FATAL EXCEPTION|E AndroidRuntime' launch-logcat.txt; then
  echo "::error::A fatal exception was logged during startup."
  grep -B5 -A30 -E 'FATAL EXCEPTION|E AndroidRuntime' launch-logcat.txt | head -80
  exit 1
fi

echo "$PACKAGE launched and is still running."
