// Web keyboard smoke test on a real phone browser (`npm run smoke:web-keyboard`): serves a local web export to Chrome on
// the emulator, walks onboarding with real taps, opens the typing screens, and taps every text field with
// `adb shell input tap`.
//
// Why: the phone keyboard closing right after a tap on a typing field was fixed twice (FB562, then
// react-native-web blurring the field on the scroll that opening the keyboard causes). Jest and desktop emulation cannot see
// this class of bug: only a real tap in mobile Chrome opens a real keyboard, which shrinks the layout (app/+html.tsx).
//
// Pass, for every field: the tap lands on the field, the field takes the focus, `mInputShown` turns true, both stay so for
// 2 s, and a letter typed by tapping an on-screen key reaches the field's value. When autofocus has opened the keyboard
// already and the field is out of reach of a tap, the run says so and checks the rest.
// Fail: the field lost the focus, `mInputShown` turned false or never turned true, or no key reached the field. A failure
// prints the page's focus / blur / scroll log and saves a screenshot to the OS temp folder (kimacha-web-keyboard-smoke).
//
// Exit code: 0 = pass, 1 = a field failed, 2 = the check itself could not run or could not clean up after itself.
//
// Usage: node scripts/web-keyboard-smoke.mjs [--no-build] [--dist <dir>] [--avd <name>]
//   default     builds dist/ like `cloud` npm run build:web, then runs on the kimacha_smoke AVD
//   --no-build  uses the dist/ that is already there
//   --dist      uses this export instead of dist/ (implies --no-build)
//   --avd       another phone-sized AVD, when kimacha_smoke is busy
//
// What it starts and changes, all of it undone on every exit (pass, fail, Ctrl-C, time limit):
//   - the AVD, read-only, without a window and without a network, if it is not running yet (nothing it does stays on the
//     AVD); a running one is used and left running, unless something else has a Chrome debugging forward on it (exit 2, two
//     drivers would tap over each other)
//   - the settings show_ime_with_hard_keyboard (without it the emulator's keyboard never shows) and hide_error_dialogs (an
//     "isn't responding" dialog takes the taps); Play is off during the run (an update kills Chrome)
//   - Chrome's first-run flags, only when Chrome is still on its first-run screen
//   - one Chrome tab and its site data, the adb forward and reverse, the static server; Chrome itself if it was not running
// It only ever talks to the chosen emulator by serial, so a phone on USB is never touched. The adb server stays: it is
// shared with whatever else uses adb.
//
// Never send Android's Back key here: with the keyboard already closed it leaves the page.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WINDOWS = process.platform === 'win32';
const SDK = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = path.join(SDK, 'platform-tools', WINDOWS ? 'adb.exe' : 'adb');
const EMULATOR = path.join(SDK, 'emulator', WINDOWS ? 'emulator.exe' : 'emulator');
const OUT = path.join(os.tmpdir(), 'kimacha-web-keyboard-smoke');

const CHROME = 'com.android.chrome';
const CHROME_MAIN = `${CHROME}/com.google.android.apps.chrome.Main`;
const CHROME_FLAGS_FILE = '/data/local/tmp/chrome-command-line';
const PLAY = 'com.android.vending';
const IME_SETTING = 'show_ime_with_hard_keyboard';
const ERROR_DIALOGS_SETTING = 'hide_error_dialogs';
const BLANK = '/__smoke-blank';
const KEY_ROWS_DP = [203, 260, 142]; // the keyboard's second, first and third key row, above the bottom of the screen

const HOLD_MS = 2000; // how long the field must keep the focus and the keyboard
const OPEN_MS = 15000; // a tap must open the keyboard within this (the first open of a cold keyboard takes seconds)
const QUIET_MS = 800; // no resize, scroll or focus change for this long before a field is tapped
const FIND_MS = 45000; // a screen must show its control within this (a page load parses the whole bundle)
const BOOT_MS = 5 * 60000;
const CALM_FIRST_MS = 60000; // after a boot, wait this long
const CALM_MS = 6 * 60000; // and then at most this long for the 1-minute load average to fall below CALM_LOAD
const CALM_LOAD = 5;
const BUILD_MS = 15 * 60000;
const RUN_MS = 25 * 60000; // the whole run, so a hang cannot keep the emulator alive for ever

