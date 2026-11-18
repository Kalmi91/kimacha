// Run the installer against an isolated copy, without changing the installed native dependency.
import { spawnSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';

it('stops utterances queued before Android TTS initialization, with an idempotent patch', () => {
  const fixture = mkdtempSync(join(__dirname, 'speech-stop-'));
  const script = join(fixture, 'scripts/patch-expo-speech.mjs');
  const modulePath = 'node_modules/expo-speech/android/src/main/java/expo/modules/speech/SpeechModule.kt';
  const native = join(fixture, modulePath);
  try {
    mkdirSync(dirname(script), { recursive: true });
    mkdirSync(dirname(native), { recursive: true });
    copyFileSync(join(__dirname, '../../scripts/patch-expo-speech.mjs'), script);
    copyFileSync(join(__dirname, '../..', modulePath), native);
    const run = () => {
      const result = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 10000, windowsHide: true });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      return readFileSync(native, 'utf8');
    };
    const patched = run();
    // Initialization drains this queue under the same lock, so a stop cannot race that drain.
    expect(patched).toMatch(/AsyncFunction<Unit>\("stop"\)\s*\{\s*synchronized\(this@SpeechModule\)\s*\{\s*delayedUtterances\.clear\(\)\s*textToSpeech\.stop\(\)/);
    expect(run()).toBe(patched);
  } finally {
    if (!resolve(fixture).startsWith(`${resolve(__dirname)}${sep}`)) throw new Error('Unexpected fixture path');
    rmSync(fixture, { recursive: true, force: true });
  }
});
