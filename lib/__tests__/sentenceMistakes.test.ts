// The Sentences tab's mistake step (lib/sentenceMistakes.ts, BRIEF-B2): which sentence of the mistake list is offered, how it
// goes into the round, its decoys, and that it is graded by the mistake deck's own step (lib/mistakes/grade.ts).

import { getDb } from '@/lib/database';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import { validateMistakesPayload, type MistakesBatch } from '@/lib/mistakes/format';
import { chooseMistakeCard, mistakeEntry, mistakeTrapWords, pickMistakeEntry, recordMistakeBuild, withMistakeStep } from '../sentenceMistakes';
import { sm2NewCard, sm2Review, type Sm2Card } from '../sm2';
import { sentenceKey, type SentenceEntry } from '../sentenceTab';

const checked = validateMistakesPayload(sample);
if (!checked.ok) throw new Error(checked.error);
const BATCH: MistakesBatch = checked.batch;
const S1 = `${BATCH.batchId}:s:s1`; // "I don't have tomato." / "No tengo tomate." / wrong "Pero no tienes tomate."
const S2 = `${BATCH.batchId}:s:s2`; // "That's fine." / "Eso está bien."
const TODAY = '2026-10-21';

const card = (itemId: string, over: Partial<Sm2Card> = {}): Sm2Card => ({ ...sm2NewCard(itemId), ...over });
const key = (es: string) => sentenceKey({ target: es });

describe('chooseMistakeCard', () => {
  it('nothing seen yet: the first sentence in file order; the doubtful one (s3) is never offered', () => {
    expect(chooseMistakeCard([BATCH], [], TODAY)?.cardId).toBe(S1);
    const onlyDoubtful: MistakesBatch = { ...BATCH, sentences: BATCH.sentences.filter((s) => s.id === 's3') };
    expect(chooseMistakeCard([onlyDoubtful], [], TODAY)).toBeNull();
  });

  it('a due sentence comes before an unseen one, the longest overdue first', () => {
    const progress = [
      card(S1, { state: 'learning', due: '2026-10-10' }),
      card(S2, { state: 'review', due: '2026-10-01' }),
    ];
    expect(chooseMistakeCard([BATCH], progress, TODAY)?.cardId).toBe(S2);
    // s1 was never seen and is first in the file, s2 is due: the due one still wins
    expect(chooseMistakeCard([BATCH], [card(S2, { state: 'review', due: '2026-10-20' })], TODAY)?.cardId).toBe(S2);
  });

  it('a sentence scheduled for later is not offered; all of them scheduled = nothing', () => {
    const later = [card(S1, { state: 'review', due: '2099-01-01' }), card(S2, { state: 'learning', due: '2099-01-01' })];
    expect(chooseMistakeCard([BATCH], later, TODAY)).toBeNull();
    // one of them still new: that one
    expect(chooseMistakeCard([BATCH], [card(S1, { state: 'review', due: '2099-01-01' })], TODAY)?.cardId).toBe(S2);
  });

  it('`skip` (sentence keys) leaves sentences out; no batch = null', () => {
    expect(chooseMistakeCard([BATCH], [], TODAY, new Set([key('No tengo tomate.')]))?.cardId).toBe(S2);
    expect(chooseMistakeCard([BATCH], [], TODAY, new Set([key('No tengo tomate.'), key('Eso está bien.')]))).toBeNull();
    expect(chooseMistakeCard([], [], TODAY)).toBeNull();
  });
});