// Project rule: browser tests run muted, set up BEFORE the page loads. The rest is the log a failure prints, and what
// the script asks the page: where a control is, and whether a tap landed on it.
const PAGE_SCRIPT = `(() => {
  const s = window.speechSynthesis;
  if (s) s.speak = (u) => setTimeout(() => u.dispatchEvent(new Event('end')), 0);
  if (window.__kbd) return;
  const t0 = performance.now();
  const k = (window.__kbd = { log: [], el: null, focusLost: 0 });
  const desc = (el) => {
    if (!el || !el.tagName) return String(el === document ? 'document' : el);
    const id = el.getAttribute('data-testid');
    return el.tagName + (id ? '#' + id : '');
  };
  const add = (kind, extra) => {
    k.movedAt = performance.now();
    k.log.push(Math.round(performance.now() - t0) + ' ' + kind + (extra ? ' ' + extra : ''));
    if (k.log.length > 120) k.log.shift();
  };
  k.quietFor = () => performance.now() - (k.movedAt || t0);
  document.addEventListener('focusin', (e) => add('focusin', desc(e.target)), true);
  document.addEventListener('focusout', (e) => {
    if (e.target === k.el) k.focusLost += 1;
    add('focusout', desc(e.target) + ' related=' + desc(e.relatedTarget));
  }, true);
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    add('scroll', t === document ? 'document' : desc(t) + ' top=' + Math.round(t.scrollTop) + ' h=' + t.clientHeight + '/' + t.scrollHeight);
  }, true);
  window.addEventListener('resize', () => add('resize', innerWidth + 'x' + innerHeight));
  document.addEventListener('pointerdown', (e) => {
    k.lastTarget = e.target;
    k.lastAt = Math.round(e.clientX) + ',' + Math.round(e.clientY);
    add('pointerdown', desc(e.target));
  }, true);
  // Did the last tap land on what find() chose? A screen that re-rendered between the two has a new element for the same
  // control, which then is the one to watch.
  k.landed = (spec) => {
    const t = k.lastTarget;
    if (!t) return null;
    if (k.el && (t === k.el || k.el.contains(t))) return 'yes';
    const same = spec.sel && t.closest(spec.sel);
    if (same) {
      k.el = same;
      return 'yes';
    }
    const r = k.el ? k.el.getBoundingClientRect() : {};
    const tr = t.getBoundingClientRect();
    return 'on ' + desc(t) + ' at ' + k.lastAt + ' (it is ' + Math.round(tr.top) + '+' + Math.round(tr.height) + ', the aimed one ' + Math.round(r.top) + '+' + Math.round(r.height) + ')';
  };
  const blur = HTMLElement.prototype.blur;
  HTMLElement.prototype.blur = function () {
    add('blur()', desc(this) + ' from ' + (new Error().stack || '').split('\\n').slice(2, 5).map((l) => l.trim().split(' ')[1] || '').join(' < '));
    return blur.apply(this, arguments);
  };
  // A point on the element that a tap really reaches: the element may be covered in part (the feedback button sits on the
  // right end of some fields), or kept in the DOM behind the current screen.
  const pointOn = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') return null;
    for (const fx of [0.5, 0.25, 0.1]) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      // A button's testID can sit on a box inside the part that takes the touch. A field takes it itself: if its parent
      // gets the touch, the field does not take touches yet (a screen coming in).
      const isField = /^(INPUT|TEXTAREA)$/.test(el.tagName);
      if (hit && (hit === el || el.contains(hit) || (!isField && hit.contains(el)))) return { x, y };
    }
    return null;
  };
  k.find = (spec) => {
    let list = spec.sel ? [...document.querySelectorAll(spec.sel)] : [];
    if (!list.length && spec.text) {
      // innerText follows the CSS upper-casing of the themes
      const same = (e) => (e.innerText || '').trim().toLowerCase() === spec.text.toLowerCase();
      list = [...document.querySelectorAll('*')].filter((e) => same(e) && ![...e.children].some(same));
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const p = pointOn(list[i]);
      if (p) {
        k.el = list[i];
        return p;
      }
    }
    return null;
  };
  k.focusedOn = (spec) => {
    const active = document.activeElement;
    if (!active || !spec.sel || !active.matches(spec.sel)) return false;
    k.el = active;
    return true;
  };
  // The next tap only measures where the page starts on the screen: the app does not see it.
  k.measureNextTap = () => {
    const types = ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click'];
    k.measured = null;
    const stop = (e) => {
      e.stopImmediatePropagation();
      if (e.cancelable) e.preventDefault();
      if (e.type === 'pointerdown') k.measured = { x: e.clientX, y: e.clientY };
    };
    types.forEach((t) => window.addEventListener(t, stop, { capture: true, passive: false }));
    k.measureDone = () => types.forEach((t) => window.removeEventListener(t, stop, { capture: true }));
    return devicePixelRatio;
  };
})();`;

