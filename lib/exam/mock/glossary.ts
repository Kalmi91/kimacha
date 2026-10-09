// PLAN-vizsga E. szakasz (Kálmán E5 c): a próbavizsga a szint szavaiból áll, az ismeretlen
// szóhoz szójegyzet jár: a feladat alatt a még nem tanult szavak jelentése (a felület
// koppintásra nyitja). Tiszta modul: a hívó adja a szint tételeit és a tanult tételek id-it.
//
// A felolvasott (hallás) szöveg nem látszik, ezért ahhoz nincs szójegyzet: az a hallott
// mondat jelentését adná ki.

import type { PcicItem } from '@/data/pcic';
import { sentenceWords } from './build';
import type { MockTarget, MockTask } from './types';

export interface GlossaryEntry {
  itemId: string;
  /** A szó a szövegben (a tétel célnyelvi alakja). */
  term: string;
  /** A jelentése a kiinduló nyelven. */
  meaning: string;
}

interface GlossaryIndex {
  singles: Map<string, { item: PcicItem; form: string }>;
  phrases: { words: string; item: PcicItem; form: string }[];
  target: MockTarget;
}

const ARTICLE: Record<MockTarget, RegExp> = {
  es: /^(el|la|los|las|un|una)\s+/i,
  en: /^(to|the|a|an)\s+/i,
};

/** Az index a szint tételeiből: egy szavas alakok szó szerint, többszavasak kifejezésként. */
export function buildGlossaryIndex(items: PcicItem[], target: MockTarget): GlossaryIndex {
  const singles: GlossaryIndex['singles'] = new Map();
  const phrases: GlossaryIndex['phrases'] = [];
  for (const item of items) {
    const raw = target === 'es' ? item.es : item.en;
    for (const alt of raw.split(' / ')) {
      const form = alt.replace(/\(.*?\)/g, '').trim().replace(ARTICLE[target], '').trim().toLowerCase();
      const words = sentenceWords(form);
      if (words.length === 0) continue;
      if (words.length === 1) {
        if (words[0].length > 1 && !singles.has(words[0])) singles.set(words[0], { item, form: words[0] });
      } else {
        phrases.push({ words: words.join(' '), item, form });
      }
    }
  }
  return { singles, phrases, target };
}

/** A feladat KÉPERNYŐN látszó célnyelvi szövegei (a felolvasott sorok és az utasítás nem: az utasításhoz a felület kiinduló nyelvi fordítást ad). */
export function mockTaskTexts(task: MockTask): string[] {
  switch (task.kind) {
    case 'read_mc':
      return task.passages.map((p) => p.text);
    case 'match':
      return task.prompts.map((p) => p.text);
    case 'true_false':
      return [task.text];
    case 'gap_mc':
      return task.gaps.flatMap((g) => [g.text.replace('___', ' '), ...g.options]);
    case 'gap_type':
      // A lyukas mondat látszik (a hiányzó szó nem); a felolvasott sorok nem.
      return task.gaps.map((g) => g.text.replace('___', ' '));
    case 'dictation':
    case 'listen_mc':
    case 'listen_dialogue':
    case 'listen_match':
      return [];
    case 'form_fill':
      return [task.context, ...task.fields.map((f) => f.label)];
    case 'short_message':
      return [task.prompt];
  }
}

/** A feladat szövegeiben szereplő, még NEM tanult szint-szavak jelentése, a megjelenés sorrendjében. */
export function mockGlossary(task: MockTask, index: GlossaryIndex, learned: ReadonlySet<string>): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  const seen = new Set<string>();
  const push = (item: PcicItem, form: string) => {
    if (learned.has(item.id) || seen.has(item.id)) return;
    const meaning = (index.target === 'es' ? item.en : item.es).split(' / ')[0].trim();
    if (!meaning) return;
    seen.add(item.id);
    out.push({ itemId: item.id, term: form, meaning });
  };
  for (const text of mockTaskTexts(task)) {
    const words = sentenceWords(text).map((w) => w.toLowerCase());
    for (const w of words) {
      const hit = index.singles.get(w);
      if (hit) push(hit.item, hit.form);
    }
    const padded = ` ${words.join(' ')} `;
    for (const p of index.phrases) {
      if (padded.includes(` ${p.words} `)) push(p.item, p.form);
    }
  }
  return out;
}
