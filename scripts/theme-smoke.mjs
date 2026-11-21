// Theme smoke test on the emulator (`npm run smoke:themes`): picks every theme of the INSTALLED app one by
// one (Settings, Theme, the tile), goes back to the tab bar and the Words tab, and checks that the app still
// runs and the crash log stays empty. Run it after `smoke:release`, which installs the release APK.
//
// Why: 4.2.11 passed every jest test and the release smoke test, yet closed at every start on the phone:
// the Night theme drew its tab capsule with RN 0.85's `experimental_backgroundImage`, which throws in
// LinearGradient.nativeCreate on Android. The release smoke test only ever ran the default theme.
//
// Pass = all themes picked, the app alive after each. Fail = the app crashed (at start, or after a theme:
// the theme is named). At the end the first theme (the default) is picked again.
//
// Exit code: 0 = pass, 1 = fail, 2 = the check itself could not run (no device, app not installed, a screen
// element not found).
//
// Usage: node scripts/theme-smoke.mjs [--only night,brutal] [--wait 3]
//
// Device: the one running emulator, so a phone on USB beside it is left alone. ANDROID_SERIAL chooses another
// device, or one of several emulators.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = 'com.kimachaapp.kimacha.app';
const SDK = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = path.join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const waitMs = Number(opt('--wait') ?? 3) * 1000;

