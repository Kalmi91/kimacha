#!/usr/bin/env node
/**
 * skew-check.mjs, the version-skew gate before a web deploy.
 *
 * A tab opened before a deploy keeps running the OLD bundle, but from the deploy on it fetches the NEW lesson packs
 * (lib/games/content/webPacks.ts asks for /content/<pack>.json with no-cache). 4.2.8 broke exactly there: the old bundle
 * read `options[correct]` on a new typed item that has no options, and the lesson crashed until the tab was closed.
 *
 * This script runs that pair on purpose: it opens the site as it is deployed now (the old bundle), answers its pack
 * requests with the packs about to be deployed, goes through the onboarding for every language pair and opens every
 * grammar lesson of every level. Any page error (uncaught exception, console error, failed load) fails the check.
 *
 *   node scripts/skew-check.mjs                    the live site + packs built from this checkout
 *   node scripts/skew-check.mjs --packs dist       packs already built (dist/content/*.json)
 *   node scripts/skew-check.mjs --url <base> --pairs en-es,es-en --limit 5 --jobs 2
 *
 * Exit: 0 clean, 1 a lesson or the start broke (the deploy would break open tabs), 2 the check itself could not run.
 * Silent: speechSynthesis.speak is replaced before the app loads (project rule for browser tests).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_URL = 'https://kimacha.kichata.workers.dev';

const SPEECH_MUTE =
  "(()=>{const s=window.speechSynthesis;if(!s)return;s.speak=(u)=>setTimeout(()=>u.dispatchEvent(new Event('end')),0);})()";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const VIEWPORT = { width: 412, height: 915 };
// after this many broken lessons a pair stops: the deploy is already blocked, the rest would only cost time
const MAX_FAILS_PER_PAIR = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

class CheckError extends Error {}

// ---------------------------------------------------------------------------------------------
// Parameters and inputs

function parseArgs(argv) {
  const o = { url: (process.env.SKEW_URL || DEFAULT_URL).replace(/\/+$/, ''), packs: null, pairs: null, limit: Infinity, jobs: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) throw new CheckError(`${a}: missing value`);
      return v;
    };
    if (a === '--url') o.url = val().replace(/\/+$/, '');
    else if (a === '--packs') o.packs = path.resolve(val());
    else if (a === '--pairs') o.pairs = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limit') o.limit = Number(val());
    else if (a === '--jobs') o.jobs = Number(val());
    else throw new CheckError(`unknown option: ${a}`);
  }
  if (!(o.limit > 0)) throw new CheckError('--limit must be a positive number');
  if (!(o.jobs >= 1)) throw new CheckError('--jobs must be at least 1');
  return o;
}

// the pairs the app offers, from lib/languages.ts (source-target)
function supportedPairs() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'languages.ts'), 'utf8');
  const block = /export const supportedPairs[^=]*=\s*\[([\s\S]*?)\];/.exec(src)?.[1] ?? '';
  const pairs = [...block.matchAll(/\['(\w+)',\s*'(\w+)'\]/g)].map((m) => `${m[1]}-${m[2]}`);
  if (pairs.length === 0) throw new CheckError('no supportedPairs in lib/languages.ts');
  return pairs;
}

// the course tab's label in every UI language (lib/i18n/<lang>/common.ts, tabs.grammar): the tab button has no href and no testID
function courseTabLabels() {
  const dir = path.join(ROOT, 'lib', 'i18n');
  const labels = fs
    .readdirSync(dir)
    .map((lang) => path.join(dir, lang, 'common.ts'))
    .filter(isFile)
    .map((f) => /tabs: \{[^}]*?grammar: '([^']+)'/.exec(fs.readFileSync(f, 'utf8'))?.[1])
    .filter(Boolean);
  if (labels.length === 0) throw new CheckError('no tabs.grammar label in lib/i18n');
  return labels;
}

// pack name -> body (base64), from <dir>/content/*.json or <dir>/*.json
function loadPacks(dir) {
  const contentDir = fs.existsSync(path.join(dir, 'content')) ? path.join(dir, 'content') : dir;
  if (!fs.existsSync(contentDir)) throw new CheckError(`no pack folder: ${contentDir}`);
  const packs = new Map();
  for (const f of fs.readdirSync(contentDir)) {
    if (f.endsWith('.json')) packs.set(f.slice(0, -5), fs.readFileSync(path.join(contentDir, f)).toString('base64'));
  }
  if (packs.size === 0) throw new CheckError(`no packs in ${contentDir}`);
  return packs;
}

function buildPacks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skew-packs-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-web-content.mjs'), dir], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) throw new CheckError('build-web-content.mjs failed');
  return dir;
}

// ---------------------------------------------------------------------------------------------
// Chrome over CDP (the same launch as scripts/ui-overlap.mjs)

function findChrome() {
  const found = CHROME_CANDIDATES.find(isFile);
  if (!found) throw new CheckError('no Chrome (set CHROME_PATH)');
  return found;
}

async function launchChrome() {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skew-chrome-'));
  const proc = spawn(
    findChrome(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--remote-allow-origins=*',
      `--user-data-dir=${userDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      '--mute-audio',
      ...(process.env.CI ? ['--no-sandbox'] : []),
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const stop = () => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else proc.kill('SIGKILL');
    try {
      fs.rmSync(userDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* the temp folder may stay because of a lock */
    }
  };
  try {
    const portFile = path.join(userDir, 'DevToolsActivePort');
    let port = 0;
    for (let i = 0; i < 600 && !port; i++) {
      await sleep(100);
      try {
        // Chrome may still be writing it (EBUSY on Windows), the next round reads it again
        if (isFile(portFile)) port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || 0;
      } catch {
        /* not ready yet */
      }
    }
    if (!port) throw new CheckError('Chrome did not start (no DevToolsActivePort)');
    let wsUrl = '';
    for (let i = 0; i < 50 && !wsUrl; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? '';
      } catch {
        /* not up yet */
      }
      if (!wsUrl) await sleep(100);
    }
    if (!wsUrl) throw new CheckError('no page target in Chrome');
    return { wsUrl, stop };
  } catch (e) {
    stop();
    throw e;
  }
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  };
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new CheckError('CDP WebSocket error'));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
    return () => listeners.set(method, listeners.get(method).filter((f) => f !== fn));
  };
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return { ready, send, on, evaluate, close: () => ws.close() };
}

