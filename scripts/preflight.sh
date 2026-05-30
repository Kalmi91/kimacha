#!/usr/bin/env bash
# Pre-flight checks before any Kimacha build.
# Verifies: (1) git working tree clean, (2) expo-doctor passes,
# (3) installed package versions match the Expo SDK.
# Exits non-zero on any failure so a build pipeline can gate on it.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

fail=0

echo "==> [1/3] git clean check"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "FAIL: not inside a git repository"; exit 2
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "FAIL: working tree dirty — commit or stash before building:"
  git status --short
  fail=1
else
  echo "OK: clean working tree (branch: $(git branch --show-current))"
fi

echo "==> [2/3] expo-doctor"
if npx --no-install expo-doctor; then
  echo "OK: expo-doctor passed"
else
  echo "FAIL: expo-doctor reported issues"; fail=1
fi

echo "==> [3/3] expo package version match"
if npx --no-install expo install --check; then
  echo "OK: package versions match Expo SDK"
else
  echo "FAIL: package version mismatch — run 'npx expo install --fix'"; fail=1
fi

echo "----------------------------------------"
if [ "$fail" -ne 0 ]; then
  echo "PRE-FLIGHT FAILED"
  exit 1
fi
echo "PRE-FLIGHT PASSED"
