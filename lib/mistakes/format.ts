// PLAN-hibaim.md 2. lépés: the `kimacha-hibaim` v1 payload the /hibaim skill
// (laptop-side Drive/WhatsApp analysis) writes and Settings -> Load my
// mistakes reads. Format + rules: PLAN-hibaim.md "Formátum" section, 1:1.
//
// Deliberately import-free and erasable-syntax-only (no enum, no namespace,
// no parameter properties): scripts/check-mistakes.mjs runs this file
// directly through Node's built-in TypeScript type-stripping, so the skill
// can validate a batch with the app's own rules before it reaches Drive.

export interface MistakeDrill {
  id: string;
  prompt: string;
  answer: string;
  en: string;
}

export interface MistakePattern {
  id: string;
  title: string;
  rule: string;
  lessons: string[];
  drills: MistakeDrill[];
}

export interface MistakeSentence {
  id: string;
  en: string;
  es: string;
  wrong: string;
  pattern?: string;
  doubtful?: boolean;
}

export interface MistakeWord {
  id: string;
  es: string;
  en: string;
  note?: string;
}

export type MistakeWrongWordKind = 'spelling' | 'form' | 'word';

export interface MistakeWrongWord {
  wrong: string;
  es: string;
  kind: MistakeWrongWordKind;
  note?: string;
}

export type MistakeSource = 'claude-chat' | 'whatsapp' | 'other';

export interface MistakesBatch {
  format: 'kimacha-hibaim';
  version: 1;
  batchId: string;
  title: string;
  date: string;
  source: MistakeSource;
  patterns: MistakePattern[];
  sentences: MistakeSentence[];
  words: MistakeWord[];
  wrongWords: MistakeWrongWord[];
}

export type ValidateMistakesResult =
  | { ok: true; batch: MistakesBatch }
  | { ok: false; error: string };

const MAX_FIELD_CHARS = 300;
const MAX_ITEMS = 500;
const ID_RE = /^[a-z0-9-]{1,40}$/;
const BATCH_ID_RE = /^[a-z0-9-]{1,60}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES = ['claude-chat', 'whatsapp', 'other'];
const WRONG_WORD_KINDS = ['spelling', 'form', 'word'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function fail(msg: string): never {
  throw new Error(msg);
}

function requireArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(`${path} must be an array (it can be empty)`);
  if ((v as unknown[]).length > MAX_ITEMS) fail(`${path} has more than ${MAX_ITEMS} items`);
  return v as unknown[];
}

function requireText(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(`${path} must be a string`);
  if (v.trim().length === 0) fail(`${path} must not be empty`);
  if (v.length > MAX_FIELD_CHARS) fail(`${path} is longer than ${MAX_FIELD_CHARS} characters`);
  return v;
}

function optionalText(v: unknown, path: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') fail(`${path} must be a string`);
  if (v.length > MAX_FIELD_CHARS) fail(`${path} is longer than ${MAX_FIELD_CHARS} characters`);
  return v;
}

function requireId(v: unknown, path: string, seen: Set<string>): string {
  if (typeof v !== 'string' || !ID_RE.test(v)) fail(`${path} must match ^[a-z0-9-]{1,40}$`);
  if (seen.has(v)) fail(`Duplicate id in ${path.replace(/\[\d+\]\.id$/, '')}: ${v}`);
  seen.add(v);
  return v;
}

function parseDrill(raw: unknown, path: string, seen: Set<string>): MistakeDrill {
  if (!isPlainObject(raw)) fail(`${path} must be an object`);
  return {
    id: requireId(raw.id, `${path}.id`, seen),
    prompt: requireText(raw.prompt, `${path}.prompt`),
    answer: requireText(raw.answer, `${path}.answer`),
    en: requireText(raw.en, `${path}.en`),
  };
}

function parsePattern(raw: unknown, path: string, seen: Set<string>): MistakePattern {
  if (!isPlainObject(raw)) fail(`${path} must be an object`);
  const lessonsRaw = requireArray(raw.lessons, `${path}.lessons`);
  const lessons = lessonsRaw.map((l, i) => requireText(l, `${path}.lessons[${i}]`));
  const drillsRaw = requireArray(raw.drills, `${path}.drills`);
  const drillSeen = new Set<string>();
  const drills = drillsRaw.map((d, i) => parseDrill(d, `${path}.drills[${i}]`, drillSeen));
  return {
    id: requireId(raw.id, `${path}.id`, seen),
    title: requireText(raw.title, `${path}.title`),
    rule: requireText(raw.rule, `${path}.rule`),
    lessons,
    drills,
  };
}