const testId = (id, text) => ({ sel: `[data-testid="${id}"]`, text });
const ANY_FIELD = { sel: 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shortError = (e) => String(e?.message ?? e).split('\n')[0].slice(0, 200);

// The check itself could not run (exit 2): no device, a control that never showed up, a tap that landed elsewhere.
class CannotRun extends Error {}

// Polls until fn gives something truthy. An error counts as "not yet": a page that is just navigating cannot be asked.
async function until(fn, ms, step = 250) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // not yet
    }
    if (Date.now() >= end) return null;
    await sleep(step);
  }
}

// ---------------------------------------------------------------------------------------------
// Clean-up: every step registers its undo as soon as it has acted, and they run last-in first-out.

const cleanups = [];

function addCleanup(label, fn) {
  const entry = { label, fn };
  cleanups.push(entry);
  return () => cleanups.splice(cleanups.indexOf(entry), 1);
}

async function cleanUp() {
  let clean = true;
  while (cleanups.length) {
    const { label, fn } = cleanups.pop();
    try {
      await fn();
    } catch (e) {
      clean = false;
      console.log(`CLEAN-UP FAILED, ${label}: ${shortError(e)}`);
    }
  }
  return clean;
}

let finishing = false;
async function finish(code, message) {
  if (finishing) return;
  finishing = true;
  if (message) console.log(message);
  const clean = await cleanUp();
  process.exit(code === 0 && !clean ? 2 : code);
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (WINDOWS) {
    execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {});
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The web export and its static server

// The same two commands as `build:web` in cloud/package.json. A time limit, and the tree killed with it: with shell: true a
// plain kill would only reach the shell.
function runBuildStep(command) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(OUT, { recursive: true });
    const logFile = path.join(OUT, 'build.log');
    const log = fs.openSync(logFile, 'a');
    const child = spawn(command, { cwd: ROOT, shell: true, detached: !WINDOWS, stdio: ['ignore', log, log], env: { ...process.env, CI: '1' } });
    const undo = addCleanup(`stop ${command}`, async () => killTree(child));
    const timer = setTimeout(() => {
      killTree(child);
      reject(new CannotRun(`"${command}" did not finish in ${BUILD_MS / 60000} min, see ${logFile}`));
    }, BUILD_MS);
    child.on('error', (e) => reject(new CannotRun(`"${command}": ${shortError(e)}`)));
    child.on('exit', (code) => {
      clearTimeout(timer);
      undo();
      fs.closeSync(log);
      if (code === 0) resolve();
      else reject(new CannotRun(`"${command}" failed (exit ${code}), see ${logFile}`));
    });
  });
}

async function buildExport() {
  console.log('Building the web export (dist/)...');
  await runBuildStep('npx expo export -p web');
  await runBuildStep('node scripts/build-web-content.mjs dist');
}

