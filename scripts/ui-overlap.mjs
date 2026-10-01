// Automata UI-átfedés teszt a web-buildre, témánként (PLAN-temak, F agent).
//
// Menete: `npx expo export -p web` (dist) -> saját statikus szerver SPA-fallbackkel ->
// headless Chrome remote-debugging-gal -> CDP (WebSocket) vezérlés. Kombináció =
// téma × módja × útvonal × nézet; a lapot a lib/webTestHooks.ts URL-paraméterei állítják
// be (skin, mode, mix, onboarded). Minden kombináción a lapon fut a vizsgálat:
//   clip     levágott szöveg: a szöveges levél-elem overflow hidden/clip mellett kisebb a
//            clientWidth/Height-nál mint a scrollWidth/Height (+1), vagy egy overflow
//            hidden/clip ős részben levágja a szöveget
//   overlap  két látható szöveges vagy kattintható elem (nem ős-leszármazott, nem decor-)
//            téglalapja 4 px²-nél jobban metszi egymást. Szövegnél a sor-téglalapok
//            (Range) a számítottak, a line-height-ra szűkítve; a hivatkozott
//            (kattintható) elemben lévő szöveg az okozó elemre vezet vissza (egy hiba = egy sor)
//   overflow kilógás: szöveg vagy gomb jobb széle > a nézet szélessége
//   load     a kombináció nem töltött be / a lépés nem találta a gombot
// A díszeket rajzoló elemek (data-testid="decor-...") és leszármazottaik kimaradnak; ugyanígy
// az átmeneti, szándékosan a tartalom fölé rajzolt UsageToast (data-testid="usage-toast").
//
// Kimenet: ui-overlap-report.json + PNG a hibás kombinációkról az ui-shots/ mappába
// (--shots: minden kombinációról). Kilépési kód: 0 = nincs hiba, 1 = van hiba, 2 = a teszt
// maga hibázott.
//
// Használat: node scripts/ui-overlap.mjs [--skins a,b|mix] [--routes r1,r2]
//            [--viewports 360x740,412x915] [--shots] [--no-build]
// (npm run ui:overlap -- --skins brutal,deco)

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'ui-shots');
const REPORT = path.join(ROOT, 'ui-overlap-report.json');

// Kálmán szabálya (CLAUDE.md, 2026-09-28): böngészős teszt némán, betöltés ELŐTT.
const SPEECH_MUTE =
  "(()=>{const s=window.speechSynthesis;if(!s)return;s.speak=(u)=>setTimeout(()=>u.dispatchEvent(new Event('end')),0);})()";

// A Saját mix minta: széles betű (Rubik Mono One), íves forma, másik téma színei és dísze.
const SAMPLE_MIX = { colors: 'ukiyoe', font: 'memphis', shape: 'szecesszio', decor: 'deco' };

const VIEWPORTS = ['360x740', '412x915'];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

// Útvonalak. `file`: az útvonalat adó képernyő-fájl; ha nincs a projektben, az útvonal kimarad.
// `steps`: onboarding nélküli (onboarded=0) útvonalon végigkattintott gombok.
const LANG = { testId: 'onboarding-lang-en', text: 'English' };
const START = { testId: 'onboarding-start', text: 'Get Started' };
const INTRO_START = { testId: 'onboarding-intro-start' };
const ROUTES = {
  learn: { path: '/', onboarded: true },
  course: { path: '/course', onboarded: true },
  stats: { path: '/stats', onboarded: true },
  settings: { path: '/settings', onboarded: true },
  themes: { path: '/themes', onboarded: true, file: 'app/themes.tsx' },
  'theme-mix': { path: '/theme-mix', onboarded: true, file: 'app/theme-mix.tsx' },
  'onboarding-intro': { path: '/', onboarded: false, steps: [LANG, START], ready: 'onboarding-intro' },
  'onboarding-theme': { path: '/', onboarded: false, steps: [LANG, START, INTRO_START], ready: 'onboarding-theme' },
};

// ---------------------------------------------------------------------------------------------
// Paraméterek

