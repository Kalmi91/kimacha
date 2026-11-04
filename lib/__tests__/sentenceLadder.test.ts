// The ladder of the Sentences tab (lib/sentenceLadder.ts, FB569/FB570): where a sentence stands is saved per pair, survives
// a restart and a backup, a learned sentence never comes back (every pair, level and focus), the rung a sentence plays is
// on its queue entry, and a finished round's sentences stay out of the next round only while they are on the same rung.

import type { PcicItem, PcicLevel, PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { setActiveSource } from '@/lib/languagePair';
import {
  LADDER_KEY,
  LAST_RUNG,
  PlayedRounds,
  clearLadderKeys,
  ladderKeysOfLevel,
  loadLadder,
  saveStage,
  stageAfter,
  stillOnPlayedRung,
  type Ladder,
  type LadderStage,
  type Rung,
} from '@/lib/sentenceLadder';
import { buildSentenceQueue, sentenceKey, type SentenceEntry } from '@/lib/sentenceTab';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

describe('stageAfter', () => {
  it('rung 1 -> 2 -> 3 -> learned', () => {
    expect(LAST_RUNG).toBe(3);
    expect(stageAfter(1)).toBe(2);
    expect(stageAfter(2)).toBe(3);
    expect(stageAfter(3)).toBe('learned');
  });
});

describe('the saved ladder (game_progress, key sentence-ladder)', () => {
  beforeEach(async () => {
    await getDb().resetGameProgress(LADDER_KEY);
  });

  it('nothing saved: an empty ladder (every sentence is fresh, on rung 1)', async () => {
    expect((await loadLadder(getDb())).size).toBe(0);
  });

  it('a sentence is saved by its key and read back: the rung it plays next, or learned', async () => {
    const db = getDb();
    await saveStage(db, 'frase uno.', 2);
    await saveStage(db, 'frase dos.', 3);
    await saveStage(db, 'frase tres.', 'learned');
    const ladder = await loadLadder(db);
    expect([...ladder]).toEqual([['frase uno.', 2], ['frase dos.', 3], ['frase tres.', 'learned']]);
    await saveStage(db, 'frase uno.', 3); // moving up replaces the row
    expect((await loadLadder(db)).get('frase uno.')).toBe(3);
    expect((await loadLadder(db)).size).toBe(3);
  });

  it('lives in its own game key: the other game rows are not read as stages, and a row that is no stage is skipped', async () => {
    const db = getDb();
    await db.setGameProgress('grammar-course', 'ser-estar', 'done', { correct: 1, total: 1 });
    await db.setGameProgress(LADDER_KEY, 'frase uno.', 'rung2');
    await db.setGameProgress(LADDER_KEY, 'frase rota.', 'rung9');
    await db.setGameProgress(LADDER_KEY, 'frase vacia.', '');
    expect([...(await loadLadder(db))]).toEqual([['frase uno.', 2]]);
    await db.resetGameProgress('grammar-course');
  });

  it('is kept per language pair: another pair has its own ladder', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await saveStage(db, 'frase uno.', 3);
    await db.setOnboarding('hu', 'es');
    expect((await loadLadder(db)).size).toBe(0);
    await saveStage(db, 'frase uno.', 2);
    expect((await loadLadder(db)).get('frase uno.')).toBe(2);
    await db.setOnboarding('en', 'es');
    expect((await loadLadder(db)).get('frase uno.')).toBe(3);
    await db.setOnboarding('hu', 'es');
    await db.resetGameProgress(LADDER_KEY);
    await db.setOnboarding('en', 'es');
  });

  it('it travels with the backup: restored after the state was wrecked', async () => {
    const db = getDb();
    await saveStage(db, 'frase uno.', 3);
    await saveStage(db, 'frase dos.', 'learned');
    const payload = await db.exportAll();
    expect(payload.tables.game_progress.filter((r: { game_id: string }) => r.game_id === LADDER_KEY)).toHaveLength(2);
    await db.resetGameProgress(LADDER_KEY);
    expect((await loadLadder(db)).size).toBe(0);
    await db.importAll(JSON.parse(JSON.stringify(payload)));
    expect([...(await loadLadder(db))]).toEqual([['frase uno.', 3], ['frase dos.', 'learned']]);
  });
});