const CONTENT_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Like production (cloud/wrangler.toml, single-page-application): <route>.html, then the SPA entry for a route; a missing file is 404.
function serve(dist) {
  const server = http.createServer((req, res) => {
    const route = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (route === BLANK) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><title>web keyboard smoke</title>');
      return;
    }
    if (route.startsWith('/api/')) {
      res.writeHead(503);
      res.end();
      return;
    }
    const candidates = path.extname(route) ? [route] : [route, `${route}.html`, path.join(route, 'index.html'), '/index.html'];
    for (const candidate of candidates) {
      const file = path.join(dist, candidate);
      if (file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'max-age=3600' });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      addCleanup('stop the static server', () => new Promise((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }));
      resolve(server.address().port);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// adb and the emulator

const execFileAsync = promisify(execFile);

async function adb(args, { timeout = 30000, binary = false } = {}) {
  const { stdout } = await execFileAsync(ADB, args, { timeout, maxBuffer: 64 << 20, encoding: binary ? 'buffer' : 'utf8', windowsHide: true });
  return stdout;
}

function deviceOf(serial) {
  return {
    serial,
    adb: (args, opts) => adb(['-s', serial, ...args], opts),
    shell: async (command, opts) => (await adb(['-s', serial, 'shell', command], opts)).trim(),
  };
}

async function runningEmulators() {
  return (await adb(['devices']))
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => /^emulator-\d+$/.test(serial) && state === 'device')
    .map(([serial]) => serial);
}

async function startEmulator(avd, taken) {
  let port = 5560;
  while (taken.includes(`emulator-${port}`)) port += 2;
  const serial = `emulator-${port}`;
  console.log(`Starting ${avd} on ${serial}...`);
  const child = spawn(EMULATOR, ['-avd', avd, '-read-only', '-port', String(port), '-no-snapshot-save', '-no-audio', '-no-window', '-no-boot-anim'], { stdio: ['ignore', 'pipe', 'pipe'], detached: !WINDOWS, windowsHide: true });
  let tail = '';
  const keep = (data) => {
    tail = (tail + data).slice(-600);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  let spawnError = null;
  child.on('error', (e) => {
    spawnError = e;
  });
  addCleanup(`stop the emulator ${serial}`, async () => {
    await adb(['-s', serial, 'emu', 'kill'], { timeout: 15000 }).catch(() => {});
    await until(() => child.exitCode !== null || child.signalCode !== null, 30000, 500);
    killTree(child);
  });
  const end = Date.now() + BOOT_MS;
  while (Date.now() < end) {
    if (spawnError) throw new CannotRun(`the emulator did not start: ${shortError(spawnError)}`);
    if (child.exitCode !== null) throw new CannotRun(`the emulator exited while booting: ${tail.trim().split('\n').pop()}`);
    const booted = await adb(['-s', serial, 'shell', 'getprop sys.boot_completed'], { timeout: 10000 }).catch(() => '');
    if (booted.trim() === '1') {
      // A fresh boot keeps the device so busy for minutes (load 20 on 4 cores) that Chrome stops answering. Without a network
      // the background jobs end sooner; this read-only instance is thrown away at the end, so there is nothing to restore.
      // The load average starts low after a snapshot, so it only counts after a first wait.
      const device = deviceOf(serial);
      console.log('Waiting for the fresh boot to calm down...');
      await device.shell('svc wifi disable; svc data disable');
      await sleep(CALM_FIRST_MS);
      const calm = await until(async () => Number((await device.shell('cat /proc/loadavg')).split(' ')[0]) < CALM_LOAD, CALM_MS, 3000);
      if (!calm) console.log(`The emulator's load stayed above ${CALM_LOAD} for ${CALM_MS / 60000} min, going on anyway.`);
      return { device, started: true };
    }
    await sleep(3000);
  }
  throw new CannotRun(`${avd} did not boot in ${BOOT_MS / 60000} min`);
}

// The chosen AVD by name. A phone on USB has a serial of its own and never matches.
async function acquireEmulator(avd) {
  const serials = await runningEmulators();
  for (const serial of serials) {
    const name = await adb(['-s', serial, 'emu', 'avd', 'name'], { timeout: 10000 }).catch(() => '');
    if (name.split(/\r?\n/)[0].trim() !== avd) continue;
    const forwards = await adb(['forward', '--list']);
    const busy = forwards.split(/\r?\n/).find((line) => line.startsWith(`${serial} `) && line.includes('chrome_devtools_remote'));
    if (busy) {
      const local = busy.split(/\s+/)[1];
      throw new CannotRun(`${avd} (${serial}) has a Chrome debugging forward (${local}): something else is driving it. Wait for it, use --avd, or if it is stale: adb -s ${serial} forward --remove ${local}`);
    }
    return { device: deviceOf(serial), started: false };
  }
  return startEmulator(avd, serials);
}

// ---------------------------------------------------------------------------------------------
// Chrome

const getJson = async (url) => (await fetch(url, { signal: AbortSignal.timeout(5000) })).json();

// Chrome on a fresh AVD opens with its first-run screen, and no page target exists behind it.
async function skipChromeFirstRun(device) {
  const debugApp = await device.shell('settings get global debug_app');
  const flagsBefore = await device.shell(`cat ${CHROME_FLAGS_FILE}`).catch(() => null);
  addCleanup('restore the Chrome flags', async () => {
    await device.shell(`am force-stop ${CHROME}`);
    await device.shell(debugApp === 'null' ? 'am clear-debug-app' : `am set-debug-app --persistent ${debugApp}`);
    await device.shell(flagsBefore === null ? `rm -f ${CHROME_FLAGS_FILE}` : `echo '${flagsBefore}' > ${CHROME_FLAGS_FILE}`);
  });
  await device.shell(`am force-stop ${CHROME}; am set-debug-app --persistent ${CHROME}; echo '_ --disable-fre --no-default-browser-check --no-first-run' > ${CHROME_FLAGS_FILE}`);
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let lastId = 0;
    const waiting = new Map();
    const failAll = (reason) => {
      for (const { reject: rejectOne } of waiting.values()) rejectOne(new Error(reason));
      waiting.clear();
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const entry = data.id && waiting.get(data.id);
      if (!entry) return;
      waiting.delete(data.id);
      clearTimeout(entry.timer);
      if (data.error) entry.reject(new Error(data.error.message));
      else entry.resolve(data.result);
    };
    ws.onerror = () => reject(new Error('the CDP WebSocket failed'));
    ws.onclose = () => failAll('the CDP WebSocket closed');
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((resolveOne, rejectOne) => {
            const id = ++lastId;
            const timer = setTimeout(() => {
              waiting.delete(id);
              rejectOne(new Error(`CDP ${method} timed out`));
            }, 20000);
            waiting.set(id, { resolve: resolveOne, reject: rejectOne, timer });
            ws.send(JSON.stringify({ id, method, params }));
          }),
        close: () => ws.close(),
      });
  });
}

