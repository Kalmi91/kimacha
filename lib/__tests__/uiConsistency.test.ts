// UI consistency gate (a count-based ratchet): one kind of UI per job (Check / Next button, result label, exit glyph, ...).
// A source scan of app/**, components/** and lib/**/*.tsx (not lib/i18n, not tests; no rendering). Per rule and file the
// baseline (uiConsistency.baseline.json) stores how many offending lines the file has today and why: a file may not get
// worse (more hits fail, a file not in the baseline fails at one hit) and when it gets better the number must be lowered
// (a stale count fails), so the baseline only shrinks. Reasons are required (no empty, no TODO).
// Rewrite the baseline from the current tree (keeps reasons, writes "TODO reason" for new entries, which then fail until
// written): UI_BASELINE_WRITE=1 npx jest lib/__tests__/uiConsistency.test.ts
//
// KNOWN GAPS (not covered, do not assume they are):
// - hard-coded literals of the other locales (es / de / hu "Comprobar", "Weiter", ...): only the English strings are scanned;
// - icon-library close and volume icons (a vector-icon "close" / "volume-high" instead of a ✕ / 🔊 character);
// - a progress bar hand-made from a View (only <ProgressBar height=...> is seen);
// - focus stolen without the prop: `ref.focus()` in an effect;
// - a re-exported or aliased TextInput (`import { TextInput as Input }`, a wrapper component);
// - i18n strings reached through a name that is not `t()` / `s` / `string(s)` (or an alias const of those), and labels built
//   from pieces at run time;
// - one hit is counted per line: removing one hit and adding another in the same file with the same count passes;
// - a bare `//` inside JSX text blanks the rest of that line (stripComments reads it as a comment);
// - the alias match on `s.` is a plain regex (any variable named `s` counts, whatever it holds);
// - "Continue", "Finish" and "Done" buttons are not covered by next-label.
import fs from 'fs';
import path from 'path';

import en from '@/lib/i18n/en';

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'uiConsistency.baseline.json');

type Hit = { index: number; line: number; text: string };
type Detector = (src: string) => Hit[];
type Entry = { count: number; reason: string };
type Baseline = Record<string, Record<string, Entry>>;

// --- the English strings: which i18n keys are the Check / Next / result labels --------------------------------------

const normalise = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[✓→←]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

function keysWithValue(values: string[]): string[][] {
  const out: string[][] = [];
  const walk = (node: unknown, trail: string[]) => {
    if (typeof node === 'string') {
      if (values.includes(normalise(node))) out.push(trail);
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, [...trail, k]);
    }
  };
  walk(en, []);
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- source helpers ---------------------------------------------------------------------------------------------------

const blank = (m: string) => m.replace(/[^\n]/g, ' ');

// End index (exclusive) of a template literal that starts at `i` (a backtick), `${...}` parts included.
function skipTemplate(src: string, i: number): number {
  let j = i + 1;
  while (j < src.length && src[j] !== '`') {
    if (src[j] === '\\') j += 2;
    else if (src[j] === '$' && src[j + 1] === '{') j = skipBraces(src, j + 2);
    else j++;
  }
  return j + 1;
}

// End index (exclusive) of a `{...}` body whose content starts at `i`.
function skipBraces(src: string, i: number): number {
  let depth = 1;
  let j = i;
  while (j < src.length && depth > 0) {
    const c = src[j];
    if (c === '`') j = skipTemplate(src, j);
    else if (c === "'" || c === '"') j = skipQuoted(src, j);
    else {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      j++;
    }
  }
  return j;
}

// End index (exclusive) of a quoted string that starts at `i`; it ends at the line end at the latest (JSX text with an apostrophe).
function skipQuoted(src: string, i: number): number {
  const q = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== q && src[j] !== '\n') {
    if (src[j] === '\\') j++;
    j++;
  }
  return src[j] === q ? j + 1 : j;
}