function parseArgs(argv) {
  const o = { skins: null, routes: null, viewports: null, shots: false, build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const list = () => (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (a === '--skins') o.skins = list();
    else if (a === '--routes') o.routes = list();
    else if (a === '--viewports') o.viewports = list();
    else if (a === '--shots') o.shots = true;
    else if (a === '--no-build') o.build = false;
    else {
      console.error(`Ismeretlen kapcsoló: ${a}`);
      process.exit(2);
    }
  }
  return o;
}

// A témák és módjaik a constants/Skins.ts-ből (TS -> CJS a memóriában, nincs külön build).
function loadSkinsModule() {
  const cache = {};
  const load = (name) => {
    if (cache[name]) return cache[name].exports;
    const src = fs.readFileSync(path.join(ROOT, 'constants', `${name}.ts`), 'utf8');
    const js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const mod = { exports: {} };
    cache[name] = mod;
    new Function('exports', 'require', 'module', js)(mod.exports, (p) => load(p.replace('./', '')), mod);
    return mod.exports;
  };
  return load('Skins');
}

// ---------------------------------------------------------------------------------------------
// Statikus szerver (SPA-fallback)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = '/';
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      /* marad a gyökér */
    }
    const p = path.normalize(path.join(DIST, urlPath));
    let file = null;
    if (p.startsWith(DIST)) {
      file = [p, `${p}.html`, path.join(p, 'index.html')].find(isFile) ?? null;
    }
    // Kiterjesztéses, hiányzó fájl (asset): 404; minden más útvonal: az SPA belépő.
    if (!file && path.extname(urlPath) && path.extname(urlPath) !== '.html') {
      res.writeHead(404).end();
      return;
    }
    file ??= path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------------------------------------
// Chrome + CDP

function findChrome() {
  const found = CHROME_CANDIDATES.find(isFile);
  if (!found) throw new Error('Nincs Chrome (CHROME_PATH környezeti változóval megadható).');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome() {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-overlap-chrome-'));
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
      '--hide-scrollbars',
      '--mute-audio',
      '--force-device-scale-factor=1',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  // A port a DevToolsActivePort fájl első sorából jön.
  const portFile = path.join(userDir, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    if (isFile(portFile)) port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  }
  if (!port) throw new Error('A Chrome nem indult el (nincs DevToolsActivePort).');
  let wsUrl = '';
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? '';
    } catch {
      /* még nem áll fel */
    }
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) throw new Error('Nincs oldal-target a Chrome-ban.');
  const stop = () => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else proc.kill('SIGKILL');
    try {
      fs.rmSync(userDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* a lock miatt maradhat, a temp mappa */
    }
  };
  return { wsUrl, stop };
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const w of waiters.filter((x) => x.method === msg.method)) w.resolve(msg.params);
    }
  };
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('CDP WebSocket hiba'));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  // Esemény-várás: a hívó a kiváltó parancs ELŐTT hívja, a visszaadott promise a parancs után várható.
  const waitEvent = (method, timeoutMs) => {
    let w;
    const p = new Promise((resolve, reject) => {
      w = { method, resolve };
      waiters.push(w);
      setTimeout(() => reject(new Error(`Időtúllépés: ${method}`)), timeoutMs);
    }).finally(() => waiters.splice(waiters.indexOf(w), 1));
    p.catch(() => {});
    return p;
  };
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return { ready, send, waitEvent, evaluate, close: () => ws.close() };
}

// ---------------------------------------------------------------------------------------------
// A lapon futó kód (a függvények szövege megy át; nem hivatkozhatnak a modul változóira)

// Megvárja a betűtípusokat és a render-csendet (a DOM-ban nincs szerkezeti / class-változás).
async function pageSettle(quietMs, maxMs) {
  const t0 = performance.now();
  let last = performance.now();
  const mo = new MutationObserver(() => {
    last = performance.now();
  });
  mo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  try {
    while (performance.now() - t0 < maxMs) {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 60));
      if (document.fonts.status === 'loaded' && performance.now() - last >= quietMs) break;
    }
  } finally {
    mo.disconnect();
  }
}

