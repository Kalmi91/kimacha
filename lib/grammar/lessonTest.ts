// PLAN-vizsga B. szakasz (8. lépés, Kálmán 2026-10-01: B1 b, B2 a, B3 a, B4 a): a nyelvtani
// lecke végi teszt. 10 kérdés a lecke SAJÁT tételeiből (a lecke mondatai mehetnek, N1),
// vegyes fajtával; az átmenés 80% (mint a szintvizsgánál); a teszt NEM számít a lecke
// %-ába (lib/grammar/lessonScore.ts), külön "Test passed" jelet kap; a bukás nem zár le semmit.
//
// A tárolás a meglévő `grammar-course` game_progress táblában, leckénként egy sor:
//   `${topic}:lessontest`  state 'passed' | 'failed'  data LessonTestResult
// A `lessonScoresByTopic` (lecke-%) és a `doneGrammarTopicProgress` (kész-jelzés) ezt a sort
// nem olvassa (más sor-forma, más state), így a teszt a lecke %-át nem érinti. Nincs új tábla.

import { examPassed, EXAM_PASS_PCT } from '@/lib/exam/score';
import {
  isFormItem,
  isLessonV2,
  isMarkItem,
  isMatchItem,
  isOrderItem,
  isSpotItem,
  isTransformItem,
  isTrialItem,
  isWhyItem,
  type GrammarKind,
  type GrammarTopicData,
} from '@/lib/games/content';
import { buildGrammarRound, grammarRoundItemKind, isChoiceRoundItem, type GrammarRoundItem } from '@/lib/games/grammarChoice';
import { scoredKinds } from '@/lib/grammar/syllabus';
import { kindProgressFromRows } from '@/lib/grammar/lessonScore';
import { TENSE_NAMES } from '@/lib/grammar/lessonTypes';
import { t } from '@/lib/i18n';
import { tileWords } from '@/lib/sentenceCards';
import { hashString, shuffleArray, shuffleOptions } from '@/lib/shuffle';
import { fixedSentence } from '@/components/grammar/NewKinds';

export const LESSON_TEST_SIZE = 10;
export const LESSON_TEST_PASS_PCT = EXAM_PASS_PCT;

const KEY_SUFFIX = ':lessontest';
export const lessonTestKey = (topicId: string) => `${topicId}${KEY_SUFFIX}`;

/** Egy lecke mentett teszt-eredménye. */
export interface LessonTestResult {
  /** Egyszer már átment-e (az újrapróba ezt nem veszi el). */
  passed: boolean;
  /** A legjobb pontszám, egész százalék. */
  best: number;
  bestAt: string;
  /** A legutóbbi próba pontszáma, egész százalék. */
  last: number;
  lastAt: string;
  /** A legutóbbi próba elrontott tételeinek id-ja: a következő próba ezeket húzza előre. */
  missed: string[];
}

type Row = { itemId: string; state: string; data: unknown };

function isResult(data: unknown): data is LessonTestResult {
  const d = data as Partial<LessonTestResult> | null | undefined;
  return !!d && typeof d.passed === 'boolean' && typeof d.best === 'number' && typeof d.last === 'number';
}

/** Új próba beolvasztása a korábbi eredménybe: az átmenés és a legjobb pontszám nem vész el. */
export function mergeLessonTestResult(
  prev: LessonTestResult | null | undefined,
  correct: number,
  total: number,
  date: string,
  missed: string[]
): LessonTestResult {
  const pct = total > 0 ? Math.floor((correct * 100) / total) : 0;
  const passed = examPassed(correct, total);
  if (!prev) return { passed, best: pct, bestAt: date, last: pct, lastAt: date, missed };
  const better = pct > prev.best;
  return {
    passed: prev.passed || passed,
    best: better ? pct : prev.best,
    bestAt: better ? date : prev.bestAt,
    last: pct,
    lastAt: date,
    missed,
  };
}

/** Egy lecke teszt-eredménye a haladás-sorokból, vagy null, ha még nem tesztelt. */
export function lessonTestFromRows(rows: Row[], topicId: string): LessonTestResult | null {
  const key = lessonTestKey(topicId);
  for (const row of rows) {
    if (row.itemId === key && isResult(row.data)) return row.data;
  }
  return null;
}

/** Azok a leckék, amiken a tanuló átment a teszten (a tanterv-lista "Test passed" jeléhez). */
export function lessonTestPassedTopics(rows: Row[]): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    if (!row.itemId.endsWith(KEY_SUFFIX) || !isResult(row.data) || !row.data.passed) continue;
    out.add(row.itemId.slice(0, -KEY_SUFFIX.length));
  }
  return out;
}

function hadRound(rows: Row[], topicId: string, kind: GrammarKind): boolean {
  const p = kindProgressFromRows(rows, topicId, kind);
  if (p.best || p.legacy) return true;
  // A FB290-es "kész" sor: `${topic}:${kind}` (>= 80%-os kör) vagy a régi, egész-lecke sor (`${topic}`).
  return rows.some((r) => r.state === 'done' && (r.itemId === `${topicId}:${kind}` || r.itemId === topicId));
}

