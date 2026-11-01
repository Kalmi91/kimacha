// FB529 ("it does not say it, as if it went buggy"): expo-speech 56.0.3 shuts its Android
// TextToSpeech down when the Activity is destroyed (Back on the home screen, or Android reclaiming
// the Activity), but the module and its `by lazy` instance live on with the process. After the app
// is reopened every speak() fails with "speak failed: not bound to TTS engine" (logcat on the
// kimacha_smoke emulator, 2026-10-31), so the app stays silent until the process dies.
// The engine is bound to the React context, not to the Activity, so it is shut down with the
// module instead. Runs as postinstall (npm ci in CI and in the release worktree); SDK 56 links
// expo-speech as a prebuilt AAR, so package.json `expo.autolinking.android.buildFromSource` makes
// Gradle compile it from this patched source. lib/__tests__/expoSpeechPatch.test.ts fails
// when the file is not patched (e.g. an expo-speech update changed it: check whether the bug is
// fixed upstream and drop this script).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(
  new URL('../node_modules/expo-speech/android/src/main/java/expo/modules/speech/SpeechModule.kt', import.meta.url),
);
const before = `    OnActivityDestroys {
      textToSpeech.shutdown()
    }`;
const after = `    OnDestroy {
      _textToSpeech?.shutdown()
    }`;

if (!existsSync(file)) {
  console.warn(`patch-expo-speech: ${file} not found, skipped`);
} else {
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (source.includes(after)) {
    console.log('patch-expo-speech: already patched');
  } else if (source.includes(before)) {
    writeFileSync(file, source.replace(before, after));
    console.log('patch-expo-speech: TextToSpeech now shuts down with the module, not the Activity');
  } else {
    console.warn('patch-expo-speech: expected block not found, expo-speech changed (see lib/__tests__/expoSpeechPatch.test.ts)');
  }
}
