// FB724: the words the practice tasks show, so the lesson page can list the ones its worked examples do not cover.
import { normalizeWordToken } from '@/data/words';

// Only the fields read here; the lesson's item union is wider (and schema-1 lessons only have gap/mark items).
interface LooseItem {
  kind?: string;
  sentence?: string;
  options?: unknown[];
  correct?: number;
  examples?: string[];
  pairs?: Record<string, string>[];
  verb?: string;
  person?: string;
  answer?: string;
  answers?: string[];
  prompt?: Record<string, string>;
  es?: string;
  wrongIndex?: number;
  correctIndex?: number;
  text?: string;
  bank?: string[];
  base?: string;
}

interface LessonLike {
  items: readonly object[];
}

export interface ExerciseWord {
  key: string;
  display: string;
}

const items = (lesson: LessonLike): LooseItem[] => lesson.items as LooseItem[];

/** The sentences the lesson page shows as worked examples (the same 3 as app/grammar/[topic].tsx). */
export function workedSentences(lesson: LessonLike): string[] {
  return items(lesson)
    .filter((item) => item.kind === undefined || item.kind === 'gap')
    .slice(0, 3)
    .map((item) => (item.sentence ?? '').replace('___', String((item.options ?? [])[item.correct ?? 0] ?? '')));
}

const withoutIndex = (es: string, index: number | undefined): string =>
  es
    .split(' ')
    .filter((_, i) => i !== index)
    .join(' ');

const isSingleToken = (s: string | undefined): s is string => !!s && s.trim().length > 0 && !/\s/.test(s.trim());

/** The learned-language texts the tasks show. */
export function exerciseTexts(lesson: LessonLike, learnedLang: string): string[] {
  const out: string[] = [];
  const add = (v: string | undefined | null) => {
    if (typeof v === 'string' && v) out.push(v);
  };
  for (const item of items(lesson)) {
    switch (item.kind) {
      case undefined:
      case 'gap':
        add(item.sentence);
        add(String((item.options ?? [])[item.correct ?? 0] ?? ''));
        (item.examples ?? []).forEach(add);
        break;
      case 'mark':
        add(item.sentence);
        (item.examples ?? []).forEach(add);
        break;
      case 'match':
        for (const pair of item.pairs ?? []) add(pair[learnedLang] ?? pair.es);
        break;
      case 'form':
        add(item.answer);
        if (isSingleToken(item.verb)) add(item.verb);
        if (isSingleToken(item.person)) add(item.person);
        break;
      case 'why':
        add(item.es);
        break;
      case 'transform':
        add(item.prompt?.[learnedLang]);
        add(item.answer);
        break;
      case 'spot': {
        add(withoutIndex(item.es ?? '', item.wrongIndex));
        const fix = (item.options ?? [])[item.correctIndex ?? 0];
        if (typeof fix === 'string' && fix) add(fix);
        break;
      }
      case 'fix':
        add(withoutIndex(item.es ?? '', item.wrongIndex));
        add(item.answer);
        break;
      case 'order':
      case 'dictation':
      case 'write':
        add(item.es);
        break;
      case 'opencloze':
        add(item.text);
        (item.answers ?? []).forEach(add);
        break;
      case 'bank':
        (item.bank ?? []).forEach(add);
        add(item.es);
        add(item.answer);
        break;
      case 'noun':
        add(item.base);
        add(item.answer);
        break;
      default:
        break;
    }
  }
  return out;
}

const EDGE_PUNCT = /^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_]+$/gu;

/** Surface forms of a text: «...» hints removed, split on whitespace and "/", edge punctuation stripped. */
function surfaces(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.replace(/«[^»]*»/g, ' ').split(/[\s/]+/)) {
    if (!piece || piece.includes('_')) continue;
    const surface = piece.replace(EDGE_PUNCT, '');
    if (!surface || surface.startsWith('-') || piece.startsWith('-')) continue;
    out.push(surface);
  }
  return out;
}

function tokens(text: string): { key: string; surface: string }[] {
  const out: { key: string; surface: string }[] = [];
  for (const surface of surfaces(text)) {
    const key = normalizeWordToken(surface);
    if (key && /\p{L}/u.test(key)) out.push({ key, surface });
  }
  return out;
}

/** The words of the tasks that are not in `shownTexts`, one per normalized key, sorted. */
export function exerciseWords(lesson: LessonLike, learnedLang: string, shownTexts: string[]): ExerciseWord[] {
  const shown = new Set(shownTexts.flatMap((t) => tokens(t).map((x) => x.key)));
  const seen = new Map<string, string[]>();
  for (const text of exerciseTexts(lesson, learnedLang)) {
    for (const { key, surface } of tokens(text)) {
      if (shown.has(key)) continue;
      const list = seen.get(key);
      if (list) list.push(surface);
      else seen.set(key, [surface]);
    }
  }
  const result: ExerciseWord[] = [];
  for (const [key, forms] of seen) {
    const allUpper = forms.every((f) => f.charAt(0) !== f.charAt(0).toLowerCase());
    result.push({ key, display: allUpper ? forms[0] : forms[0].toLowerCase() });
  }
  return result.sort((a, b) => a.display.localeCompare(b.display, learnedLang, { sensitivity: 'base' }));
}