describe('stillOnPlayedRung', () => {
  const played = new Map<string, Rung>([['a', 1], ['b', 2], ['c', 3], ['d', 1], ['e', 2]]);
  const ladder: Ladder = new Map<string, LadderStage>([['a', 2], ['b', 2], ['c', 'learned'], ['e', 3]]);

  it('left out of the next round while still on the rung it played; a sentence that moved up may come', () => {
    // a: played 1, now 2 (moved up); b: played 2, still 2 (missed); c: learned; d: played 1, no row = still 1; e: played 2, now 3
    expect([...stillOnPlayedRung(played, ladder)]).toEqual(['b', 'd']);
  });

  it('nothing played yet: nothing is left out', () => {
    expect(stillOnPlayedRung(new Map(), ladder).size).toBe(0);
  });
});

// Every pair: one learned word per target language with a sentence made of that word.
const WORDS: Record<PcicTarget, { word: string; sentence: string }> = {
  es: { word: 'libro', sentence: 'Libro.' },
  en: { word: 'book', sentence: 'Book.' },
  hu: { word: 'könyv', sentence: 'Könyv.' },
  de: { word: 'Buch', sentence: 'Buch.' },
};
const learned = (id: string): Sm2Card => ({
  ...sm2NewCard(id), state: 'review', interval: 3, reps: 2, due: '2026-10-20', lastReview: '2026-10-09', introducedAt: '2026-10-09',
});

describe.each(['es', 'en', 'hu', 'de'] as const)('buildSentenceQueue with the ladder, target %s', (target) => {
  const w = WORDS[target];
  beforeEach(() => setActiveSource(target === 'en' ? 'es' : 'en'));
  afterEach(() => setActiveSource(null));

  // The learned word's own example sentence in every language (the prompt side is the same text, only the target is checked).
  const single: PcicItem = {
    id: 'a1-l1', es: 'libro', en: 'book', hu: 'könyv', de: 'Buch', kind: 'word', section: 'Test', order: 1,
    exampleEs: w.sentence, exampleEn: w.sentence, exampleHu: w.sentence, exampleDe: w.sentence,
  };
  const base = { target, cards: [learned(single.id)], items: [single], findItem: (id: string) => (id === single.id ? single : undefined), today: '2026-10-12' } as const;

  it('a fresh sentence is offered on rung 1 (no rung on the entry)', () => {
    const q = buildSentenceQueue(base);
    expect(q).toHaveLength(1);
    expect(q[0].rung).toBeUndefined();
  });

  it('the rung it plays next is on the entry; a learned sentence is left out for good', () => {
    const key = sentenceKey({ target: buildSentenceQueue(base)[0].target });
    expect(buildSentenceQueue({ ...base, ladder: new Map<string, LadderStage>([[key, 2]]) })[0].rung).toBe(2);
    expect(buildSentenceQueue({ ...base, ladder: new Map<string, LadderStage>([[key, 3]]) })[0].rung).toBe(3);
    expect(buildSentenceQueue({ ...base, ladder: new Map<string, LadderStage>([[key, 1]]) })[0].rung).toBeUndefined();
    const learnedLadder = new Map<string, LadderStage>([[key, 'learned']]);
    expect(buildSentenceQueue({ ...base, ladder: learnedLadder })).toEqual([]);
    // whatever the focus says: the word of a learned sentence in focus does not bring it back
    expect(buildSentenceQueue({ ...base, ladder: learnedLadder, focus: new Set([single.id]) })).toEqual([]);
    // a sentence of another key is not touched by it
    expect(buildSentenceQueue({ ...base, ladder: new Map<string, LadderStage>([['another sentence.', 'learned']]) })).toHaveLength(1);
  });
});