/** B1 b: a teszt-gomb akkor él, ha a lecke MINDEN (a %-ba számító) feladat-fajtájából volt már befejezett kör. */
export function lessonTestUnlocked(lesson: GrammarTopicData, rows: Row[], topicId: string): boolean {
  const kinds = scoredKinds(lesson);
  return kinds.length > 0 && kinds.every((k) => hadRound(rows, topicId, k));
}

// ---------------------------------------------------------------------------
// A kérdések. A lecke-tételek a vizsga-kártyákon (components/exam/*) jelennek meg: ott a
// helyes válasz után nincs visszajelzés, a hibás után a helyes látszik (A5 c); a magyarázat
// (a lecke `why`-ja) az eredmény-lapon jön az elrontott tételekhez.

export type LessonTestView =
  | { card: 'choice'; heading: string; text: string; options: string[]; correctIndex: number }
  | { card: 'type'; prompt: string; hint?: string; answer: string; accept?: string[]; sentence: boolean }
  | { card: 'tiles'; prompt: string; answerTokens: string[]; sentence: string }
  | { card: 'match'; pairs: { left: string; right: string }[] };

export interface LessonTestQuestion {
  id: string;
  kind: GrammarKind;
  view: LessonTestView;
  /** Az eredmény-lap sora: mit kérdezett, mi a helyes (üres: nincs egyetlen válasz), és miért. */
  review: { question: string; answer: string; why?: string };
}

interface Ctx {
  topic: GrammarTopicData;
  learnedLang: string;
  contentLang: string;
  seed: number;
}

function toQuestion(r: GrammarRoundItem, ctx: Ctx): LessonTestQuestion | null {
  const s = t();
  const kind = grammarRoundItemKind(r);
  const pick = (l: Record<string, string>) => l[ctx.contentLang] ?? l.en;
  const optionSeed = (id: string) => hashString(`${ctx.topic.topic}:${id}:${ctx.seed}:test`);

  if (isChoiceRoundItem(r)) {
    const it = r.item;
    if (r.options.length < 2 || r.correctIndex < 0) return null;
    if (isMarkItem(it)) {
      return {
        id: it.id,
        kind,
        view: {
          card: 'choice',
          heading: s.games.grammarChoice.markPrompt(s.games.grammarChoice.wordClass[it.target] ?? it.target),
          text: it.sentence,
          options: r.options,
          correctIndex: r.correctIndex,
        },
        review: { question: it.sentence, answer: r.options[r.correctIndex], why: pick(it.why) },
      };
    }
    if (!it.sentence.includes('___')) return null;
    return {
      id: it.id,
      kind,
      view: { card: 'choice', heading: s.exam.chooseGap, text: it.sentence, options: r.options, correctIndex: r.correctIndex },
      review: { question: it.sentence, answer: it.sentence.replace('___', r.options[r.correctIndex]), why: pick(it.why) },
    };
  }

  const item = r.item;
  if (isMatchItem(item)) {
    if (item.pairs.length < 2) return null;
    // A pár {es, en} szó szerint spanyol/angol; a vizsga-kártya bal oldala a TANULT nyelv.
    const learnedIsEn = ctx.learnedLang === 'en';
    const pairs = item.pairs.map((p) => ({ left: learnedIsEn ? p.en : p.es, right: learnedIsEn ? p.es : p.en }));
    return {
      id: item.id,
      kind,
      view: { card: 'match', pairs },
      review: { question: pairs.map((p) => `${p.left} = ${p.right}`).join(' · '), answer: '' },
    };
  }
  if (isFormItem(item)) {
    const table = isLessonV2(ctx.topic) ? ctx.topic.body.find((b) => b.kind === 'table' && b.id === item.table) : undefined;
    const headerCell = table && table.kind === 'table' ? table.header.find((h) => h.es === item.verb) : undefined;
    const localized = headerCell ? pick(headerCell) : undefined;
    const verbLabel = localized && localized !== item.verb ? `${item.verb} (${localized})` : item.verb;
    const prompt = `${verbLabel} · ${item.person}`;
    return {
      id: item.id,
      kind,
      view: { card: 'type', prompt, hint: s.grammar.formHint, answer: item.answer, accept: item.accept, sentence: false },
      review: { question: prompt, answer: item.answer },
    };
  }
  if (isWhyItem(item)) {
    const sh = shuffleOptions(
      item.options.map((o) => pick(o.text)),
      item.correctIndex,
      optionSeed(item.id)
    );
    const heading = item.target ? s.games.grammarChoice.whyQuestion(item.target) : s.lessonTest.whyHeading;
    return {
      id: item.id,
      kind,
      view: { card: 'choice', heading, text: item.es, options: sh.options, correctIndex: sh.correctIndex },
      // Az eredmény-lapon a kérdés szövege is látszik, nem csak a mondat.
      review: { question: `${heading}\n${item.es}`, answer: sh.options[sh.correctIndex], why: pick(item.tr) },
    };
  }
  if (isTransformItem(item)) {
    const tense = pick(TENSE_NAMES[item.tense.to]);
    return {
      id: item.id,
      kind,
      view: {
        card: 'type',
        prompt: item.prompt.es,
        hint: s.grammar.rewriteTo(`*${tense}*`),
        answer: item.answer,
        accept: item.accept,
        sentence: true,
      },
      review: { question: item.prompt.es, answer: item.answer, why: pick(item.why) },
    };
  }
  if (isSpotItem(item)) {
    const words = item.es.split(/\s+/).filter(Boolean);
    if (item.wrongIndex < 0 || item.wrongIndex >= words.length || item.options.length < 2) return null;
    const marked = words.map((w, i) => (i === item.wrongIndex ? `«${w}»` : w)).join(' ');
    const sh = shuffleOptions(
      item.options.map((o) => (o === '' ? s.grammar.spotDelete : o)),
      item.correctIndex,
      optionSeed(item.id)
    );
    return {
      id: item.id,
      kind,
      view: { card: 'choice', heading: s.grammar.spotPickFix, text: marked, options: sh.options, correctIndex: sh.correctIndex },
      review: {
        question: item.es,
        answer: fixedSentence(item.es, item.wrongIndex, item.options[item.correctIndex]),
        why: pick(item.explain),
      },
    };
  }
  if (isOrderItem(item)) {
    const answerTokens = tileWords(item.es);
    if (answerTokens.length < 2) return null;
    return {
      id: item.id,
      kind,
      view: { card: 'tiles', prompt: pick(item.prompt), answerTokens, sentence: item.es },
      review: { question: pick(item.prompt), answer: item.es },
    };
  }
  // A diktálás hallgatást kérne, a teszt (mint a vizsga) hang nélkül megy: kimarad.
  return null;
}

