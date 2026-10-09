// Guards the two invariants the 2026-08-07 cleanup established for the Spanish
// word corpus. Both used to be broken and both are silent in the UI, so they are
// checked here rather than trusted: an id collision makes one card render another
// card's word, a same-meaning duplicate makes you relearn a known word from zero.

import { readFileSync } from 'fs';
import { join } from 'path';

import { LEVELS, type Level, type WordEntry } from '@/data/words';
import { openWords } from '@/data/openWords';
import { findPromptOverlaps, type PromptLang } from '../promptOverlap';

// Play cut: the en word-branch loader path
// (getWordsForLevel(level, 'en')) is gone, so the cases below that guard
// the actual en corpus content read these JSON files straight off disk
// instead.
// The Spanish word list (a0..c2.json) and the hu band were removed; the
// source of the Spanish side is data/openWords.ts (words-open), and the guards of the hu band were deleted. The completeness
// and prompt rules of words-open (multi-meaning cards with a hint, pronoun/article cards without a sentence)
// are guarded by the scripts/words-open-check.mjs gate, so the completeness, prompt and
// headword-leak cases of the Spanish band do not run here.
function branchLevel(lang: string, level: string): WordEntry[] {
  return JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'words', lang, `${level}.json`), 'utf8'));
}

const EN_BRANCH_BY_LEVEL: Partial<Record<Level, WordEntry[]>> = {
  A0: branchLevel('en', 'a0'),
  A1: branchLevel('en', 'a1'),
  A2: branchLevel('en', 'a2'),
  B1: branchLevel('en', 'b1'),
};

const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const norm = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(the|an|a|az)\s+/, '')
    .replace(/^(el|la|los|las)\s+/, '')
    .replace(/[.\s]+$/, '');

const senses = (value: unknown): Set<string> =>
  new Set(
    String(value ?? '')
      .split(/[/,]/)
      .map(norm)
      .filter(Boolean)
  );

const sharesMeaning = (a: any, b: any): boolean =>
  ['en', 'hu'].some((field) => {
    const left = senses(a[field]);
    for (const sense of senses(b[field])) if (left.has(sense)) return true;
    return false;
  });

describe('Spanish word corpus (words-open)', () => {
  it('gives every word a globally unique id', () => {
    const seen = new Map<number, string>();
    const collisions: string[] = [];
    for (const word of openWords) {
      const owner = seen.get(word.id);
      if (owner) collisions.push(`${word.id}: ${owner} vs ${word.level} ${word.es}`);
      else seen.set(word.id, `${word.level} ${word.es}`);
    }
    expect(collisions).toEqual([]);
  });

  it('teaches a headword+meaning on one level only', () => {
    const first = new Map<string, any>();
    const duplicates: string[] = [];
    for (const word of [...openWords].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))) {
      const earlier = first.get(word.es);
      if (!earlier) first.set(word.es, word);
      else if (sharesMeaning(earlier, word)) {
        duplicates.push(`${word.es}: ${earlier.level} ${earlier.id} vs ${word.level} ${word.id}`);
      }
    }
    expect(duplicates).toEqual([]);
  });
});

// User feedback (word:the post office): "in English it has an article, the,
// but in Spanish there is no el or la? is this a mistake? there should be no the if there is no el la".
// `correos` had no article on the Spanish side but had one on the native side,
// so the two halves of the card contradicted each other. This guard makes sure
// that if the learned form carries no article, the native prompt does not either.
describe('article agreement between the two sides of a card', () => {
  const ES_ARTICLE = /^(el|la|los|las|un|una|unos|unas)[\s/]/i;
  const EN_ARTICLE = /^(the|a|an)\s/i;

  it('never shows an English article for a Spanish form that has none', () => {
    const offenders = openWords
      .filter((w) => w.pos !== 'verb')
      .filter((w) => EN_ARTICLE.test(w.en ?? '') && !ES_ARTICLE.test(w.es ?? ''))
      // `un/una` is itself the article card, so the prompt "a / an" is the correct content there.
      .filter((w) => !/^un\/una$/i.test(w.es ?? ''))
      .map((w) => `${w.id} ${w.es} = ${w.en}`);
    expect(offenders).toEqual([]);
  });
});

// Issue #3, section 4: "`data/words.ts:14` declares es, hu, en, de and the
// sentence_* fields as required, but every word file is cast with
// `as WordEntry[]`. A Swedish entry missing es/hu type-checks and then breaks at
// runtime." The cast cannot be removed, so the type's promise is kept here.
// Today's corpus (the en band) fulfils it; a new
// language band must do the same, or this test will say that it does not.
describe('word entry completeness', () => {
  const SURFACE_LANGS = ['es', 'hu', 'en', 'de'] as const;

  const corpora: [string, WordEntry[]][] = [
    ['en branch', Object.values(EN_BRANCH_BY_LEVEL).flat()],
  ];

  it.each(corpora)('every %s entry carries all four languages and sentences', (_label, entries) => {
    expect(entries.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const w of entries) {
      for (const lang of SURFACE_LANGS) {
        if (!String(w[lang] ?? '').trim()) offenders.push(`${w.id}: missing ${lang}`);
        if (!String(w[`sentence_${lang}`] ?? '').trim()) offenders.push(`${w.id}: missing sentence_${lang}`);
      }
    }
    expect(offenders.slice(0, 20)).toEqual([]);
  });
});

// "Within one level and band, no two words may have prompts from which it
// cannot be told which one is being asked." After the corpus pass (2026-09-14/15)
// this guard is LIVE: a new word must not bring the error back. The cluster logic
// lives in lib/promptOverlap.ts. The en band (read from the JSON since the Play cut, not from the
// loader) yields words only for the levels that really exist;
// a missing level gives an empty list, on which the cluster search is trivially empty.
describe('prompt policy (PROMPT-POLICY 1)', () => {
  const BANDS: { label: string; wordsByLevel: (level: Level) => WordEntry[]; headword: PromptLang; prompt: PromptLang }[] = [
    { label: 'en', wordsByLevel: (level) => EN_BRANCH_BY_LEVEL[level] ?? [], headword: 'en', prompt: 'hu' },
  ];

  it.each(BANDS)('never gives two words of a level an ambiguous $label prompt', ({ wordsByLevel, headword, prompt }) => {
    const offenders: string[] = [];
    for (const level of LEVELS) {
      const levelWords = wordsByLevel(level);
      const clusters = findPromptOverlaps(
        levelWords.map((w) => ({ id: w.id, headword: String(w[headword] ?? ''), prompt: String(w[prompt] ?? '') })),
        prompt
      );
      for (const cluster of clusters) {
        const ids = cluster.words.map((w) => `${w.id}:${w.prompt}`).join(', ');
        offenders.push(`${level} [${cluster.kind}${cluster.sense ? `: ${cluster.sense}` : ''}] ${ids}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