// Opens the blank page, not the app, and attaches: the page script has to be in place before the app loads.
async function openTab(device, devtoolsPort, base) {
  const ourTab = async () => (await getJson(`http://127.0.0.1:${devtoolsPort}/json`)).find((t) => t.type === 'page' && t.url.startsWith(base));
  const launch = () => device.shell(`am start -n ${CHROME_MAIN} -a android.intent.action.VIEW -d ${base}${BLANK}`);
  await launch();
  let tab = await until(ourTab, 15000, 500);
  if (!tab) {
    await skipChromeFirstRun(device);
    await launch();
    tab = await until(ourTab, 45000, 500);
  }
  if (!tab) {
    const top = await device.shell('dumpsys activity activities | grep -m1 topResumedActivity').catch(() => '?');
    throw new CannotRun(`Chrome did not open the page. Top activity: ${top.slice(0, 120)}`);
  }
  addCleanup('close the Chrome tab', async () => {
    await fetch(`http://127.0.0.1:${devtoolsPort}/json/close/${tab.id}`, { signal: AbortSignal.timeout(5000) });
  });
  const cdp = await connectCdp(tab.webSocketDebuggerUrl);
  addCleanup('close the CDP connection', async () => cdp.close());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const clearSiteData = () => cdp.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'all' });
  await clearSiteData();
  addCleanup('clear the site data', clearSiteData);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_SCRIPT });
  return cdp;
}

// ---------------------------------------------------------------------------------------------
// One run: real taps, what the page and the input method say about them

class Session {
  constructor(device, cdp, base) {
    this.device = device;
    this.cdp = cdp;
    this.base = base;
    this.results = [];
    this.offset = null;
    this.size = null;
  }

  async readScreenSize() {
    const size = [...(await this.device.shell('wm size')).matchAll(/(\d+)x(\d+)/g)].pop();
    const density = [...(await this.device.shell('wm density')).matchAll(/density: (\d+)/g)].pop();
    this.size = { width: Number(size[1]), height: Number(size[2]), density: Number(density[1]) };
  }

