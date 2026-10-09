// The practice exam is made of the level's words, and an unknown word gets a glossary
// entry: under the task, the meanings of the words not yet learned (the UI opens it on
// tap). Pure module: the caller supplies the level's items and the ids of the learned items.
//
// The read-aloud (listening) text is not shown, so it has no glossary: that would
// give away the meaning of the sentence that was heard.

import type { PcicItem } from '@/data/pcic';
import { sentenceWords } from './build';
import type { MockTarget, MockTask } from './types';

export interface GlossaryEntry {
  itemId: string;
  /** The word in the text (the item's target-language form). */
  term: string;
  /** Its meaning in the source language. */
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

/** The index of the level's items: single-word forms verbatim, multi-word ones as phrases. */
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

/** The target-language texts of the task that are visible ON SCREEN (not the read-aloud lines, nor the instruction: for the instruction the UI gives a source-language translation). */
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
      // The gap sentence is visible (the missing word is not); the read-aloud lines are not.
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

/** Meanings of the level words that appear in the task's texts and are NOT learned yet, in order of appearance. */
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