// A célelem közepének koordinátája (görgetve), testID vagy a saját szöveg alapján; null, ha nincs.
function pageFindTarget(spec) {
  let el = spec.testId ? document.querySelector(`[data-testid="${spec.testId}"]`) : null;
  if (!el && spec.text) {
    el = [...document.querySelectorAll('div, span, button, a')].find(
      (e) =>
        [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim() === spec.text) &&
        e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    );
  }
  if (!el || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// A vizsgálat: { issues: [{ type, text, other? }], stats }.
function pageAnalyze() {
  const vw = document.documentElement.clientWidth;
  const issues = [];
  const trunc = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 40);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'META', 'LINK', 'HEAD']);
  const visible = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  // díszek + a szándékosan a tartalom fölé rajzolt lebegő elemek (UsageToast, 💬 gomb)
  const IGNORE = '[data-testid^="decor-"], [data-testid^="usage-toast"], [data-testid="feedback-fab"]';
  const inDecor = (el) => !!el.closest(IGNORE) || (el.innerText ?? '').trim() === '💬';
  const desc = (el) => {
    const r = el.getBoundingClientRect();
    const id = el.getAttribute('data-testid') ?? el.closest('[data-testid]')?.getAttribute('data-testid');
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}@${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}`;
  };
  const clips = (v) => v === 'hidden' || v === 'clip';
  const scrolls = (v) => v === 'auto' || v === 'scroll';

  // A levágó (overflow nem visible) ősök a body alatt; hard = hidden / clip (a görgetős nem).
  // A téglalap a padding-box (a szegély és a görgetősáv nélkül).
  const clippingAncestors = (el, includeSelf) => {
    const out = [];
    for (let a = includeSelf ? el : el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const x = cs.overflowX !== 'visible';
      const y = cs.overflowY !== 'visible';
      if (!(x || y) || a.clientWidth <= 0 || a.clientHeight <= 0) continue;
      const r = a.getBoundingClientRect();
      const l = r.left + a.clientLeft;
      const t = r.top + a.clientTop;
      out.push({ el: a, hard: clips(cs.overflowX) || clips(cs.overflowY), hx: clips(cs.overflowX), hy: clips(cs.overflowY), sx: scrolls(cs.overflowX), sy: scrolls(cs.overflowY), x, y, l, t, r: l + a.clientWidth, b: t + a.clientHeight });
    }
    return out;
  };
  // A téglalapok a vágó ősök dobozaira vágva; ami teljesen kívülre esik, kiesik.
  const clipRects = (rects, list) => {
    const out = [];
    for (const r of rects) {
      let c = r;
      for (const a of list) {
        if (a.x) c = { ...c, l: Math.max(c.l, a.l), r: Math.min(c.r, a.r) };
        if (a.y) c = { ...c, t: Math.max(c.t, a.t), b: Math.min(c.b, a.b) };
      }
      if (c.r - c.l > 0.5 && c.b - c.t > 0.5) out.push(c);
    }
    return out;
  };

  // --- szöveges elemek: sor-téglalapok (Range), a line-height-ra szűkítve
  const byEl = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || SKIP.has(el.tagName)) continue;
    if (!byEl.has(el)) byEl.set(el, []);
    byEl.get(el).push(n);
  }
  const range = document.createRange();
  const items = [];
  for (const [el, nodes] of byEl) {
    if (!visible(el) || inDecor(el)) continue;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    const raw = [];
    for (const n of nodes) {
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 0.5 || r.height < 0.5) continue;
        let top = r.top;
        let h = r.height;
        if (lh > 0 && lh < h) {
          top += (h - lh) / 2;
          h = lh;
        }
        raw.push({ l: r.left, t: top, r: r.right, b: top + h });
      }
    }
    if (!raw.length) continue;
    // a saját doboza is vág (numberOfLines: overflow hidden), a rejtett sorok nem számítanak
    const cl = clippingAncestors(el, true);
    items.push({ kind: 'text', el, label: trunc(nodes.map((n) => n.nodeValue).join(' ')), raw, cl, cs });
  }

  // --- kattintható elemek: a határoló téglalap
  const CLICK_SEL =
    'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="tab"], ' +
    '[role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [tabindex="0"]';
  for (const el of document.body.querySelectorAll('*')) {
    if (SKIP.has(el.tagName) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === 'none') continue;
    let isClick = el.matches(CLICK_SEL);
    if (!isClick && cs.cursor === 'pointer') {
      const p = el.parentElement;
      isClick = !p || getComputedStyle(p).cursor !== 'pointer';
    }
    if (!isClick || inDecor(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const label =
      (el.innerText ?? '').trim() || el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.tagName;
    const rect = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    items.push({ kind: 'click', el, label: trunc(label), raw: [rect], cl: clippingAncestors(el, false), cs });
  }
  const clickEls = new Map(items.map((it, i) => [it.el, i]).filter(([, i]) => items[i].kind === 'click'));
  // A szöveg legközelebbi kattintható őse (az okozó elemre vezetéshez).
  for (const it of items) {
    it.lift = -1;
    if (it.kind !== 'text') continue;
    for (let a = it.el; a && a !== document.body; a = a.parentElement) {
      if (clickEls.has(a)) {
        it.lift = clickEls.get(a);
        break;
      }
    }
  }

  // (a) levágott szöveg
  for (const it of items) {
    if (it.kind !== 'text') continue;
    const el = it.el;
    const cs = it.cs;
    const own =
      (clips(cs.overflowX) || clips(cs.overflowY)) &&
      (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    let cut = own;
    if (!cut) {
      // ős vágja részben (egészben kívül eső: pager / rejtett oldal, nem hiba); tengelyenként csak
      // a hidden / clip számít, és csak ha nincs köztük görgetős (auto / scroll) ős, ami a vágó ős
      // élén belül van: a görgetés szélén félbevágott sor görgetéssel látható, nem levágott
      const scrolled = (i, axis) =>
        it.cl.slice(0, i).some((s) =>
          axis === 'x'
            ? s.sx && s.l >= it.cl[i].l - 1 && s.r <= it.cl[i].r + 1
            : s.sy && s.t >= it.cl[i].t - 1 && s.b <= it.cl[i].b + 1,
        );
      cut = it.cl.some(
        (a, i) =>
          a.hard &&
          a.el !== el &&
          it.raw.some((r) => {
            const inter = r.l < a.r && r.r > a.l && r.t < a.b && r.b > a.t;
            if (!inter) return false;
            return (
              (a.hx && !scrolled(i, 'x') && (r.l < a.l - 1 || r.r > a.r + 1)) ||
              (a.hy && !scrolled(i, 'y') && (r.t < a.t - 1 || r.b > a.b + 1))
            );
          }),
      );
    }
    if (cut) issues.push({ type: 'clip', text: it.label, at: desc(it.el) });
  }

  // (c) kilógás: jobb szél > a nézet szélessége (a látható részre; vízszintesen görgetős ős kivétel)
  const hScrolls = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth) return true;
    }
    return false;
  };
  const outClicks = new Set();
  for (const kind of ['click', 'text']) {
    items.forEach((it, i) => {
      if (it.kind !== kind) return;
      if (kind === 'text' && outClicks.has(it.lift)) return; // a gombját már jelentettük
      const out = clipRects(it.raw, it.cl.filter((a) => a.hard)).some((r) => r.l < vw - 1 && r.r > vw + 1);
      if (!out || hScrolls(it.el)) return;
      if (kind === 'click') outClicks.add(i);
      issues.push({ type: 'overflow', text: it.label, at: desc(it.el) });
    });
  }

  // (b) átfedés: két látható szöveges / kattintható elem, 4 px²-nél nagyobb metszet
  const area = (a, b) => {
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    return w > 0 && h > 0 ? w * h : 0;
  };
  const bbox = (rs) => ({
    l: Math.min(...rs.map((r) => r.l)),
    t: Math.min(...rs.map((r) => r.t)),
    r: Math.max(...rs.map((r) => r.r)),
    b: Math.max(...rs.map((r) => r.b)),
  });
  for (const it of items) it.box = bbox(it.raw);
  // Egy elem látható téglalapjai a másikhoz képest: a közös ősök nem vágnak (egy görgetőn belül a
  // lent lévő elemek is összevethetők), a másik elemet nem tartalmazó vágók igen (a görgető alól
  // kilógó sor nem fed át egy fölötte lévő sávot).
  const visFor = (it, other) => clipRects(it.raw, it.cl.filter((a) => !a.el.contains(other.el)));
  const overlaps = (p, q) => {
    if (area(p.box, q.box) <= 4) return false;
    const qs = visFor(q, p);
    for (const a of visFor(p, q)) for (const b of qs) if (area(a, b) > 4) return true;
    return false;
  };
  const reported = new Set();
  const key = (i, j) => (i < j ? `${i}|${j}` : `${j}|${i}`);
  const lifts = (i) => (items[i].lift >= 0 ? [i, items[i].lift] : [i]);
  const passes = [
    (p, q) => p.kind === 'click' && q.kind === 'click',
    (p, q) => p.kind !== q.kind,
    (p, q) => p.kind === 'text' && q.kind === 'text',
  ];
  for (const want of passes) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const p = items[i];
        const q = items[j];
        if (!want(p, q)) continue;
        if (p.el.contains(q.el) || q.el.contains(p.el)) continue;
        if (!overlaps(p, q)) continue;
        // ugyanazt a hibát az okozó elemek már jelentették
        const dup = lifts(i).some((a) => lifts(j).some((b) => a !== b && reported.has(key(a, b))));
        if (dup) continue;
        reported.add(key(i, j));
        issues.push({ type: 'overlap', text: p.label, other: q.label, at: desc(p.el), otherAt: desc(q.el) });
      }
    }
  }
  return { issues, stats: { items: items.length } };
}

// ---------------------------------------------------------------------------------------------
// Főprogram

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const skinsMod = loadSkinsModule();
  const SKINS = skinsMod.SKINS;

  const skinList = opt.skins ?? [...skinsMod.SKIN_IDS, 'mix'];
  for (const s of skinList) {
    if (s !== 'mix' && !SKINS[s]) throw new Error(`Ismeretlen téma: ${s}`);
  }
  const routeList = opt.routes ?? Object.keys(ROUTES);
  for (const r of routeList) if (!ROUTES[r]) throw new Error(`Ismeretlen útvonal: ${r} (${Object.keys(ROUTES).join(', ')})`);
  const skippedRoutes = routeList.filter((r) => ROUTES[r].file && !fs.existsSync(path.join(ROOT, ROUTES[r].file)));
  const routes = routeList.filter((r) => !skippedRoutes.includes(r));
  const viewports = (opt.viewports ?? VIEWPORTS).map((v) => {
    const m = /^(\d+)x(\d+)$/.exec(v);
    if (!m) throw new Error(`Rossz nézet: ${v} (pl. 360x740)`);
    return { name: v, width: Number(m[1]), height: Number(m[2]) };
  });
  if (skippedRoutes.length) console.log(`Kimarad (nincs a projektben): ${skippedRoutes.join(', ')}`);

  if (opt.build) {
    console.log('expo export -p web ...');
    const r = spawnSync('npx expo export -p web --output-dir dist', {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
    });
    if (r.status !== 0) throw new Error('Az expo export hibázott.');
  }
  if (!isFile(path.join(DIST, 'index.html'))) throw new Error('Nincs dist/index.html (futtasd build-del).');

  // kombinációk
  const combos = [];
  for (const skin of skinList) {
    const modes = skin === 'mix' ? SKINS[SAMPLE_MIX.colors].modes : SKINS[skin].modes;
    for (const mode of modes) {
      for (const route of routes) for (const vp of viewports) combos.push({ skin, mode, route, vp });
    }
  }
  console.log(`${combos.length} kombináció`);

  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome();
  const cdp = connectCdp(chrome.wsUrl);
  const issues = [];
  const t0 = Date.now();
  let done = 0;
  try {
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SPEECH_MUTE });
    fs.mkdirSync(SHOTS, { recursive: true });

    const poll = async (expr, timeoutMs) => {
      const end = Date.now() + timeoutMs;
      for (;;) {
        const v = await cdp.evaluate(expr);
        if (v) return v;
        if (Date.now() > end) return null;
        await sleep(100);
      }
    };
    const settle = () => cdp.evaluate(`(${pageSettle})(450, 8000)`);

    for (const c of combos) {
      const def = ROUTES[c.route];
      const q = new URLSearchParams({ skin: c.skin, mode: c.mode });
      if (c.skin === 'mix') q.set('mix', Object.values(SAMPLE_MIX).join('.'));
      if (def.onboarded) q.set('onboarded', '1');
      const url = `${base}${def.path}?${q}`;
      const comboIssues = [];
      try {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: c.vp.width,
          height: c.vp.height,
          deviceScaleFactor: 1,
          mobile: false,
        });
        const loaded = cdp.waitEvent('Page.loadEventFired', 60000);
        await cdp.send('Page.navigate', { url });
        await loaded;
        // az app kirajzolása (a betűk betöltéséig üres)
        if (!(await poll('document.body.innerText.trim().length > 0', 30000))) throw new Error('nem renderelt semmit');
        // a betűk betöltése átrendezi az oldalt: a kattintás előtt megvárjuk (különben mellé kattint)
        if (def.steps?.length) await settle();
        for (const step of def.steps ?? []) {
          const spec = JSON.stringify(step);
          const pos = await poll(`(${pageFindTarget})(${spec})`, 15000);
          if (!pos) throw new Error(`lépés: nincs gomb (${step.testId ?? step.text})`);
          for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
            await cdp.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
          }
          await sleep(150);
        }
        if (def.ready && !(await poll(`!!document.querySelector('[data-testid="${def.ready}"]')`, 15000))) {
          throw new Error(`nincs ${def.ready}`);
        }
        await settle();
        const res = await cdp.evaluate(`(${pageAnalyze})()`);
        comboIssues.push(...res.issues);
      } catch (err) {
        comboIssues.push({ type: 'load', text: String(err.message ?? err).slice(0, 40) });
      }
      for (const i of comboIssues) {
        issues.push({ skin: c.skin, mode: c.mode, route: c.route, viewport: c.vp.name, ...i });
      }
      if (opt.shots || comboIssues.length) {
        try {
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
          const name = `${c.skin}-${c.mode}-${c.route}-${c.vp.name}.png`;
          fs.writeFileSync(path.join(SHOTS, name), Buffer.from(shot.data, 'base64'));
        } catch {
          /* a kép nem kritikus */
        }
      }
      done++;
      if (done % 10 === 0 || done === combos.length) {
        console.log(`  ${done}/${combos.length} kombináció, ${issues.length} hiba, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }
  } finally {
    cdp.close();
    chrome.stop();
    server.close();
  }

  const seconds = (Date.now() - t0) / 1000;
  const totals = {};
  for (const i of issues) totals[i.type] = (totals[i.type] ?? 0) + 1;
  const report = {
    generatedAt: new Date().toISOString(),
    args: { skins: skinList, routes, skippedRoutes, viewports: viewports.map((v) => v.name), shots: opt.shots },
    combos: combos.length,
    secondsTotal: Math.round(seconds),
    secondsPerCombo: combos.length ? Number((seconds / combos.length).toFixed(2)) : 0,
    totals,
    issues,
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `Kész: ${combos.length} kombináció, ${report.secondsPerCombo} s/kombináció, hibák: ${JSON.stringify(totals)} -> ${path.relative(ROOT, REPORT)}`,
  );
  process.exit(issues.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(2);
});