  async ev(expression) {
    const r = await this.cdp.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  // Where the page starts on the screen (status bar + Chrome's toolbar): measured with one tap the app does not see.
  async measure() {
    const dpr = await this.ev('window.__kbd.measureNextTap()');
    const x = Math.round(this.size.width / 2);
    const y = Math.round(this.size.height / 2);
    await this.device.shell(`input tap ${x} ${y}`);
    const at = await until(() => this.ev('window.__kbd.measured'), 4000);
    await sleep(400); // the rest of the tap's events
    await this.ev('window.__kbd.measureDone()');
    if (!at) throw new CannotRun('a tap on the middle of the screen did not reach the page (something of Chrome or Android is on top?)');
    this.offset = { dpr, x: x - at.x * dpr, y: y - at.y * dpr };
  }

  // The point of a control that has stopped moving: a tap on a screen still sliding in would land elsewhere.
  async find(spec, ms = FIND_MS) {
    let previous = null;
    return until(async () => {
      const point = await this.ev(`window.__kbd.find(${JSON.stringify(spec)})`);
      const still = point && previous && Math.abs(point.x - previous.x) < 1 && Math.abs(point.y - previous.y) < 1;
      previous = point;
      return still ? point : null;
    }, ms, 300);
  }

  // A tap at a point of the page; it must land on the element find() chose, or nothing after it proves anything.
  async tapPoint(spec, point, what) {
    const { dpr, x, y } = this.offset;
    await this.ev('window.__kbd.lastTarget = null');
    await this.device.shell(`input tap ${Math.round(point.x * dpr + x)} ${Math.round(point.y * dpr + y)}`);
    const landed = await until(() => this.ev(`window.__kbd.landed(${JSON.stringify(spec)})`), 4000);
    if (!landed) throw new CannotRun(`the tap on ${what} did not reach the page`);
    if (landed !== 'yes') throw new CannotRun(`the tap on ${what} at y=${Math.round(point.y)} landed ${landed}`);
  }

  async tap(spec, what) {
    const point = await this.find(spec);
    if (!point) throw new CannotRun(`${what} did not show up in ${FIND_MS / 1000} s`);
    await this.tapPoint(spec, point, what);
  }

  // Page load. A returning visitor without a sign-in lands on the welcome screen first (components/cloud/CloudGate.tsx).
  async open(route, expected) {
    const welcome = testId('cloud-welcome');
    await this.cdp.send('Page.navigate', { url: this.base + route });
    const arrived = await until(
      () => this.ev(`window.__kbd.find(${JSON.stringify(welcome)}) ? 'welcome' : window.__kbd.find(${JSON.stringify(expected)}) ? 'there' : null`),
      FIND_MS,
    );
    if (!arrived) throw new CannotRun(`${route} did not show up in ${FIND_MS / 1000} s`);
    await this.measure();
    if (arrived === 'welcome' && expected.sel !== welcome.sel) await this.tap(testId('cloud-welcome-third'), 'Skip on the welcome screen');
  }

  async imeShown() {
    return /mInputShown=true/.test(await this.device.shell('dumpsys input_method | grep -m1 mInputShown'));
  }

  // The keyboard really on the screen, not only asked for. The first open of a cold keyboard takes seconds, and until its
  // window has its height the layout has not shrunk, so what follows from that (the bug: a scroll, then a blur) is still to come.
  async keyboardOnScreen() {
    const dump = await this.device.shell('dumpsys window InputMethod');
    const region = /touchable region=SkRegion\(\(\d+,(\d+),\d+,(\d+)\)/.exec(dump);
    return /isOnScreen=true/.test(dump) && !!region && Number(region[2]) - Number(region[1]) > this.size.height * 0.2;
  }

  async keepsKeyboard() {
    const focused = await this.ev('document.activeElement === window.__kbd.el');
    return { focused, shown: await this.imeShown() };
  }

  // Taps the middle key of a keyboard row and looks for its character in the field: a letter on the QWERTY layouts, a digit on
  // the number pad. The rows are counted from the bottom of the screen, because the strips above them come and go per field.
  async typeOneKey() {
    const { width, height, density } = this.size;
    let value = await this.ev('window.__kbd.el.value');
    for (const dp of KEY_ROWS_DP) {
      if (!(await this.imeShown())) return null; // with the keyboard gone this tap would press the app's own buttons
      const before = value;
      await this.device.shell(`input tap ${Math.round(width / 2)} ${Math.round(height - (dp * density) / 160)}`);
      const changed = await until(async () => {
        const now = await this.ev('window.__kbd.el.value');
        return now !== before ? { now } : null;
      }, 1500);
      if (!changed) continue;
      value = changed.now;
      const added = value.slice(before.length);
      if (/^[\p{L}\p{N}]$/u.test(added)) return added;
    }
    return null;
  }

  // On a busy emulator the layout can still move between finding a field and the tap reaching it. That says nothing about the
  // keyboard, so such a tap is simply made again.
  async tapFieldAt(spec, firstPoint, what) {
    let point = firstPoint;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.tapPoint(spec, point, what);
        return;
      } catch (e) {
        if (attempt >= 3 || !(e instanceof CannotRun)) throw e;
      }
      await sleep(1500);
      point = (await this.find(spec)) ?? point;
    }
  }

  // The check of one field. Returns the reason it failed, or null.
  async fieldProblem(spec, what) {
    // The keyboard must be at rest first, or the layout moves under the tap: still closing from the last screen, or opening by
    // itself for a field that autofocused right after a tap. From one field to the next it just stays open.
    await sleep(1000);
    await until(async () => {
      if (await this.imeShown()) {
        const onField = await this.ev('!!document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)');
        if (!onField || !(await this.keyboardOnScreen())) return false;
      }
      return (await this.ev('window.__kbd.quietFor()')) > QUIET_MS;
    }, OPEN_MS);
    await this.ev('window.__kbd.log.length = 0; window.__kbd.focusLost = 0');
    // An autofocused field can have the keyboard already: focus right after a tap on the last screen opens it. The smaller
    // layout may then have clipped the field out of reach of a tap, and everything after the tap still holds for it.
    const alreadyOpen = (await this.imeShown()) && (await this.keyboardOnScreen()) && (await this.ev(`window.__kbd.focusedOn(${JSON.stringify(spec)})`));
    const point = await this.find(spec, alreadyOpen ? 2000 : FIND_MS);
    if (point) await this.tapFieldAt(spec, point, what);
    else if (alreadyOpen) this.note = ' (autofocus opened the keyboard, the field was out of reach of a tap)';
    else throw new CannotRun(`${what} did not show up in ${FIND_MS / 1000} s`);

    const opened = await until(async () => {
      const { focused, shown } = await this.keepsKeyboard();
      return focused && shown && (await this.keyboardOnScreen());
    }, OPEN_MS, 150);
    if (!opened) {
      const { focused, shown } = await this.keepsKeyboard();
      const lost = await this.ev('window.__kbd.focusLost');
      return `the keyboard did not stay open within ${OPEN_MS / 1000} s of the tap (focused=${focused}, mInputShown=${shown}, the field lost the focus ${lost} times)`;
    }
    const openedAt = Date.now();
    while (Date.now() - openedAt < HOLD_MS) {
      const { focused, shown } = await this.keepsKeyboard();
      const ms = Date.now() - openedAt;
      if (!focused) return `the field lost the focus ${ms} ms after the keyboard opened`;
      if (!shown) return `mInputShown turned false ${ms} ms after the keyboard opened`;
      await sleep(100);
    }
    if (await this.ev('window.__kbd.focusLost')) return 'the field lost the focus and got it back while the keyboard was open';

    const key = await this.typeOneKey();
    const { focused, shown } = await this.keepsKeyboard();
    if (!focused || !shown) return `the keyboard closed after the first ${HOLD_MS / 1000} s, before or while typing (focused=${focused}, mInputShown=${shown})`;
    if (!key) return 'no on-screen key reached the field';
    return null;
  }