// ---------------------------------------------------------------------------------------------
// Code run on the page (passed as text, so it cannot use the module's variables)

async function pageSettle(quietMs, maxMs) {
  const t0 = performance.now();
  let last = performance.now();
  const mo = new MutationObserver(() => {
    last = performance.now();
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  try {
    while (performance.now() - t0 < maxMs) {
      await new Promise((r) => setTimeout(r, 50));
      if (performance.now() - last >= quietMs) break;
    }
  } finally {
    mo.disconnect();
  }
}

// the centre of the target (scrolled into view), by testID or CSS selector; null if it is not there or not visible
function pageFindTarget(spec) {
  const el = document.querySelector(spec.css ?? `[data-testid="${spec.testId}"]`);
  if (!el || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// the level buttons of the course tab (grammar-level-A1 ...)
function pageLevels() {
  return [...document.querySelectorAll('[data-testid^="grammar-level-"]')]
    .map((e) => e.getAttribute('data-testid').slice('grammar-level-'.length))
    .filter((l) => /^[A-C][12]$/.test(l));
}

// the open lessons of the shown level (a locked "soon" row is disabled)
function pageTopics() {
  return [...document.querySelectorAll('[data-testid^="grammar-topic-"]')]
    .filter((e) => e.getAttribute('aria-disabled') !== 'true')
    .map((e) => e.getAttribute('data-testid').slice('grammar-topic-'.length));
}

// ---------------------------------------------------------------------------------------------
// One Chrome, a list of pairs

const clip = (s) => String(s).replace(/\s+/g, ' ').slice(0, 300);

async function runWorker(pairs, ctx) {
  const chrome = await launchChrome();
  const cdp = connectCdp(chrome.wsUrl);
  const results = [];
  try {
    await cdp.ready;
    const errors = [];
    cdp.on('Runtime.exceptionThrown', (p) => errors.push(clip(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text)));
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') errors.push(clip(p.args.map((a) => a.value ?? a.description ?? a.type).join(' ')));
    });
    cdp.on('Log.entryAdded', (p) => {
      if (p.entry.level === 'error') errors.push(clip(`${p.entry.text}${p.entry.url ? ` (${p.entry.url})` : ''}`));
    });
    // the pack requests get the packs about to be deployed; a pack the new deploy does not have answers 404, as it would live
    cdp.on('Fetch.requestPaused', (p) => {
      const name = /\/content\/([^/?#]+)\.json(?:[?#].*)?$/.exec(p.request.url)?.[1];
      const body = name ? ctx.packs.get(decodeURIComponent(name)) : undefined;
      if (body === undefined) errors.push(`pack missing from the new deploy: ${name ?? p.request.url}`);
      const reply =
        body === undefined
          ? { requestId: p.requestId, responseCode: 404, responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }], body: '' }
          : {
              requestId: p.requestId,
              responseCode: 200,
              responseHeaders: [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Cache-Control', value: 'no-store' },
              ],
              body,
            };
      cdp.send('Fetch.fulfillRequest', reply).catch(() => {});
    });
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SPEECH_MUTE });
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/content/*.json', requestStage: 'Request' }] });

    const poll = async (expr, timeoutMs) => {
      const end = Date.now() + timeoutMs;
      for (;;) {
        const v = await cdp.evaluate(expr).catch(() => null);
        if (v) return v;
        if (Date.now() > end) return null;
        await sleep(100);
      }
    };
    const page = {
      errors,
      poll,
      settle: () => cdp.evaluate(`(${pageSettle})(300, 6000)`).catch(() => {}),
      find: (spec, timeoutMs) => poll(`(${pageFindTarget})(${JSON.stringify(spec)})`, timeoutMs),
      eval: (expr) => cdp.evaluate(expr),
      click: async (pos) => {
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
          await cdp.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
        }
      },
      // a first visit every time: no resume tab, no "returning visitor" welcome screen, no stale-reload mark
      open: async (url) => {
        await cdp.evaluate('try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}').catch(() => {});
        await cdp.send('Page.navigate', { url });
        if (!(await poll(`location.href.startsWith(${JSON.stringify(url)}) && document.readyState === 'complete' && document.body.innerText.trim().length > 0`, 60000))) {
          throw new CheckError(`${url} rendered nothing`);
        }
      },
    };
    for (const pair of pairs) results.push(await runPair(page, pair, ctx));
  } finally {
    cdp.close();
    chrome.stop();
  }
  return results;
}

// Onboarding into the pair, then the course tab. Returns false when the deployed app does not offer the pair.
async function enterCourse(page, pair, ctx) {
  const [src, tgt] = pair.split('-');
  await page.open(`${ctx.url}/`);
  const steps = [`onboarding-lang-${src}`, `onboarding-target-${tgt}`, 'onboarding-start', 'onboarding-intro-start', 'onboarding-theme-next', 'level-row-A1'];
  for (const [i, testId] of steps.entries()) {
    // the first step waits for the pack prefetch of the gate (components/cloud/CloudGate.tsx)
    const pos = await page.find({ testId }, i === 0 ? 60000 : 15000);
    if (!pos) {
      if (await page.find({ testId: 'cloud-retry' }, 0)) throw new Error('the start stopped at "could not load the lessons"');
      if (testId === `onboarding-target-${tgt}`) return false;
      throw new CheckError(`onboarding step not found: ${testId}`);
    }
    await page.click(pos);
    await page.settle();
  }
  const tab = await page.find({ css: ctx.courseTabCss }, 15000);
  if (!tab) {
    const tabs = await page.eval(`[...document.querySelectorAll('[role="tab"]')].map((e) => e.getAttribute('aria-label')).join(' | ')`).catch(() => '');
    throw new CheckError(`no course tab (tabs: ${tabs || 'none'})`);
  }
  await page.click(tab);
  if (!(await page.poll(`!!document.querySelector('[data-testid="grammar-level-buttons"]')`, 15000))) {
    throw new CheckError('the course tab did not open');
  }
  await page.settle();
  return true;
}

async function showLevel(page, level) {
  const pos = await page.find({ testId: `grammar-level-${level}` }, 10000);
  if (!pos) throw new CheckError(`no level button ${level}`);
  await page.click(pos);
  await page.settle();
}

async function runPair(page, pair, ctx) {
  const t0 = Date.now();
  const res = { pair, lessons: 0, fails: [], note: null };
  const fail = (where, errs) => res.fails.push({ where, errs: [...new Set(errs)] });
  try {
    let mark = page.errors.length;
    if (!(await enterCourse(page, pair, ctx))) {
      res.note = 'not offered by the deployed app';
      return res;
    }
    if (page.errors.length > mark) fail('start', page.errors.slice(mark));

    const queue = [];
    for (const level of await page.eval(`(${pageLevels})()`)) {
      await showLevel(page, level);
      for (const id of await page.eval(`(${pageTopics})()`)) queue.push({ level, id });
    }
    if (queue.length === 0) throw new CheckError('no open lesson on the course tab');

    let shown = null;
    for (const { level, id } of queue.slice(0, ctx.limit)) {
      if (res.fails.length >= MAX_FAILS_PER_PAIR) {
        res.note = `stopped after ${MAX_FAILS_PER_PAIR} broken lessons`;
        break;
      }
      if (shown !== level || !(await page.find({ testId: `grammar-topic-${id}` }, 0))) {
        await showLevel(page, level);
        shown = level;
      }
      const pos = await page.find({ testId: `grammar-topic-${id}` }, 10000);
      if (!pos) throw new CheckError(`lesson row not found: ${level}/${id}`);
      mark = page.errors.length;
      await page.click(pos);
      const opened = await page.poll(`location.pathname.startsWith('/grammar/')`, 10000);
      await page.settle();
      res.lessons++;
      const errs = page.errors.slice(mark);
      if (!opened) errs.push('the lesson did not open');
      const back = opened && (await page.eval('history.back(), true')) && (await page.poll(`location.pathname === '/course'`, 10000));
      if (errs.length) fail(`${level}/${id}`, errs);
      if (errs.length || !back) {
        // an error boundary replaces the whole stack: start the pair again and go on with the next lesson
        if (!(await enterCourse(page, pair, ctx))) throw new CheckError('the pair disappeared on restart');
        shown = null;
      } else {
        await page.settle();
      }
    }
  } catch (e) {
    if (e instanceof CheckError) res.checkError = e.message;
    else fail('start', [clip(e.message)]);
  } finally {
    res.seconds = Math.round((Date.now() - t0) / 1000);
  }
  return res;
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const all = supportedPairs();
  const pairs = opt.pairs ?? all;
  for (const p of pairs) if (!all.includes(p)) throw new CheckError(`unknown pair: ${p} (${all.join(', ')})`);
  const packDir = opt.packs ?? buildPacks();
  const courseTabCss = courseTabLabels().map((l) => `[role="tab"][aria-label=${JSON.stringify(l)}]`).join(', ');
  const ctx = { url: opt.url, packs: loadPacks(packDir), limit: opt.limit, courseTabCss };
  console.log(`skew-check: ${opt.url} + ${ctx.packs.size} packs from ${packDir}, ${pairs.length} pairs, ${opt.jobs} Chrome`);

  const groups = Array.from({ length: Math.min(opt.jobs, pairs.length) }, (_, i) => pairs.filter((_, j) => j % opt.jobs === i));
  // allSettled: one Chrome failing to start must not leave the others running when the process exits
  const settled = await Promise.allSettled(groups.map((g) => runWorker(g, ctx)));
  const results = settled.flatMap((s, i) =>
    s.status === 'fulfilled' ? s.value : groups[i].map((pair) => ({ pair, lessons: 0, fails: [], seconds: 0, checkError: s.reason?.message ?? String(s.reason) })),
  );
  if (!opt.packs) fs.rmSync(packDir, { recursive: true, force: true });

  let broken = 0;
  let unchecked = 0;
  for (const r of results.sort((a, b) => pairs.indexOf(a.pair) - pairs.indexOf(b.pair))) {
    const status = r.fails.length ? 'BROKEN' : r.checkError ? 'NOT CHECKED' : 'ok';
    console.log(`${r.pair}: ${status}, ${r.lessons} lessons, ${r.seconds} s${r.note ? `, ${r.note}` : ''}${r.checkError ? `, ${r.checkError}` : ''}`);
    for (const f of r.fails) for (const e of f.errs) console.log(`  ${f.where}: ${e}`);
    if (r.fails.length) broken++;
    else if (r.checkError) unchecked++;
  }
  if (broken) {
    console.log(`skew-check: ${broken} pair(s) break on an open old tab, do not deploy as is`);
    process.exit(1);
  }
  if (unchecked) {
    console.log(`skew-check: ${unchecked} pair(s) could not be checked`);
    process.exit(2);
  }
  console.log('skew-check: clean');
}

main().catch((e) => {
  console.error(`skew-check: ${e instanceof CheckError ? '' : 'unexpected error: '}${e.message}`);
  process.exit(2);
});
