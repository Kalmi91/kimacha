// FB203/FB208/FB211, Kálmán 2026-09-09: „Difficulty ugy látom, hogy nem működik
// vagy nem azt állítja amit én gondoltam", „olyan mintha túl hamar jönnének újra
// a szavak", és a kért bizonyíték: „csináld meg egy emulátorba és nyomkodd és
// teszteld hogy tényleg úgy adja a szavakat ahogy kell".
//
// Az emulátoros menetet ez nem váltja ki, de a panasz ÚTVONALÁT végigfuttatja az
// igazi darabokkal (valódi korpusz, valódi FSRS, in-memory DB): egy szót Good-dal
// megválaszolunk, a sor újraépül a DB-ből, és a kérdés az, hogy a szó tényleg
// hátrébb kerül-e annyival, amennyit a nehézség-beállítás ígér. A FB213 előtt
// éppen ez bukott: a Good-dal megválaszolt lap az új sor ELEJÉRE került.

import { fsrs, generatorParameters, Rating } from 'ts-fsrs';

import { getDb } from '../database.web';
import { buildQueue, applyCadence } from '../sessionQueue';
import { deferRecent, recentKey, rememberRecent } from '../recentGuard';
import { requeueGapFor, type RequeueLevel } from '../requeueGap';
import { getWordsForLevel } from '@/data/words';

const POOL = 200;
const f = fsrs(generatorParameters({ enable_fuzz: false }));

async function seedSession(wordCount: number) {
  const db = getDb();
  await db.setOnboarding('hu', 'es');
  const words = getWordsForLevel('A1', 'es').slice(0, wordCount);
  for (const w of words) {
    await db.ensureCard(w.id, 'word');
    await db.ensureCard(w.id, 'sentence');
  }
  return { db, ids: words.map((w) => w.id) };
}

async function buildFrom(db: ReturnType<typeof getDb>, ids: number[], recent: string[]) {
  const rows = await db.getDueCardsForWordIds(ids, POOL);
  const queue = applyCadence(buildQueue(rows, 'es'), false, 'es');
  return deferRecent(queue, recent);
}

describe('a rated word does not come straight back (FB203/FB208/FB211)', () => {
  // A memória-DB modul-szintű, tehát minden eset tiszta lappal indul, különben az
  // előző menet ütemezése fogyasztaná el az esedékes kártyákat.
  beforeEach(async () => {
    await getDb().resetAllProgress();
  });

  it.each<[RequeueLevel, number]>([
    ['easy', requeueGapFor('easy')],
    ['normal', requeueGapFor('normal')],
    ['hard', requeueGapFor('hard')],
  ])('%s keeps it away for the promised %i cards', async (level, gap) => {
    // Elég szó ahhoz, hogy a hézag ELFÉRJEN a sorban: rövid pakli esetén a
    // szabály az, hogy a látott lap hátra megy, nem az, hogy eltűnik (lásd a
    // következő tesztet).
    const { db, ids } = await seedSession(100);
    let recent: string[] = [];

    const queue = await buildFrom(db, ids, recent);
    expect(queue.length).toBeGreaterThan(gap);

    // Answer the first card Good, exactly the way the Learn tab does.
    const item = queue[0];
    const updated = f.repeat(item.card, new Date())[Rating.Good].card;
    await db.updateCard(item.wordId, item.type, updated);
    await db.recordAttempt(item.wordId, item.type, true, 1200);
    recent = rememberRecent(recent, recentKey(item), gap);

    // The queue is rebuilt from the DB the moment the session runs out, which is
    // where the word used to jump back to the front.
    const rebuilt = await buildFrom(db, ids, recent);
    const position = rebuilt.findIndex((i) => recentKey(i) === recentKey(item));
    if (position >= 0) expect(position).toBeGreaterThanOrEqual(gap);
  });

  it('a short deck still rotates instead of stalling', async () => {
    const { db, ids } = await seedSession(3);
    const gap = requeueGapFor('normal');
    let recent: string[] = [];

    let queue = await buildFrom(db, ids, recent);
    const seen: string[] = [];
    for (let step = 0; step < 6 && queue.length > 0; step++) {
      const item = queue[0];
      seen.push(recentKey(item));
      const updated = f.repeat(item.card, new Date())[Rating.Good].card;
      await db.updateCard(item.wordId, item.type, updated);
      recent = rememberRecent(recent, recentKey(item), gap);
      queue = await buildFrom(db, ids, recent);
    }

    // Nothing is dropped: a deck this small keeps handing out cards…
    expect(seen.length).toBeGreaterThan(1);
    // …and it never shows the same card twice in a row.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });
});