export interface BuildLessonTestOptions {
  seed: number;
  learnedLang: string;
  contentLang: string;
  size?: number;
  /** Az előző próba elrontott tételei: a friss tételek közt előre kerülnek. */
  missedBefore?: ReadonlySet<string>;
  /** A már feltett tételek (újrapróba): a rendszer előbb a még nem látottakból húz, "új 10 tételt". */
  avoid?: ReadonlySet<string>;
}

/**
 * A teszt: a lecke tételeiből (az ideiglenes "ÚJ · TESZT" tételek nélkül), fajtánként
 * körbejárva, hogy vegyes legyen. Fajtán belül a friss tétel megelőzi a már látottat, azon
 * belül az előző próbán elrontott a többit. Ha a leckében kevesebb tétel van, mint `size`,
 * annyi kérdés lesz, ahány van.
 */
export function buildLessonTest(lesson: GrammarTopicData, opts: BuildLessonTestOptions): LessonTestQuestion[] {
  const { seed, size = LESSON_TEST_SIZE, missedBefore, avoid } = opts;
  const ctx: Ctx = { topic: lesson, learnedLang: opts.learnedLang, contentLang: opts.contentLang, seed };

  const groups = new Map<GrammarKind, LessonTestQuestion[]>();
  for (const r of buildGrammarRound(lesson, seed)) {
    if (isTrialItem(r.item)) continue;
    const q = toQuestion(r, ctx);
    if (!q) continue;
    const list = groups.get(q.kind) ?? [];
    list.push(q);
    groups.set(q.kind, list);
  }

  const queues: LessonTestQuestion[][] = [];
  for (const kind of shuffleArray([...groups.keys()], seed)) {
    const shuffled = shuffleArray(groups.get(kind) ?? [], seed + hashString(kind));
    // rang: 0 friss+elrontott, 1 friss, 2 látott+elrontott, 3 látott (stabil, kézzel szétválogatva)
    const buckets: LessonTestQuestion[][] = [[], [], [], []];
    for (const q of shuffled) buckets[(avoid?.has(q.id) ? 2 : 0) + (missedBefore?.has(q.id) ? 0 : 1)].push(q);
    queues.push(buckets.flat());
  }

  const picked: LessonTestQuestion[] = [];
  for (let round = 0; picked.length < size; round++) {
    let any = false;
    for (const queue of queues) {
      if (picked.length >= size) break;
      if (round < queue.length) {
        picked.push(queue[round]);
        any = true;
      }
    }
    if (!any) break;
  }
  return shuffleArray(picked, seed + 1);
}

/** Hány kérdéses a lecke tesztje (a gomb alatti sorhoz): `LESSON_TEST_SIZE`, vagy kevesebb, ha a leckében kevesebb tétel van. */
export function lessonTestSize(lesson: GrammarTopicData, learnedLang: string, contentLang: string): number {
  return buildLessonTest(lesson, { seed: 1, learnedLang, contentLang }).length;
}
