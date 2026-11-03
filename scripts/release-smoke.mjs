// Release smoke test on the emulator (`npm run smoke:release`): installs the release APK OVER the installed
// app (an upgrade, like on the phone: the learner's data and the downloaded better voice stay), starts it
// and watches the log until the better voice has loaded and spoken, or the app died.
//
// Why: 4.1.29 passed every jest test and the emulator check of a debug build, yet closed on every start on
// the phone: R8, which only minifies the release build, had renamed the sherpa-onnx config fields that the
// native code reads over JNI. Only a minified build with the better voice installed shows that, so this
// runs the real release APK on a device that already has the voice (Settings, Better voice, downloaded
// once; every later upgrade keeps it).
//
// Pass = within the time limit the log shows a voice load ("[neural] loaded") and a sentence the voice
// spoke ("[neural] <lang>/<voice> first="), and the app still runs 10 s later. Since 4.1.31 the app opens
// silently and a voice loads on its first use, so the script prompts for two taps by hand (or with the
// emulator driver): a word's speaker button (loads the voice), then an example sentence's.
// Fail = the app crashed (anything of the app in the crash log, or its process is gone), or the better voice
// never loaded: then the run proved nothing (download the voice, or open a learn card that speaks).
// Partial = the voice loaded and the app stayed up, but no sentence was spoken in time.
//
// Exit code: 0 = pass, 1 = fail, 2 = the check itself could not run (no device, nothing to upgrade, install
// refused), 3 = partial.
//
// Usage: node scripts/release-smoke.mjs [<apk>] [--seconds 240] [--no-install]
//   <apk>         default android/app/build/outputs/apk/release/app-release.apk; its versionCode must be
//                 higher than the installed app's
//   --no-install  only starts and watches the installed app (shows that a broken build fails the check)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = 'com.kimachaapp.kimacha.app';
const SDK = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = path.join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');

const args = process.argv.slice(2);
const noInstall = args.includes('--no-install');
const secondsAt = args.indexOf('--seconds');
const seconds = secondsAt >= 0 ? Number(args[secondsAt + 1]) : 240;
const apk = args.find((a, i) => !a.startsWith('--') && (secondsAt < 0 || i !== secondsAt + 1))
  || path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

const adb = (list, timeout = 60000) =>
  execFileSync(ADB, list, { encoding: 'utf8', timeout, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cannotRun(message) {
  console.log(`SMOKE CANNOT RUN: ${message}`);
  process.exit(2);
}

function fail(message) {
  console.log(`SMOKE FAIL: ${message}`);
  process.exit(1);
}

function installedVersion() {
  const m = /versionCode=(\d+)/.exec(adb(['shell', 'dumpsys', 'package', PKG]));
  return m ? Number(m[1]) : null;
}

const appPid = () => adb(['shell', 'pidof', PKG]).trim();

// The first line that says why the app died, from the crash log (null = nothing of the app there).
function crashOf() {
  const lines = adb(['logcat', '-d', '-b', 'crash']).split(/\r?\n/);
  if (!lines.some(line => line.includes(PKG) || line.includes('app.kimacha'))) return null;
  const why = lines.find(line => /Abort message|FATAL EXCEPTION|Caused by/.test(line))
    || lines.find(line => line.includes('app.kimacha'));
  return why.replace(/^.*?: /, '').slice(0, 200);
}

const devices = (() => {
  try {
    return adb(['devices']).split(/\r?\n/).slice(1).filter(line => /\tdevice$/.test(line));
  } catch (e) {
    return cannotRun(`adb did not run (${String(e).slice(0, 100)})`);
  }
})();
if (devices.length !== 1) cannotRun(`needs exactly one running device, found ${devices.length}`);

const before = installedVersion();
if (!noInstall) {
  if (!fs.existsSync(apk)) cannotRun(`no APK at ${apk}`);
  if (before === null) cannotRun('the app is not installed: install the previous release and download the better voice first');
  try {
    adb(['install', '-r', apk], 300000);
  } catch (e) {
    cannotRun(`install refused (${String(e).slice(0, 160)})`);
  }
  const after = installedVersion();
  if (after === null || after <= before) cannotRun(`not an upgrade: versionCode ${before} -> ${after}`);
  console.log(`upgraded versionCode ${before} -> ${after}`);
} else if (before === null) {
  cannotRun('the app is not installed');
}

adb(['shell', 'am', 'force-stop', PKG]);
adb(['logcat', '-b', 'all', '-c']);
adb(['shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1']);

let started = false;
let loaded = null;
let spoke = null;
const deadline = Date.now() + seconds * 1000;
while (Date.now() < deadline) {
  await sleep(2000);
  if (crashOf()) {
    // The tombstone with the abort message lands seconds after the signal line.
    for (let i = 0; i < 8 && !/Abort message|FATAL EXCEPTION|Caused by/.test(crashOf()); i++) await sleep(2000);
    fail(`the app crashed: ${crashOf()}`);
  }
  const pid = appPid();
  if (pid && !started) console.log('the app is up and silent: tap the speaker button of the word on the learn card');
  if (pid) started = true;
  else if (started) fail('the app process is gone (no crash log line)');
  const log = adb(['logcat', '-d', '-b', 'main', '-s', 'ReactNativeJS']);
  if (!loaded) {
    loaded = /\[neural\] loaded [^\r\n]*/.exec(log)?.[0] ?? null;
    // The start-up speech went to the phone while the voice loaded; a sentence needs a tap now.
    if (loaded) {
      console.log(`${loaded}: play an example sentence now (its speaker button on a learn card, after the answer);`
        + ' a language\'s first sentence only loads its voice (the phone reads it), so play it again after that');
    }
  }
  spoke ??= /\[neural\] \w+\/\S+ first=[^\r\n]*/.exec(log)?.[0] ?? null;
  if (loaded && spoke) break;
}
if (!loaded) fail(`the better voice never loaded within ${seconds} s: download it in Settings, or open a learn card that speaks`);
if (!spoke) {
  if (crashOf() || !appPid()) fail('the app died after the voice loaded');
  console.log(`SMOKE PARTIAL: the voice loaded and the app stayed up, but no sentence was spoken within ${seconds} s: play one and run again`);
  process.exit(3);
}
await sleep(10000);
const crash = crashOf();
if (crash) fail(`the app crashed after speaking: ${crash}`);
if (!appPid()) fail('the app process is gone after speaking');
console.log(`SMOKE PASS: ${loaded} | ${spoke.slice(0, 120)}`);