function parseSentence(raw: unknown, path: string, seen: Set<string>, patternIds: Set<string>): MistakeSentence {
  if (!isPlainObject(raw)) fail(`${path} must be an object`);
  const id = requireId(raw.id, `${path}.id`, seen);
  const en = requireText(raw.en, `${path}.en`);
  const es = requireText(raw.es, `${path}.es`);
  const wrong = requireText(raw.wrong, `${path}.wrong`);
  let pattern: string | undefined;
  if (raw.pattern !== undefined) {
    pattern = requireText(raw.pattern, `${path}.pattern`);
    if (!patternIds.has(pattern)) fail(`${path}.pattern references unknown pattern: ${pattern}`);
  }
  let doubtful = false;
  if (raw.doubtful !== undefined) {
    if (typeof raw.doubtful !== 'boolean') fail(`${path}.doubtful must be a boolean`);
    doubtful = raw.doubtful;
  }
  return { id, en, es, wrong, pattern, doubtful };
}

function parseWord(raw: unknown, path: string, seen: Set<string>): MistakeWord {
  if (!isPlainObject(raw)) fail(`${path} must be an object`);
  return {
    id: requireId(raw.id, `${path}.id`, seen),
    es: requireText(raw.es, `${path}.es`),
    en: requireText(raw.en, `${path}.en`),
    note: optionalText(raw.note, `${path}.note`),
  };
}

function parseWrongWord(raw: unknown, path: string): MistakeWrongWord {
  if (!isPlainObject(raw)) fail(`${path} must be an object`);
  const wrong = requireText(raw.wrong, `${path}.wrong`);
  const es = requireText(raw.es, `${path}.es`);
  if (typeof raw.kind !== 'string' || !WRONG_WORD_KINDS.includes(raw.kind)) {
    fail(`${path}.kind must be one of ${WRONG_WORD_KINDS.join(', ')}`);
  }
  return {
    wrong,
    es,
    kind: raw.kind as MistakeWrongWordKind,
    note: optionalText(raw.note, `${path}.note`),
  };
}

function parse(raw: unknown): MistakesBatch {
  if (!isPlainObject(raw)) fail('Not a kimacha-hibaim file');

  if (raw.format !== 'kimacha-hibaim') fail(`Unknown format: ${String(raw.format)}`);
  if (raw.version !== 1) fail(`Unsupported kimacha-hibaim version: ${String(raw.version)}`);
  if (typeof raw.batchId !== 'string' || !BATCH_ID_RE.test(raw.batchId)) {
    fail('batchId must match ^[a-z0-9-]{1,60}$');
  }
  const title = requireText(raw.title, 'title');
  if (typeof raw.date !== 'string' || !DATE_RE.test(raw.date)) fail('date must match YYYY-MM-DD');
  if (typeof raw.source !== 'string' || !SOURCES.includes(raw.source)) {
    fail(`source must be one of ${SOURCES.join(', ')}`);
  }

  const patternSeen = new Set<string>();
  const patterns = requireArray(raw.patterns, 'patterns').map((p, i) => parsePattern(p, `patterns[${i}]`, patternSeen));

  const sentenceSeen = new Set<string>();
  const sentences = requireArray(raw.sentences, 'sentences').map((s, i) =>
    parseSentence(s, `sentences[${i}]`, sentenceSeen, patternSeen)
  );

  const wordSeen = new Set<string>();
  const words = requireArray(raw.words, 'words').map((w, i) => parseWord(w, `words[${i}]`, wordSeen));

  const wrongWords = requireArray(raw.wrongWords, 'wrongWords').map((w, i) => parseWrongWord(w, `wrongWords[${i}]`));

  return {
    format: 'kimacha-hibaim',
    version: 1,
    batchId: raw.batchId as string,
    title,
    date: raw.date as string,
    source: raw.source as MistakeSource,
    patterns,
    sentences,
    words,
    wrongWords,
  };
}

export function validateMistakesPayload(raw: unknown): ValidateMistakesResult {
  try {
    return { ok: true, batch: parse(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