// Resetting a level (Settings): the ladder rows of that level's sentences go, the other levels' rows stay.
describe('a level reset clears its sentences from the ladder', () => {
  const mk = (id: string, exampleEs: string): PcicItem => ({ id, es: 'x', en: 'x', hu: 'x', de: 'x', kind: 'word', section: 'Test', order: 1, exampleEs, exampleEn: exampleEs, exampleHu: exampleEs, exampleDe: exampleEs });
  const LEVELS: Record<string, PcicItem[]> = {
    A1: [mk('a1-1', 'Frase uno.'), mk('a1-2', 'Frase compartida.')],
    A2: [mk('a2-1', 'Frase dos.'), mk('a2-2', 'frase compartida. ')],
    B1: [mk('b1-1', 'Frase tres.'), { ...mk('b1-2', 'x'), exampleEs: undefined }],
  };
  const itemsFor = (level: PcicLevel) => LEVELS[level] ?? [];
  const ALL = ['A1', 'A2', 'B1'] as PcicLevel[];

  it('the keys of the sentences of the level, except one that an item of another level has too; an item with no sentence has none', () => {
    expect([...ladderKeysOfLevel('A1', ALL, itemsFor, 'es')]).toEqual(['frase uno.']);
    expect([...ladderKeysOfLevel('A2', ALL, itemsFor, 'es')]).toEqual(['frase dos.']);
    expect([...ladderKeysOfLevel('B1', ALL, itemsFor, 'es')]).toEqual(['frase tres.']);
    // with only the one level asked about, the shared sentence is its own
    expect([...ladderKeysOfLevel('A1', ['A1'], itemsFor, 'es')].sort()).toEqual(['frase compartida.', 'frase uno.']);
  });

  it('clearLadderKeys drops those rows (learned or half way) and keeps every other row, its stage and its data', async () => {
    const db = getDb();
    await db.resetGameProgress(LADDER_KEY);
    await saveStage(db, 'frase uno.', 'learned');
    await saveStage(db, 'frase dos.', 3);
    await saveStage(db, 'frase tres.', 2);
    await db.setGameProgress(LADDER_KEY, 'frase cuatro.', 'rung2', { note: 1 });
    await clearLadderKeys(db, new Set(['frase uno.', 'frase tres.']));
    const left = await loadLadder(db);
    expect([...left].sort()).toEqual([['frase cuatro.', 2], ['frase dos.', 3]]);
    expect((await db.getGameProgress(LADDER_KEY)).find((r) => r.itemId === 'frase cuatro.')?.data).toEqual({ note: 1 });
    // nothing to clear: the rows are left untouched
    await clearLadderKeys(db, new Set(['frase nueve.']));
    await clearLadderKeys(db, new Set());
    expect((await loadLadder(db)).size).toBe(2);
    await db.resetGameProgress(LADDER_KEY);
  });
});

describe('PlayedRounds: what the finished rounds of a day keep out of the next ones', () => {
  const sentence = (target: string, rung?: 2 | 3): SentenceEntry => ({ itemId: target, source: 's', target, wordCount: 1, wordIds: [], due: false, dueIds: [], staleness: '', slots: [], ...(rung ? { rung } : {}) });

  it('notes the sentence with the rung it played; a new day empties it, the same day does not', () => {
    const played = new PlayedRounds();
    played.forDay('2026-11-03').note([sentence('Uno.'), sentence('Dos.', 3)]);
    expect([...played.forDay('2026-11-03').rungs]).toEqual([['uno.', 1], ['dos.', 3]]);
    expect(played.forDay('2026-11-04').rungs.size).toBe(0);
    played.note([sentence('Tres.', 2)]);
    expect([...played.forDay('2026-11-04').rungs]).toEqual([['tres.', 2]]);
  });

  it('a mistake sentence is kept apart: it never hides a corpus sentence with the same text; a word card without a sentence has no key', () => {
    const played = new PlayedRounds().forDay('2026-11-03');
    const mistake: SentenceEntry = { ...sentence('El gato.'), mistake: { wrong: 'gato el' } };
    const cardOnly: SentenceEntry = { ...sentence(''), newWord: true };
    played.note([mistake, cardOnly, sentence('El perro.')]);
    expect([...played.rungs.keys()]).toEqual(['el perro.']);
    expect([...played.mistakes]).toEqual(['el gato.']); // still skipped when the next mistake sentence is picked
    expect([...stillOnPlayedRung(played.rungs, new Map())]).toEqual(['el perro.']); // the corpus sentence "El gato." is not left out
    expect([...played.forDay('2026-11-04').mistakes]).toEqual([]);
  });
});
