import { getDb } from '../database.web';
import { buildQueue, mergeCarryover, CARRY_SHARE } from '../sessionQueue';
import { getWordsForLevel } from '@/data/words';

// FB225, Kálmán 2026-09-10: „azt szeretném hogy minden szintet ha elkezdek a régi
// szavak ismétlése legyen benne". A sor a jelenlegi szint (vagy az aktív téma)
// szavaira volt szűkítve, ezért az A2-re lépés után az A1-en már megkezdett
// szavak esedékes ismétlései kiestek a forgásból. A screenshot ezt mutatta: az
// A2 fülön 6 esedékes ismétlés, az A1-en ugyanakkor 33 – és a kettő sosem
// találkozott.
const QUEUE_POOL = 40;
const REVIEW_SLOTS = QUEUE_POOL - Math.max(1, Math.round(QUEUE_POOL * 0.3));

const row = (wordId: number, due: string, reps: number, type = 'word') =>
  ({ word_id: wordId, type, reps, due }) as any;

describe('mergeCarryover osztja az ismétlés-helyeket', () => {
  it('carryover nélkül a sor bitre ugyanaz marad', () => {
    const level = [row(1, '2026-01-01', 3), row(2, '2026-01-02', 0)];
    expect(mergeCarryover(level, [], REVIEW_SLOTS)).toEqual(level);
  });

  it('a kevés szint-ismétlést a régi szavak töltik fel', () => {
    const level = [row(1, '2026-01-05', 3), row(2, '2026-01-06', 3)];
    const carry = Array.from({ length: 20 }, (_, i) => row(100 + i, `2026-01-0${(i % 9) + 1}`, 4));
    const merged = mergeCarryover(level, carry, REVIEW_SLOTS);
    // Kevesebb esedékes van, mint hely: mind a 22 belefér, egyik oldal sem esik ki.
    expect(merged.length).toBe(22);
    expect(merged.filter((r) => r.word_id >= 100).length).toBe(20);
    expect(merged.filter((r) => r.word_id < 100).length).toBe(2);
  });

  it('teli szint mellett is jut hely a régi szavaknak', () => {
    const level = Array.from({ length: REVIEW_SLOTS }, (_, i) => row(i + 1, '2026-02-01', 3));
    const carry = Array.from({ length: REVIEW_SLOTS }, (_, i) => row(100 + i, '2026-01-01', 4));
    const merged = mergeCarryover(level, carry, REVIEW_SLOTS);
    expect(merged.length).toBe(REVIEW_SLOTS);
    expect(merged.filter((r) => r.word_id >= 100).length).toBe(Math.round(REVIEW_SLOTS * CARRY_SHARE));
  });

  it('az új szavakat és a mondatokat nem eszi meg', () => {
    const level = [row(1, '2026-01-05', 3), row(2, '2026-01-05', 0), row(3, '2026-01-05', 1, 'sentence')];
    const carry = Array.from({ length: 30 }, (_, i) => row(100 + i, '2026-01-01', 4));
    const merged = mergeCarryover(level, carry, REVIEW_SLOTS);
    expect(merged.some((r) => r.word_id === 2 && r.reps === 0)).toBe(true);
    expect(merged.some((r) => r.type === 'sentence')).toBe(true);
  });

  it('a leghamarabb esedékes ismétlés megy elöl, akármelyik szintről jött', () => {
    const level = [row(1, '2026-03-01', 3)];
    const carry = [row(100, '2026-01-01', 4)];
    const merged = mergeCarryover(level, carry, REVIEW_SLOTS);
    expect(merged[0].word_id).toBe(100);
  });
});

// A valódi lánc: A1-en megkezdett szavak + A2-re lépés → az A2 sorában ott
// vannak-e az A1 szavai. Ez a rész bukott el eddig: a lekérdezés maga volt
// szintre szűkítve, unit teszttel nem lehetett látni.
describe('egy A2 session hozza az A1 esedékes szavait', () => {
  it('a carryover kártyák bekerülnek a sorba', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    const past = new Date(Date.now() - 3 * 86400000);

    const a1 = getWordsForLevel('A1', 'es').slice(0, 12);
    for (const w of a1) {
      await db.ensureCard(w.id, 'word');
      await db.updateCard(w.id, 'word', {
        due: past, stability: 2, difficulty: 5, elapsed_days: 1, scheduled_days: 1,
        learning_steps: 0, reps: 3, lapses: 0, state: 2, last_review: past,
      } as any);
    }

    const a2 = getWordsForLevel('A2', 'es').slice(0, 10);
    for (const w of a2) await db.ensureCard(w.id, 'word');
    const a2Ids = a2.map((w) => w.id);

    const levelRows = await db.getDueCardsForWordIds(a2Ids, QUEUE_POOL);
    expect(levelRows.some((r: any) => a1.some((w) => w.id === r.word_id))).toBe(false);

    const carryRows = await db.getDueCarryoverCards(a2Ids, REVIEW_SLOTS);
    expect(carryRows.length).toBe(a1.length);
    expect(await db.countDueCarryoverWords(a2Ids)).toBe(a1.length);

    const rows = mergeCarryover(levelRows, carryRows, REVIEW_SLOTS);
    const queue = buildQueue(rows, 'es');
    const a1InQueue = queue.filter((item) => a1.some((w) => w.id === item.wordId));
    expect(a1InQueue.length).toBe(a1.length);
    // Minden átvitt lap ismétlés, nem új szó: a napi új-szó keretet nem érinti.
    for (const item of a1InQueue) expect(item.card.reps).toBeGreaterThan(0);
  });

  it('a már besorolt szavakat nem duplázza', async () => {
    const db = getDb();
    // Sajat par: a memoria-adatbazis egy peldany, a kartyakat a `pair` valasztja szet.
    await db.setOnboarding('hu', 'en');
    const words = getWordsForLevel('A1', 'en').slice(0, 5);
    const past = new Date(Date.now() - 86400000);
    for (const w of words) {
      await db.ensureCard(w.id, 'word');
      await db.updateCard(w.id, 'word', {
        due: past, stability: 2, difficulty: 5, elapsed_days: 1, scheduled_days: 1,
        learning_steps: 0, reps: 3, lapses: 0, state: 2, last_review: past,
      } as any);
    }
    const ids = words.map((w) => w.id);
    expect(await db.getDueCarryoverCards(ids, REVIEW_SLOTS)).toEqual([]);
    expect(await db.countDueCarryoverWords(ids)).toBe(0);
  });
});
