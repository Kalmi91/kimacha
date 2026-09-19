import { getDb } from '../database.web';
import { buildQueue, applyCadence } from '../sessionQueue';
import { getWordsForLevel } from '@/data/words';
import type { Level } from '@/data/words';

// FB315 (NY9): a sessionSmoke.test.ts mintájára, de a `loadCards`/`finishRound`
// fókusz-ágának CSAK a lib-szintű mechanizmusát nézi (db.getDueCardsForWordIds
// egy explicit id-listára + buildQueue), mert maga a React-ág (app/(tabs)/index.tsx
// `if (focus) {...}`) nem exportált tiszta függvény, nem hívható renderelés
// nélkül. Ez azt fedi le, amire a fókusz-ág épül: egy szint szavainak egy
// részhalmazára szűkített lekérdezés a TÖBBI szint-szót kihagyja a sorból.
const QUEUE_POOL = 40;

describe('a focus-scoped session only hands out the focus words', () => {
  it('excludes other level words that are equally due', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');

    const level: Level = 'A1';
    const target = 'es';
    const levelWords = getWordsForLevel(level, target).slice(0, 6);
    const focusWords = levelWords.slice(0, 3);
    const otherWords = levelWords.slice(3, 6);

    // Both groups go through the same ladder, so both are equally "due" and
    // the only difference the queue can react to is the id list it is asked for.
    for (const w of [...focusWords, ...otherWords]) {
      await db.ensureCard(w.id, 'sentence');
      await db.startWord(w.id);
      await db.passLap(w.id);
      await db.passLap(w.id);
      await db.passLap(w.id);
    }

    const focusIds = focusWords.map((w) => w.id);
    const rows = await db.getDueCardsForWordIds(focusIds, QUEUE_POOL);
    const queue = applyCadence(buildQueue(rows, target), false, target);

    expect(queue.length).toBeGreaterThan(0);
    for (const item of queue) {
      expect(focusIds).toContain(item.wordId);
    }
    const otherIds = otherWords.map((w) => w.id);
    expect(queue.some((item) => otherIds.includes(item.wordId))).toBe(false);
  });
});
