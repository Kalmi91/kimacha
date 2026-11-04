// The data behind the level test's result card (FB576-581, FB588, FB589): a readable form task, the translation, the
// "why not the others" texts, the table with the asked cell, the rule and the typed-mistake lookup. Pure, no React.
// lessonTest.ts calls these from `toQuestion`; every field is optional and the other screens ignore them.

import type { LessonBlock, FormItem, Lang4 } from '@/lib/grammar/lessonTypes';
import { t } from '@/lib/i18n';

type TableBlock = Extract<LessonBlock, { kind: 'table' }>;
type Pick = (l: Record<string, string>) => string;

export interface ResultTable {
  title: string;
  header: string[];
  rows: string[][];
  /** The asked cell (row and column inside `rows`). */
  hl?: { row: number; col: number };
}

export interface QuestionDetail {
  /** The filled sentence with the right word to show in green (gap and mark items). */
  filled?: { before: string; word: string; after: string };
  /** The translation, absent when it equals the sentence. */
  tr?: string;
  /** One entry per wrong option that has a text. */
  whyNot?: { option: string; text: string }[];
  /** Form items: the table (the asked person's column, or only the asked row) with the asked cell. */
  table?: ResultTable;
  /** Form items: the nearest text or tip block before the table in the lesson body. */
  rule?: string;
  /** Form items: what to say about a typed answer (the item's own `wrong` text, or which other form it is); null for none. */
  explainTyped?: (typed: string) => string | null;
}

/** Lowercase, accents and extra spaces removed: the key of the typed-mistake lookup. */
export const normTyped = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const PERSON_HEADER = /^(person|persona|pronoun|pronombre)$/i;

/** A verb table: its first column is the person. */
export const isPersonTable = (table: TableBlock): boolean => {
  const h = table.header[0];
  return !!h && (PERSON_HEADER.test(h.en ?? '') || PERSON_HEADER.test(h.es ?? ''));
};

/** The column a form item asks: the header named by `verb` (the schema's rule), else a looser match, else the 2nd column of a 2-column table; -1 if none. */
export function askedColumn(table: TableBlock, verb: string): number {
  const cols = table.header.map((h) => Object.values(h));
  const same = (v: string) => cols.findIndex((vals, ci) => ci > 0 && vals.includes(v));
  let ci = same(verb);
  if (ci < 0) ci = cols.findIndex((vals, c) => c > 0 && vals.some((v) => v.startsWith(`${verb} (`)));
  if (ci < 0 && cols.length === 2) ci = 1;
  return ci;
}

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

export interface FormTask {
  prompt: string;
  hint: string;
  /** Not a verb table: the table's title and the first column's header label the cell. */
  heading?: string;
  label?: string;
}

/** The task of a form item: a verb table keeps `verb (meaning) · person`; any other table gets its title, the column label and the cell. */
export function formTask(item: FormItem, table: TableBlock | undefined, pick: Pick, fallbackHint: string): FormTask {
  const s = t().levelTest;
  if (!table || isPersonTable(table)) {
    const headerCell = table ? table.header.find((h) => h.es === item.verb) : undefined;
    const localized = headerCell ? pick(headerCell) : undefined;
    const verbLabel = localized && localized !== item.verb ? `${item.verb} (${localized})` : item.verb;
    return { prompt: `${verbLabel} · ${item.person}`, hint: table ? s.formVerbHint : fallbackHint };
  }
  const ci = askedColumn(table, item.verb);
  const asked = ci >= 0 ? pick(table.header[ci]) : item.verb;
  return {
    prompt: item.person,
    hint: s.formColumnHint(lowerFirst(asked)),
    heading: pick(table.title),
    label: pick(table.header[0]),
  };
}

/** The nearest text or tip block before the table, or undefined. */
export function ruleBefore(body: LessonBlock[], table: TableBlock, pick: Pick): string | undefined {
  for (let i = body.indexOf(table) - 1; i >= 0; i--) {
    const b = body[i];
    if (b.kind === 'text' || b.kind === 'tip') return pick(b.text);
  }
  return undefined;
}