// Comments blanked out (newlines kept, so line numbers stay right); string-aware: `'**/*.ts'` does not open a comment.
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "'" || c === '"') {
      const e = skipQuoted(src, i);
      out += src.slice(i, e);
      i = e;
    } else if (c === '`') {
      const e = skipTemplate(src, i);
      out += src.slice(i, e);
      i = e;
    } else if (c === '/' && n === '/') {
      let e = src.indexOf('\n', i);
      if (e < 0) e = src.length;
      out += blank(src.slice(i, e));
      i = e;
    } else if (c === '/' && n === '*') {
      let e = src.indexOf('*/', i + 2);
      e = e < 0 ? src.length : e + 2;
      out += blank(src.slice(i, e));
      i = e;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function hitAt(src: string, index: number): Hit {
  const line = src.slice(0, index).split('\n').length;
  return { index, line, text: src.split('\n')[line - 1].trim().slice(0, 120) };
}

function allHits(src: string, re: RegExp, accept: (m: RegExpExecArray) => boolean = () => true): Hit[] {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const out: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = g.exec(src))) {
    if (m[0] === '') g.lastIndex++;
    if (accept(m)) out.push(hitAt(src, m.index));
  }
  return out;
}

// One hit per offending line.
function perLine(hits: Hit[]): Hit[] {
  const seen = new Map<number, Hit>();
  for (const h of hits) if (!seen.has(h.line) || h.index < seen.get(h.line)!.index) seen.set(h.line, h);
  return [...seen.values()].sort((a, b) => a.line - b.line);
}