describe('mistakeEntry + withMistakeStep', () => {
  const entry = (n: number): SentenceEntry => ({ itemId: `a1-w${n}`, source: `S${n}`, target: `t${n}`, wordCount: 1, wordIds: [], due: false, dueIds: [], staleness: '', slots: [] });
  const m = mistakeEntry(chooseMistakeCard([BATCH], [], TODAY)!);

  it('the entry carries the card id, the English prompt, the right Spanish and the faulty sentence; it owns no learned word', () => {
    expect(m).toMatchObject({
      itemId: S1, source: "I don't have tomato.", target: 'No tengo tomate.', wordCount: 3, wordIds: [], dueIds: [], slots: [], due: false,
      mistake: { wrong: 'Pero no tienes tomate.' },
    });
  });

  it('four builds: the mistake sentence takes the 3rd place, the others stay in order', () => {
    expect(withMistakeStep([1, 2, 3, 4].map(entry), m).map((e) => e.itemId)).toEqual(['a1-w1', 'a1-w2', S1, 'a1-w4']);
  });

  it('a shorter round keeps every build and gets the mistake sentence at the end; none = unchanged', () => {
    expect(withMistakeStep([1, 2].map(entry), m).map((e) => e.itemId)).toEqual(['a1-w1', 'a1-w2', S1]);
    expect(withMistakeStep([], m).map((e) => e.itemId)).toEqual([S1]);
    expect(withMistakeStep([1, 2, 3].map(entry), null).map((e) => e.itemId)).toEqual(['a1-w1', 'a1-w2', 'a1-w3']);
  });
});

describe('mistakeTrapWords', () => {
  const vocab = ['tengo', 'tienen', 'tienda', 'casa', 'libro', 'mesa'];
  const target = ['no', 'tengo', 'tomate'];

  it('the wrong sentence\'s own words first (not in the right one), topped up with near misses to 3', () => {
    const traps = mistakeTrapWords(target, 'Pero no tienes tomate.', vocab, 'es');
    expect(traps.slice(0, 2)).toEqual(['pero', 'tienes']); // the first word lowercased, like the tiles
    expect(traps).toHaveLength(3);
    expect(new Set(traps.map((w) => w.toLowerCase())).size).toBe(3);
    for (const w of traps) expect(target).not.toContain(w.toLowerCase());
  });

  it('three or more wrong-only words: exactly the first three, no near miss', () => {
    expect(mistakeTrapWords(target, 'Yo nunca tengo ningún tomate.', vocab, 'es')).toEqual(['yo', 'nunca', 'ningún']);
  });

  it('a wrong sentence with the same words (a different order or an accent only): near misses only', () => {
    const traps = mistakeTrapWords(target, 'tomate no tengo', vocab, 'es');
    expect(traps).toHaveLength(3);
    for (const w of traps) expect(target).not.toContain(w.toLowerCase());
  });
});

describe('the db steps', () => {
  const db = getDb();

  it('no batch loaded: no mistake sentence', async () => {
    expect(await pickMistakeEntry(TODAY, new Set())).toBeNull();
  });

  it('a loaded batch: the first sentence, then the next when it was done; a broken row is skipped', async () => {
    await db.saveMistakeBatch('broken', '{not json', '2026-10-01T00:00:00.000Z');
    await db.saveMistakeBatch(BATCH.batchId, JSON.stringify(BATCH), '2026-10-02T00:00:00.000Z');
    expect((await pickMistakeEntry(TODAY, new Set()))?.itemId).toBe(S1);
    expect((await pickMistakeEntry(TODAY, new Set([key('No tengo tomate.')])))?.itemId).toBe(S2);
  });

  it('right = the deck\'s "Knew it" (good), wrong = "Didn\'t know" (again), saved in the mistake deck; a seen card continues from its progress', async () => {
    const fresh = sm2NewCard(S1);
    await db.upsertMistakeCard(fresh);
    const right = await recordMistakeBuild(S1, true, TODAY);
    expect(right).toEqual(sm2Review(fresh, 'good', TODAY));
    expect((await db.getMistakeCards()).find((c) => c.itemId === S1)).toEqual(right);

    const wrong = await recordMistakeBuild(S1, false, TODAY);
    expect(wrong).toEqual(sm2Review(right, 'again', TODAY));
    expect((await db.getMistakeCards()).find((c) => c.itemId === S1)).toEqual(wrong);
  });

  it('a card with no row yet starts from a new card', async () => {
    const id = `${BATCH.batchId}:s:never-seen`;
    expect(await recordMistakeBuild(id, false, TODAY)).toEqual(sm2Review(sm2NewCard(id), 'again', TODAY));
  });
});
