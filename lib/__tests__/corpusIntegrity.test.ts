// Guards the two invariants the 2026-08-07 cleanup established for the Spanish
// word corpus. Both used to be broken and both are silent in the UI, so they are
// checked here rather than trusted: an id collision makes one card render another
// card's word, a same-meaning duplicate makes you relearn a known word from zero.

import { readFileSync } from 'fs';
import { join } from 'path';

import { LEVELS, type Level, type WordEntry } from '@/data/words';
import { openWords } from '@/data/openWords';
import { pickSurvivor } from '../cardMerge';
import { findPromptOverlaps, type PromptLang } from '../promptOverlap';

// Play-vágás: the en word-branch loader path
// (getWordsForLevel(level, 'en')) is gone, so the cases below that guard
// the actual en corpus content read these JSON files straight off disk
// instead, the same way `svCorpus.test.ts` reads the Swedish track.
// A spanyol szólista (a0..c2.json) és a hu sáv kikerült, a
// spanyol oldal forrása a data/openWords.ts (words-open), a hu sáv őrei törölve. A words-open
// teljességét és prompt-szabályait (hint-es többjelentés, mondat nélküli névmás/névelő kártyák)
// a scripts/words-open-check.mjs kapu őrzi, ezért a spanyol sáv teljesség-, prompt- és
// headword-szivárgás esetei itt nem futnak.
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

describe('pickSurvivor', () => {
  const card = (reps: number, stability: number, due: string) => ({ reps, stability, due });

  it('keeps the more practised card', () => {
    const strong = card(7, 1, '2026-09-01');
    expect(pickSurvivor(card(2, 9, '2026-08-01'), strong)).toBe(strong);
  });

  it('breaks a reps tie on stability', () => {
    const stable = card(3, 12, '2026-09-01');
    expect(pickSurvivor(stable, card(3, 4, '2026-08-01'))).toBe(stable);
  });

  it('falls back to the earlier due date, so a review cannot slip', () => {
    const soon = card(3, 5, '2026-08-01');
    expect(pickSurvivor(card(3, 5, '2026-08-20'), soon)).toBe(soon);
  });
});

// User feedback (word:the post office): „ennek van névelője angolba ott a
// the spanyolba nincs el vagy la? ez hiba? ne legyen ott a the ha nincs el la".
// A `correos` a spanyol oldalon névelő nélkül állt, a natív oldalon viszont
// névelővel, ezért a kártya két fele ellentmondott egymásnak. Ez az őr azt tartja
// fenn, hogy ha a tanult alak nem hoz névelőt, a natív prompt se hozzon.
describe('article agreement between the two sides of a card', () => {
  const ES_ARTICLE = /^(el|la|los|las|un|una|unos|unas)[\s/]/i;
  const EN_ARTICLE = /^(the|a|an)\s/i;

  it('never shows an English article for a Spanish form that has none', () => {
    const offenders = openWords
      .filter((w) => w.pos !== 'verb')
      .filter((w) => EN_ARTICLE.test(w.en ?? '') && !ES_ARTICLE.test(w.es ?? ''))
      // `un/una` maga a névelő-kártya, ott a prompt "a / an" a helyes tartalom.
      .filter((w) => !/^un\/una$/i.test(w.es ?? ''))
      .map((w) => `${w.id} ${w.es} = ${w.en}`);
    expect(offenders).toEqual([]);
  });
});

// Issue #3, 4. szakasz: „`data/words.ts:14` declares es, hu, en, de and the
// sentence_* fields as required, but every word file is cast with
// `as WordEntry[]`. A Swedish entry missing es/hu type-checks and then breaks at
// runtime." A cast nem szüntethető meg, ezért a típus ígéretét itt tartjuk meg.
// A mai korpusz (en-ág) teljesíti; egy új
// nyelvi sáv ugyanezt vállalja, vagy ez a teszt megmondja, hogy nem.
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

// "Egy szinten és sávon belül két szónak nem lehet olyan
// promptja, amelyből nem dönthető el, melyik a kérdezett." A 9.4 szerint a
// korpusz-menet (2026-09-14/15) után ez az őr ÉLES: új szó nem hozhatja
// vissza a hibát. A fürt-logika a lib/promptOverlap.ts-ben él. Az en sáv (Play-vágás óta a JSON-ból, nem a
// betöltőből) csak azokra a szintekre ad szavakat, amik tényleg léteznek;
// a hiányzó szintre üres lista jön, amin a fürt-keresés triviálisan üres.
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