/** The result data of a form item. */
export function formDetail(item: FormItem, table: TableBlock | undefined, body: LessonBlock[], pick: Pick): QuestionDetail {
  if (!table) return {};
  const detail: QuestionDetail = { rule: ruleBefore(body, table, pick) };
  const ci = askedColumn(table, item.verb);
  const ri = table.rows.findIndex((r) => r[0] === item.person);
  const title = pick(table.title);
  if (ri >= 0 && ci >= 0) {
    detail.table = isPersonTable(table)
      ? {
          title,
          header: [pick(table.header[0]), pick(table.header[ci])],
          rows: table.rows.map((r) => [r[0], r[ci]]),
          hl: { row: ri, col: 1 },
        }
      : { title, header: table.header.map((h) => pick(h)), rows: [table.rows[ri]], hl: { row: 0, col: ci } };
  }
  const wrong = new Map<string, string>();
  for (const [typed, texts] of Object.entries(item.wrong ?? {})) {
    const text = pick(texts);
    if (text) wrong.set(normTyped(typed), text);
  }
  detail.explainTyped = (typed) => {
    const key = normTyped(typed);
    if (key === '') return null;
    const own = wrong.get(key);
    if (own) return own;
    // what was typed is another cell of the same table: say which form it is
    for (const row of table.rows) {
      for (let c = 1; c < row.length; c++) {
        if (normTyped(row[c]) === key && normTyped(row[c]) !== normTyped(item.answer)) {
          return t().levelTest.otherForm(`${row[0]} · ${pick(table.header[c])}`);
        }
      }
    }
    return null;
  };
  return detail;
}

/** The translation to show, none when it only repeats the sentence (or the line already shown). */
export function trText(tr: Lang4 | undefined, pick: Pick, ...same: (string | undefined)[]): string | undefined {
  if (!tr) return undefined;
  const text = pick(tr);
  if (!text) return undefined;
  const key = normTyped(text);
  return same.some((x) => x !== undefined && normTyped(x) === key) ? undefined : text;
}

/** The wrong options of a choice item with their texts, in the shown order. */
export function whyNotOf(options: string[], correctIndex: number, textOf: (option: string, index: number) => string | undefined) {
  const out: { option: string; text: string }[] = [];
  options.forEach((option, i) => {
    if (i === correctIndex) return;
    const text = textOf(option, i);
    if (text) out.push({ option, text });
  });
  return out.length > 0 ? out : undefined;
}

/** The sentence cut at the n-th occurrence of `word` (mark items), or null if it is not there. */
export function splitAtWord(sentence: string, word: string, nth = 0): { before: string; word: string; after: string } | null {
  let from = -1;
  for (let k = 0; k <= nth; k++) {
    from = sentence.indexOf(word, from + 1);
    if (from < 0) return null;
  }
  return { before: sentence.slice(0, from), word, after: sentence.slice(from + word.length) };
}

export interface DiffWord {
  w: string;
  diff: boolean;
}

const bare = (w: string) => w.toLowerCase().replace(/^[.,;:!?¿¡"«»(]+|[.,;:!?¿¡"«»)]+$/g, '');

/** Marks the words of two answers that differ (same position when they have as many words, else the words the other lacks). */
export function diffWords(typed: string, right: string): { typed: DiffWord[]; right: DiffWord[] } {
  const a = typed.split(/\s+/).filter(Boolean);
  const b = right.split(/\s+/).filter(Boolean);
  if (a.length === b.length) {
    return {
      typed: a.map((w, i) => ({ w, diff: bare(w) !== bare(b[i]) })),
      right: b.map((w, i) => ({ w, diff: bare(w) !== bare(a[i]) })),
    };
  }
  const ina = new Set(a.map(bare));
  const inb = new Set(b.map(bare));
  return { typed: a.map((w) => ({ w, diff: !inb.has(bare(w)) })), right: b.map((w) => ({ w, diff: !ina.has(bare(w)) })) };
}