// The `<Name ...>` tags of a source: [start, end) of each, the end found with a brace-depth scan (an `=>` or a `>` inside
// `{...}` does not close the tag). `attrs` is the tag's text outside any `{...}`.
function tagsNamed(src: string, name: string): { start: number; end: number; attrs: string }[] {
  const out: { start: number; end: number; attrs: string }[] = [];
  const re = new RegExp(`<${name}\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let j = m.index + m[0].length;
    let attrs = '';
    while (j < src.length) {
      const c = src[j];
      if (c === '{') {
        j = skipBraces(src, j + 1);
        attrs += '{}';
      } else if (c === '"' || c === "'") {
        const e = skipQuoted(src, j);
        attrs += src.slice(j, e);
        j = e;
      } else if (c === '>') {
        break;
      } else {
        attrs += c;
        j++;
      }
    }
    out.push({ start: m.index, end: j + 1, attrs });
  }
  return out;
}

// [start, end) of the `prop=value` attribute (name included, as a hit can start at the name) of each `<name ...>` tag (a `{...}` or a quoted value), top level only.
function propValueRanges(src: string, name: string, prop: string): [number, number][] {
  const out: [number, number][] = [];
  for (const t of tagsNamed(src, name)) {
    let j = t.start + name.length + 1;
    while (j < t.end - 1) {
      const c = src[j];
      if (c === '{') j = skipBraces(src, j + 1);
      else if (c === '"' || c === "'") j = skipQuoted(src, j);
      else {
        const re = /([\w-]+)\s*=\s*/y;
        re.lastIndex = j;
        const m = re.exec(src);
        if (!m) {
          j++;
          continue;
        }
        const from = j;
        j += m[0].length;
        const end = src[j] === '{' ? skipBraces(src, j + 1) : src[j] === '"' || src[j] === "'" ? skipQuoted(src, j) : j;
        if (m[1] === prop) out.push([from, end]);
        j = end;
      }
    }
  }
  return out;
}

// A label made of these words: i18n key references plus hard-coded literals.
function labelDetector(values: string[], words: string[]): Detector {
  const trails = keysWithValue(values);
  const prefix = String.raw`(?:\bs|\bstrings?|\bt\(\))`;
  const keyPatterns = trails.flatMap((trail) => {
    const key = esc(trail[trail.length - 1]);
    // `s.check` (an aliased namespace) and the full path `t().card.check` / `s.card.check`.
    return trail.length === 1
      ? [new RegExp(String.raw`${prefix}\.${key}\b`)]
      : [new RegExp(String.raw`${prefix}\.${trail.map(esc).join(String.raw`\.`)}\b`), new RegExp(String.raw`${prefix}\.${key}\b`)];
  });
  const source = String.raw`(?:t\(\)|s|strings?)`;
  const exactLiteral = new RegExp(String.raw`(['"\`])(?:✓ )?(?:${words.map(esc).join('|')})(?: →)?\1`);
  const jsxText = />([^<>{}\n]*)</;
  const propText = /\b(?:label|title|text|children|accessibilityLabel|caption)\s*(?:=\s*\{?|:\s*)(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/;
  return (src) => {
    const hits: Hit[] = [];
    for (const p of keyPatterns) hits.push(...allHits(src, p));
    // `const c = t().card;` then `c.check`
    for (const d of src.matchAll(new RegExp(String.raw`\b(?:const|let)\s+(\w+)\s*=\s*${source}\.(\w+)\b(?!\s*[.(\[])`, 'g'))) {
      for (const trail of trails) {
        if (trail.length === 2 && trail[0] === d[2]) hits.push(...allHits(src, new RegExp(String.raw`\b${esc(d[1])}\.${esc(trail[1])}\b`)));
      }
    }
    // `const { check } = t().card;`
    for (const d of src.matchAll(new RegExp(String.raw`\b(?:const|let)\s*\{([^}]*)\}\s*=\s*${source}\.(\w+)\b`, 'g'))) {
      const names = d[1].split(',').map((p) => p.split(':')[0].trim());
      if (trails.some((trail) => trail.length === 2 && trail[0] === d[2] && names.includes(trail[1]))) hits.push(hitAt(src, d.index ?? 0));
    }
    hits.push(...allHits(src, exactLiteral));
    hits.push(...allHits(src, jsxText, (m) => values.includes(normalise(m[1]))));
    hits.push(...allHits(src, propText, (m) => values.includes(normalise(m[2]))));
    return perLine(hits);
  };
}

const GLYPH = '[✕×✖]';

const DETECTORS: Record<string, Detector> = {
  'check-label': labelDetector(['check'], ['Check']),
  'next-label': labelDetector(['next', 'next task'], ['Next', 'Next task']),
  // a label handed to the shared <ResultBadge> (`label`), or to <AnswerFeedbackBox> (`badgeLabel`, which draws that badge), is the badge's own business
  'result-label': (src) => {
    const given = [...propValueRanges(src, 'ResultBadge', 'label'), ...propValueRanges(src, 'AnswerFeedbackBox', 'badgeLabel')];
    return labelDetector(['correct', 'wrong', 'not quite'], ['Correct', 'Not quite', 'Wrong'])(src).filter((h) => !given.some(([a, b]) => h.index >= a && h.index < b));
  },
  'exit-glyph': (src) => perLine([...allHits(src, new RegExp(`(['"\`])\\s*${GLYPH}\\s*\\1`)), ...allHits(src, new RegExp(`>\\s*${GLYPH}\\s*<`))]),
  'no-autofocus': (src) => perLine(allHits(src, /\bautoFocus\b(?!\s*=\s*\{\s*false\s*\})/)),
  'progress-bar-height': (src) => perLine(tagsNamed(src, 'ProgressBar').filter((t) => /\bheight\s*=/.test(t.attrs)).map((t) => hitAt(src, t.start))),
  'speak-glyph': (src) => perLine(allHits(src, /[🔊🔈🔉]/u)),
  // JSX use only: `useRef<TextInput>(null)` and `RefObject<TextInput | null>` are type positions
  'answer-input': (src) => perLine(allHits(src, /(?<![\w$])<TextInput\b/)),
};

// The shared owners: the files that are allowed to draw the thing.
const OWNERS: Record<string, string[]> = {
  'check-label': ['components/learn/DockedAction.tsx', 'components/learn/DockSlot.tsx', 'components/learn/InlineAction.tsx'],
  'next-label': ['components/learn/DockedAction.tsx', 'components/learn/DockSlot.tsx', 'components/learn/InlineAction.tsx'],
  'result-label': ['components/ResultBadge.tsx'],
  'exit-glyph': ['components/grammar/Themed.tsx'],
  'no-autofocus': [],
  'progress-bar-height': ['components/grammar/Themed.tsx'],
  'speak-glyph': ['components/SpeakButton.tsx'],
  'answer-input': [],
};

// How to fix it (one line, shown in the failure message).
const HINTS: Record<string, string> = {
  'check-label': 'use the shared button: components/learn/DockedAction (docked) or InlineAction (inline), without a label',
  'next-label': 'use the shared button: components/learn/DockedAction (docked) or InlineAction (inline), without a label',
  'result-label': 'use components/grammar/AnswerFeedbackBox (or components/ResultBadge) instead of your own correct / wrong label',
  'exit-glyph': 'use the shared back / close component in components/grammar/Themed.tsx',
  'no-autofocus': 'remove autoFocus (focus through useFocusOnNewCard)',
  'progress-bar-height': 'drop the height prop: the shared ProgressBar height (components/grammar/Themed.tsx) applies',
  'speak-glyph': 'use the shared SpeakButton (components/SpeakButton.tsx)',
  'answer-input': 'no shared answer input exists yet: do not add a new own TextInput',
};

const RULES = Object.keys(DETECTORS).sort();

// --- the ratchet ------------------------------------------------------------------------------------------------------

type Current = Record<string, Hit[]>;

const lines = (hits: Hit[]) => hits.map((h) => `${h.line}: ${h.text}`).join(' | ');

// worse: a file has more hits than its baseline count (a new file counts from one); stale: fewer (or none).
function compare(rule: string, current: Current, base: Record<string, Entry>): { worse: string[]; stale: string[] } {
  const worse: string[] = [];
  const stale: string[] = [];
  for (const [file, hits] of Object.entries(current)) {
    const was = base[file]?.count ?? 0;
    if (hits.length > was) {
      worse.push(`${rule}: ${file}: baseline ${was}, now ${hits.length}  [${lines(hits)}]  (fix: ${HINTS[rule]})`);
    }
  }
  for (const [file, entry] of Object.entries(base)) {
    const now = current[file]?.length ?? 0;
    if (now < entry.count) {
      stale.push(`${rule}: ${file}: baseline ${entry.count}, now ${now}: lower the count in the baseline (or run UI_BASELINE_WRITE=1)${now === 0 ? ', or remove the entry' : ''}`);
    }
  }
  return { worse, stale };
}

// --- the scan ---------------------------------------------------------------------------------------------------------

function sourceFiles(dir: string, tsx: boolean, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules' && !(tsx && e.name === 'i18n')) sourceFiles(full, tsx, out);
    } else if ((tsx ? /\.tsx$/ : /\.tsx?$/).test(e.name) && !/\.test\./.test(e.name)) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const FILES = [
  ...['app', 'components'].flatMap((d) => sourceFiles(path.join(ROOT, d), false)),
  ...sourceFiles(path.join(ROOT, 'lib'), true).filter((f) => !/[\\/]lib[\\/]__tests__[\\/]/.test(f)),
].map(rel);

const current: Record<string, Current> = {};
for (const rule of RULES) current[rule] = {};
for (const file of FILES) {
  const src = stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  for (const rule of RULES) {
    if (OWNERS[rule].includes(file)) continue;
    const hits = DETECTORS[rule](src);
    if (hits.length) current[rule][file] = hits;
  }
}

const sortedObject = <T>(o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

function readBaseline(): Baseline {
  return fs.existsSync(BASELINE_PATH) ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baseline) : {};
}

if (process.env.UI_BASELINE_WRITE === '1') {
  const old = readBaseline();
  const next: Baseline = {};
  for (const rule of RULES) {
    const entries: Record<string, Entry> = {};
    for (const [file, hits] of Object.entries(current[rule])) entries[file] = { count: hits.length, reason: old[rule]?.[file]?.reason ?? 'TODO reason' };
    if (Object.keys(entries).length) next[rule] = sortedObject(entries);
  }
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(sortedObject(next), null, 2) + '\n');
}

// --- the tests --------------------------------------------------------------------------------------------------------

describe('UI consistency gate: scan', () => {
  it('scans a real tree (not silently empty)', () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES).toContain('components/learn/DockedAction.tsx');
    expect(FILES.some((f) => f.startsWith('lib/') && f.endsWith('.tsx'))).toBe(true);
    expect(FILES.some((f) => f.startsWith('lib/i18n/'))).toBe(false);
  });
});

describe('UI consistency gate: ratchet', () => {
  const baseline = readBaseline();

  it.each(RULES)('%s: no file gets worse (no new file, no new hit)', (rule) => {
    expect(compare(rule, current[rule], baseline[rule] ?? {}).worse).toEqual([]);
  });

  it.each(RULES)('%s: no baseline count is out of date', (rule) => {
    expect(compare(rule, current[rule], baseline[rule] ?? {}).stale).toEqual([]);
  });

  it('every reason is written (not empty, not TODO) and every count is a positive number', () => {
    const bad: string[] = [];
    for (const [rule, entries] of Object.entries(baseline)) {
      if (!RULES.includes(rule)) bad.push(`unknown rule ${rule}`);
      for (const [file, e] of Object.entries(entries)) {
        if (!e.reason?.trim() || e.reason.trim().startsWith('TODO')) bad.push(`${rule}: ${file}: reason is "${e.reason}"`);
        if (!Number.isInteger(e.count) || e.count < 1) bad.push(`${rule}: ${file}: count is ${e.count}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the baseline is sorted (rules and paths)', () => {
    const rules = Object.keys(baseline);
    expect(rules).toEqual([...rules].sort());
    for (const rule of rules) expect(Object.keys(baseline[rule])).toEqual(Object.keys(sortedObject(baseline[rule])));
  });
});

describe('UI consistency gate: ratchet logic', () => {
  const hit = (line: number): Hit => ({ index: line, line, text: `line ${line}` });
  const base = { 'a.tsx': { count: 1, reason: 'r' } };

  it('a second offender in an already baselined file fails', () => {
    const r = compare('check-label', { 'a.tsx': [hit(3), hit(9)] }, base);
    expect(r.worse).toHaveLength(1);
    expect(r.worse[0]).toMatch(/a\.tsx: baseline 1, now 2/);
    expect(r.worse[0]).toMatch(/9: line 9/);
  });

  it('a file that is not in the baseline fails at one hit', () => {
    expect(compare('check-label', { 'b.tsx': [hit(1)] }, base).worse).toHaveLength(1);
  });

  it('a lower count (or no hit left) is stale, the same count passes', () => {
    expect(compare('check-label', { 'a.tsx': [hit(1)] }, base)).toEqual({ worse: [], stale: [] });
    expect(compare('check-label', {}, base).stale[0]).toMatch(/lower the count/);
    expect(compare('check-label', { 'a.tsx': [hit(1)] }, { 'a.tsx': { count: 3, reason: 'r' } }).stale).toHaveLength(1);
  });
});

describe('UI consistency gate: calibration (the detectors flag the known own variants)', () => {
  const flagged = (rule: string, file: string) => {
    if (!FILES.includes(file)) throw new Error(`calibration list needs updating: ${file} no longer exists`);
    return file in current[rule];
  };

  // ExamChoiceCard has no Check button (a pick settles at once, it only has Next), so it is flagged by next-label only.
  it.each([
    'components/EasySentenceCard.tsx',
    'components/grammar/NewKinds.tsx',
    'components/grammar/TypedKinds.tsx',
    'components/grammar/drill/MatchFormItems.tsx',
    'components/grammar/drill/WhyTransformItems.tsx',
    'app/grammar/exam-round.tsx',
    'app/grammar/form-check/[topic].tsx',
    'components/exam/ExamTypeCard.tsx',
    'components/exam/ExamMatchCard.tsx',
    'components/exam/ExamTilesCard.tsx',
    'components/speech/SpeechPlay.tsx',
  ])('check-label flags %s', (file) => {
    expect(flagged('check-label', file)).toBe(true);
  });

  it.each([
    'components/EasySentenceCard.tsx',
    'components/NewWordCard.tsx',
    'components/grammar/GrammarDrill.tsx',
    'components/grammar/LevelTestFeedback.tsx',
    'app/grammar/random.tsx',
    'app/grammar/small-test.tsx',
    'app/grammar/big-test.tsx',
    'app/mock-exam.tsx',
  ])('next-label flags %s', (file) => {
    expect(flagged('next-label', file)).toBe(true);
  });
});

describe('UI consistency gate: the detectors (one bad and one good snippet per rule)', () => {
  const CASES: Record<string, { bad: string; good: string }> = {
    'check-label': {
      bad: 'const s = t();\nconst x = <Text>{`✓ ${s.card.check}`}</Text>;',
      good: 'const x = <Text>{s.card.typeSentence}</Text>;',
    },
    'next-label': {
      bad: '<ExamButton label="Next" onPress={go} />',
      good: '<DockedAction tone="next" onPress={go} />',
    },
    'result-label': {
      bad: '<Text>Not quite</Text>',
      good: "const result = answer === 'correct' ? 1 : 0;",
    },
    'exit-glyph': {
      bad: '<Pressable onPress={close}><Text>✕</Text></Pressable>',
      good: 'const area = `${w} × ${h}`;',
    },
    'no-autofocus': {
      bad: '<TextInput autoFocus value={v} />',
      good: '<TextInput autoFocus={false} value={v} />',
    },
    'progress-bar-height': {
      bad: '<ProgressBar value={v} onDone={() => x} height={12} />',
      good: '<ProgressBar value={v} style={{ height: 4 }} />',
    },
    'speak-glyph': {
      bad: "<Text>{'🔈'}</Text>",
      good: '<SpeakButton text={w} />',
    },
    'answer-input': {
      bad: '<TextInput value={v} onChangeText={set} />',
      good: 'const ref = useRef<TextInput>(null);\nconst r2: RefObject<TextInput | null> = x;',
    },
  };

  const run = (rule: string, src: string) => DETECTORS[rule](stripComments(src));

  it('has a case for every rule', () => {
    expect(Object.keys(CASES).sort()).toEqual(RULES);
  });

  it.each(Object.keys(CASES).sort())('%s: flags the bad snippet, passes the good one', (rule) => {
    expect(run(rule, CASES[rule].bad).length).toBeGreaterThan(0);
    expect(run(rule, CASES[rule].good)).toEqual([]);
  });

  it('comments do not count, but a comment-like string does not open a comment', () => {
    expect(run('no-autofocus', '// autoFocus is banned\n/* <TextInput autoFocus /> */')).toEqual([]);
    expect(run('no-autofocus', "const g = '**/*.ts';\n<TextInput autoFocus />")).toHaveLength(1);
  });

  it('exact literals: {"Check"}, "✓ Check", "Next →", and the alias forms', () => {
    expect(run('check-label', "<Text>{'Check'}</Text>")).toHaveLength(1);
    expect(run('check-label', 'const l = "✓ Check";')).toHaveLength(1);
    expect(run('next-label', "const l = 'Next →';")).toHaveLength(1);
    expect(run('check-label', 'const c = t().card;\nconst l = c.check;')).toHaveLength(1);
    expect(run('check-label', 'const { check } = t().card;')).toHaveLength(1);
    expect(run('next-label', 'const x = foo.card.next;')).toEqual([]);
    expect(run('next-label', "const l = 'Next task';")).toHaveLength(1);
    expect(run('next-label', 'const l = <Text>{s.nextTask}</Text>;')).toHaveLength(1);
  });

  it('a label passed to <ResultBadge> is not flagged', () => {
    expect(run('result-label', "<ResultBadge label={'Correct'} onPress={() => go()} />")).toEqual([]);
    expect(run('result-label', "<AnswerFeedbackBox correct badgeLabel={'Correct'} />")).toEqual([]);
    expect(run('result-label', "<ResultBadge label={'Wrong'} />")).toEqual([]);
    expect(run('result-label', "<ResultBadge label={x} hint={'Wrong'} />")).toHaveLength(1);
    expect(run('result-label', '<AnswerFeedbackBox correct>Correct</AnswerFeedbackBox>')).toHaveLength(1);
    expect(run('result-label', "<Text>{'Correct'}</Text>")).toHaveLength(1);
  });
});