const adb = (list, timeout = 60000) =>
  execFileSync(ADB, list, { encoding: 'utf8', timeout, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cannotRun(message) {
  console.log(`THEME SMOKE CANNOT RUN: ${message}`);
  process.exit(2);
}
function fail(message) {
  console.log(`THEME SMOKE FAIL: ${message}`);
  process.exit(1);
}

// Skin ids in their order in constants/Skins.ts; the first one is the default.
const allSkins = [...fs.readFileSync(path.join(ROOT, 'constants', 'Skins.ts'), 'utf8').matchAll(/^\s*id: '([a-z0-9]+)',/gm)].map((m) => m[1]);
if (allSkins.length < 2) cannotRun('no skin ids found in constants/Skins.ts');
const only = opt('--only')?.split(',');
const skins = only ? allSkins.filter((id) => only.includes(id)) : allSkins;

// The Settings and Words tab labels in every UI language (the tab buttons carry them as content-desc).
const tabLabel = (key) => fs.readdirSync(path.join(ROOT, 'lib', 'i18n')).flatMap((lang) => {
  const f = path.join(ROOT, 'lib', 'i18n', lang, 'common.ts');
  if (!fs.existsSync(f)) return [];
  const block = /^ {2}tabs: \{([\s\S]*?)^ {2}\},/m.exec(fs.readFileSync(f, 'utf8'))?.[1] ?? '';
  const m = new RegExp(`^\\s*${key}: '([^']+)'`, 'm').exec(block);
  return m ? [m[1]] : [];
});
const SETTINGS = tabLabel('settings');
const WORDS = tabLabel('pcic');

const appPid = () => adb(['shell', 'pidof', PKG]).trim();
function crashOf() {
  const lines = adb(['logcat', '-d', '-b', 'crash']).split(/\r?\n/);
  if (!lines.some((line) => line.includes(PKG) || line.includes('app.kimacha'))) return null;
  const why = lines.find((line) => /Abort message|FATAL EXCEPTION|Caused by|Exception/.test(line) && !line.includes('FATAL EXCEPTION'))
    || lines.find((line) => line.includes('FATAL EXCEPTION')) || lines.find((line) => line.includes('app.kimacha'));
  return why.replace(/^.*?: /, '').slice(0, 200);
}
async function alive(where) {
  await sleep(waitMs);
  const crash = crashOf();
  if (crash) fail(`${where}: the app crashed: ${crash}`);
  if (!appPid()) fail(`${where}: the app process is gone`);
}

function nodes() {
  let xml = '';
  for (let i = 0; i < 2 && !xml; i++) {
    try { xml = adb(['exec-out', 'uiautomator', 'dump', '/dev/tty'], 45000); } catch { try { adb(['shell', 'pkill', '-f', 'uiautomator']); } catch { /* none */ } }
  }
  const out = [];
  for (const m of xml.matchAll(/<node ([^>]*?)\/?>/g)) {
    const a = {};
    for (const p of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) a[p[1]] = p[2];
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(a.bounds || '');
    if (!b || +b[3] <= +b[1] || +b[4] <= +b[2]) continue;
    out.push({ id: (a['resource-id'] || '').replace(/^.*:id\//, ''), desc: a['content-desc'] || '', x: (+b[1] + +b[3]) >> 1, y: (+b[2] + +b[4]) >> 1 });
  }
  return out;
}
const screenSize = (() => {
  try {
    const m = /(\d+)x(\d+)/.exec(adb(['shell', 'wm', 'size']));
    return m ? { w: +m[1], h: +m[2] } : { w: 1080, h: 2400 };
  } catch { return { w: 1080, h: 2400 }; }
})();
const tap = (n) => adb(['shell', 'input', 'tap', String(n.x), String(n.y)]);
const swipeUp = () => adb(['shell', 'input', 'swipe', String(screenSize.w >> 1), String(Math.round(screenSize.h * 0.7)),
  String(screenSize.w >> 1), String(Math.round(screenSize.h * 0.35)), '400']);

// Finds a node (by testID or one of the labels), scrolling down up to `swipes` times.
async function findNode(match, what, swipes = 0) {
  for (let i = 0; i <= swipes; i++) {
    const n = nodes().find(match);
    if (n) return n;
    if (i < swipes) { swipeUp(); await sleep(600); }
  }
  if (crashOf() || !appPid()) await alive(`looking for ${what}`);
  return cannotRun(`${what} not found on screen`);
}
const byId = (id) => (n) => n.id === id;
const byLabel = (labels) => (n) => labels.includes(n.desc);

const devices = (() => {
  try {
    return adb(['devices']).split(/\r?\n/).slice(1).filter((line) => /\tdevice$/.test(line)).map((line) => line.split('\t')[0]);
  } catch (e) {
    return cannotRun(`adb did not run (${String(e).slice(0, 100)})`);
  }
})();
const chosen = process.env.ANDROID_SERIAL;
const emulators = devices.filter((serial) => /^emulator-\d+$/.test(serial));
if (chosen && !devices.includes(chosen)) cannotRun(`ANDROID_SERIAL=${chosen} is not a running device`);
if (!chosen && emulators.length !== 1) cannotRun(`needs exactly one running emulator, found ${emulators.length}: start one, or set ANDROID_SERIAL`);
process.env.ANDROID_SERIAL = chosen || emulators[0];
console.log(`device ${process.env.ANDROID_SERIAL}, ${skins.length} themes`);
if (!/versionCode=\d+/.test(adb(['shell', 'dumpsys', 'package', PKG]))) cannotRun('the app is not installed');

adb(['shell', 'am', 'force-stop', PKG]);
adb(['logcat', '-b', 'crash', '-c']);
adb(['shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1']);
await sleep(5000);
await alive('at start (with the theme the app had)');

const visit = async (id) => {
  tap(await findNode(byLabel(SETTINGS), 'the Settings tab'));
  await sleep(800);
  tap(await findNode(byId('settings-theme-row'), 'settings-theme-row', 8));
  await sleep(1200);
  tap(await findNode(byId(`theme-tile-${id}`), `theme-tile-${id}`, 12));
  await sleep(800);
  tap(await findNode(byId('themes-back'), 'themes-back'));
  await alive(`theme ${id}, Settings tab`);
  tap(await findNode(byLabel(WORDS), 'the Words tab'));
  await alive(`theme ${id}, Words tab`);
  console.log(`ok ${id}`);
};
for (const id of skins) await visit(id);
if (skins[skins.length - 1] !== allSkins[0]) await visit(allSkins[0]);
console.log(`THEME SMOKE PASS: ${skins.length} themes, the app stayed up after each`);
