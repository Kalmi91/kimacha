// FB529: scripts/patch-expo-speech.mjs (postinstall) keeps the Android read-aloud alive after the
// Activity is destroyed and the app is reopened in the same process. Without it every speak() fails
// with "not bound to TTS engine" and the app is silent.
import { readFileSync } from 'fs';
import { join } from 'path';

const moduleSource = readFileSync(
  join(__dirname, '../../node_modules/expo-speech/android/src/main/java/expo/modules/speech/SpeechModule.kt'),
  'utf8',
);

describe('expo-speech Android patch (FB529)', () => {
  it('the TextToSpeech is shut down with the module, not with the Activity', () => {
    expect(moduleSource).not.toContain('OnActivityDestroys');
    expect(moduleSource).toContain('_textToSpeech?.shutdown()');
  });

  it('Gradle builds expo-speech from the patched source, not from the prebuilt AAR', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.expo.autolinking.android.buildFromSource).toContain('expo-speech');
  });
});