  async screenshot(what) {
    const file = path.join(OUT, `${what.replace(/\W+/g, '-')}.png`);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(file, await this.device.adb(['exec-out', 'screencap', '-p'], { binary: true }));
    return file;
  }

  async checkField(spec, what) {
    this.note = '';
    const problem = await this.fieldProblem(spec, what);
    if (!problem) {
      this.results.push({ what, ok: true });
      console.log(`  ok    ${what}${this.note}`);
      return;
    }
    this.results.push({ what, ok: false });
    console.log(`  FAIL  ${what}: ${problem}`);
    const log = await this.ev('window.__kbd.log');
    console.log(log.map((line) => `          ${line}`).join('\n'));
    console.log(`        screenshot: ${await this.screenshot(what)}`);
  }

  // One screen: a failed field is a result and the next field still runs; a screen that cannot be reached is an error, and the next screen still runs.
  async screen(what, steps) {
    try {
      await steps();
    } catch (e) {
      // Chrome itself is gone or stuck: no later screen can run, and each would only wait out its time limit.
      if (/^CDP |CDP WebSocket closed/.test(String(e?.message))) throw new CannotRun(`Chrome stopped answering during "${what}": ${shortError(e)}`);
      this.results.push({ what, error: true });
      const page = await this.ev("location.pathname + ': ' + document.body.innerText.replace(/\\s+/g, ' ').slice(0, 160)").catch(() => '?');
      console.log(`  ERROR ${what}: ${shortError(e)}\n        on ${page}\n        screenshot: ${await this.screenshot(what)}`);
    }
  }
}

async function walkScreens(s) {
  await s.screen('onboarding', async () => {
    await s.open('/', testId('onboarding-lang-en', 'English'));
    await s.tap(testId('onboarding-lang-en', 'English'), 'the language button');
    await s.tap(testId('onboarding-target-es', 'Español'), 'the target button');
    await s.tap(testId('onboarding-start', 'Get started'), 'Get started');
    await s.tap(testId('onboarding-intro-start'), 'the intro button');
    await s.tap(testId('onboarding-theme-next'), 'the theme button');
    await s.tap(testId('level-row-A1'), 'the A1 level');
    console.log('  ok    onboarding');
  });
  await s.screen('Learn card', async () => {
    await s.checkField(ANY_FIELD, 'Learn card');
  });
  await s.screen('feedback form', async () => {
    await s.tap(testId('feedback-fab', '💬'), 'the feedback button');
    await s.checkField({ sel: 'textarea' }, 'feedback form');
    await s.tap({ text: 'Cancel' }, 'Cancel');
  });
  await s.screen('tense drill', async () => {
    // A guest's progress does not survive a page load, so a screen opened by URL has to say that onboarding is done (lib/webTestHooks.ts).
    await s.open('/grammar/tense-drill?onboarded=1', testId('tensedrill-begin'));
    await s.tap(testId('tensedrill-begin'), 'the begin button');
    await s.checkField(testId('tensedrill-input'), 'tense drill');
  });
  await s.screen('grammar table deck', async () => {
    await s.open('/grammar/deck/ser-estar?onboarded=1', testId('tabledeck-input'));
    await s.checkField(testId('tabledeck-input'), 'grammar table deck');
  });
  await s.screen('sign-in', async () => {
    await s.open('/', testId('cloud-welcome'));
    await s.tap(testId('cloud-welcome-signin'), 'Sign in on the welcome screen');
    await s.checkField(testId('cloud-login-name'), 'sign-in name');
    await s.checkField(testId('cloud-login-pin'), 'sign-in PIN');
  });
}

function parseArgs(argv) {
  const options = { avd: 'kimacha_smoke', dist: path.join(ROOT, 'dist'), build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-build') options.build = false;
    else if (a === '--avd') options.avd = argv[++i];
    else if (a === '--dist') {
      options.dist = path.resolve(argv[++i]);
      options.build = false;
    } else throw new CannotRun(`unknown option ${a}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (typeof WebSocket === 'undefined') throw new CannotRun("Node 22 or newer is needed (Node's global WebSocket)");
  if (!fs.existsSync(ADB)) throw new CannotRun(`no adb at ${ADB}`);
  fs.rmSync(OUT, { recursive: true, force: true });

  if (options.build) await buildExport();
  if (!fs.existsSync(path.join(options.dist, 'index.html'))) throw new CannotRun(`no web export in ${options.dist}`);

  const appPort = await serve(options.dist);
  const base = `http://localhost:${appPort}`;
  const { device, started } = await acquireEmulator(options.avd);

  const imeSetting = await device.shell(`settings get secure ${IME_SETTING}`);
  if (imeSetting !== '1') {
    addCleanup(`restore ${IME_SETTING}`, () => device.shell(imeSetting === 'null' ? `settings delete secure ${IME_SETTING}` : `settings put secure ${IME_SETTING} ${imeSetting}`));
    await device.shell(`settings put secure ${IME_SETTING} 1`);
  }
  // A fresh boot of these images can show "System UI isn't responding" over everything, and that dialog takes the taps.
  const errorDialogs = await device.shell(`settings get global ${ERROR_DIALOGS_SETTING}`);
  if (errorDialogs !== '1') {
    addCleanup(`restore ${ERROR_DIALOGS_SETTING}`, () => device.shell(errorDialogs === 'null' ? `settings delete global ${ERROR_DIALOGS_SETTING}` : `settings put global ${ERROR_DIALOGS_SETTING} ${errorDialogs}`));
    await device.shell(`settings put global ${ERROR_DIALOGS_SETTING} 1`);
  }
  // Play updates apps in the background on these images, and an update kills Chrome in the middle of a run.
  const playDisabled = (await device.shell(`pm list packages -d ${PLAY}`).catch(() => '')).includes(PLAY);
  if (!playDisabled) {
    addCleanup('turn Play back on', () => device.shell(`pm enable ${PLAY}`));
    await device.shell(`pm disable-user --user 0 ${PLAY}`);
  }
  const chromeRunning = await device.shell(`pidof ${CHROME}`).catch(() => '');
  if (!chromeRunning) addCleanup('stop Chrome', () => device.shell(`am force-stop ${CHROME}`));

  const devtoolsPort = (await device.adb(['forward', 'tcp:0', 'localabstract:chrome_devtools_remote'])).trim();
  // A port that is gone already (an adb server restart drops them) needs no removing.
  const unlessGone = (e) => {
    if (!/not found/.test(String(e.stderr ?? e.message))) throw e;
  };
  addCleanup('remove the Chrome debugging forward', () => device.adb(['forward', '--remove', `tcp:${devtoolsPort}`]).catch(unlessGone));
  await device.adb(['reverse', `tcp:${appPort}`, `tcp:${appPort}`]);
  addCleanup('remove the reverse port', () => device.adb(['reverse', '--remove', `tcp:${appPort}`]).catch(unlessGone));

  const cdp = await openTab(device, devtoolsPort, base);
  const version = await getJson(`http://127.0.0.1:${devtoolsPort}/json/version`);
  console.log(`${options.avd} (${device.serial}, ${started ? 'started here, stopped at the end' : 'already running, stays running'}), ${version.Browser}, export ${options.dist}`);

  const session = new Session(device, cdp, base);
  await session.readScreenSize();
  await walkScreens(session);

  const failed = session.results.filter((r) => r.ok === false);
  const errors = session.results.filter((r) => r.error);
  const passed = session.results.filter((r) => r.ok).length;
  console.log(`${failed.length ? 'FAIL' : errors.length ? 'COULD NOT FINISH' : 'PASS'}: ${passed} of ${passed + failed.length + errors.length} typing fields kept the keyboard`);
  return failed.length ? 1 : errors.length ? 2 : 0;
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => void finish(2, `Stopped by ${signal}.`));
}
setTimeout(() => void finish(2, `SMOKE CANNOT RUN: the time limit of ${RUN_MS / 60000} min ran out.`), RUN_MS).unref();

main().then(
  (code) => finish(code),
  (e) => finish(2, e instanceof CannotRun ? `SMOKE CANNOT RUN: ${e.message}` : `SMOKE CANNOT RUN: ${e.stack ?? e}`),
);
