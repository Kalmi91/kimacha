// E123: the SM-2 cards (pcic_cards, the mistakes deck) belong to a language pair. On the memory store (web and
// tests): the pair switch, the migration of an old shared-set state, the backup and the cloud payload.

import { MemoryDB, MemoryStore, exportWebState, importWebState } from '../database.web';
import { validateBackupPayload } from '../backup';
import { exportCloudPayload, restoreFromCloud } from '../cloud/sync';
import { mergeCloudPayloads } from '../cloud/merge';
import { sm2NewCard } from '../sm2';

const card = (id: string, interval = 3) => ({ ...sm2NewCard(id), state: 'review' as const, interval, due: '2026-11-20', lastReview: '2026-11-10', introducedAt: '2026-11-01' });
const ids = async (db: MemoryDB) => (await db.getPcicCards()).map((c) => c.itemId).sort();

// A web state as the 4.1.41 build wrote it: version 1, bare item-id keys, one shared card set.
function oldState(active: [string, string], cards: string[], mistakes: string[] = [], pairs: string[] = []): string {
  const s = JSON.parse(new MemoryStore().serializeState());
  s.v = 1;
  s.onboarding = { source: active[0], target: active[1] };
  s.settings = pairs.map((p) => [p, {}]);
  s.pcicCards = cards.map((id) => [id, card(id)]);
  s.mistakeCards = mistakes.map((id) => [id, card(id)]);
  return JSON.stringify(s);
}

describe('the pair switch (memory db)', () => {
  it('hu→es starts from zero, and back on en→es the progress is there; the mistakes deck follows the pair too', async () => {
    const db = new MemoryDB();
    await db.setOnboarding('en', 'es');
    await db.upsertPcicCard(card('o1'));
    await db.upsertMistakeCard(card('b:w:1'));

    await db.setOnboarding('hu', 'es');
    expect(await db.getPcicCards()).toEqual([]);
    expect(await db.getPcicCard('o1')).toBeNull();
    expect(await db.getMistakeCards()).toEqual([]);
    await db.upsertPcicCard(card('o1', 9));
    await db.upsertPcicCard(card('o2'));
    expect((await db.getPcicCard('o1'))?.interval).toBe(9);

    await db.setOnboarding('en', 'es');
    expect(await ids(db)).toEqual(['o1']);
    expect((await db.getPcicCard('o1'))?.interval).toBe(3);
    expect((await db.getMistakeCards()).map((c) => c.itemId)).toEqual(['b:w:1']);
  });

  it('resetPcicCards clears only the active pair', async () => {
    const db = new MemoryDB();
    await db.upsertPcicCard(card('o1'));
    await db.setOnboarding('hu', 'es');
    await db.upsertPcicCard(card('o1'));
    await db.resetPcicCards();
    expect(await ids(db)).toEqual([]);
    await db.setOnboarding('en', 'es');
    expect(await ids(db)).toEqual(['o1']);
  });
});

describe('an old (v1, shared set) web state', () => {
  it('stays with the active pair when its target matches; a card of another target goes to the newest known pair of it', async () => {
    const db = new MemoryDB();
    await db.importState(oldState(['en', 'es'], ['o1', 'o2', 'e3'], ['m:w:1'], ['en-es', 'es-en']));
    expect(await ids(db)).toEqual(['o1', 'o2']);
    expect((await db.getMistakeCards()).map((c) => c.itemId)).toEqual(['m:w:1']);
    await db.setOnboarding('es', 'en');
    expect(await ids(db)).toEqual(['e3']);
    await db.setOnboarding('hu', 'es');
    expect(await ids(db)).toEqual([]);
  });

  it('the newest known pair of the card target wins, and with none the pair of the active source', async () => {
    const db = new MemoryDB();
    await db.importState(oldState(['es', 'en'], ['o1', 'e2', 'd3'], [], ['en-es', 'hu-es']));
    expect(await ids(db)).toEqual(['e2']);
    await db.setOnboarding('hu', 'es');
    expect(await ids(db)).toEqual(['o1']);
    await db.setOnboarding('en', 'es');
    expect(await ids(db)).toEqual([]);
    await db.setOnboarding('es', 'de');
    expect(await ids(db)).toEqual(['d3']);
  });

  it('keeps every card (nothing lost)', async () => {
    const db = new MemoryDB();
    await db.importState(oldState(['hu', 'es'], ['o1', 'e2', 'h3', 'd4', 'x5']));
    const state = JSON.parse(await db.exportState());
    expect(state.v).toBe(2);
    expect(state.pcicCards.map(([k]: [string]) => k.split('|')[1]).sort()).toEqual(['d4', 'e2', 'h3', 'o1', 'x5']);
  });
});

describe('backup (memory db)', () => {
  it('round-trips the cards of two pairs, in a v3 file', async () => {
    const db = new MemoryDB();
    await db.upsertPcicCard(card('o1'));
    await db.setOnboarding('hu', 'es');
    await db.upsertPcicCard(card('o1', 9));
    await db.upsertMistakeCard(card('b:w:1'));
    const payload = JSON.parse(JSON.stringify(await db.exportAll()));
    expect(payload.schemaVersion).toBe(3);
    expect(() => validateBackupPayload(payload)).not.toThrow();
    expect(payload.tables.pcic_cards.map((r: any) => r.pair).sort()).toEqual(['en-es', 'hu-es']);

    const target = new MemoryDB();
    await target.importAll(validateBackupPayload(payload));
    expect(await target.getOnboarding()).toEqual({ source: 'hu', target: 'es' });
    expect((await target.getPcicCard('o1'))?.interval).toBe(9);
    await target.setOnboarding('en', 'es');
    expect((await target.getPcicCard('o1'))?.interval).toBe(3);
    expect(await target.getMistakeCards()).toEqual([]);
  });

  it('a v2 file (cards without a pair) still restores, to the pair of its own onboarding', async () => {
    const db = new MemoryDB();
    await db.setOnboarding('en', 'es');
    await db.upsertPcicCard(card('o1'));
    await db.upsertPcicCard(card('e2'));
    const v3 = JSON.parse(JSON.stringify(await db.exportAll()));
    const v2 = { ...v3, schemaVersion: 2, tables: { ...v3.tables, pcic_cards: v3.tables.pcic_cards.map(({ pair, ...r }: any) => r) } };
    const target = new MemoryDB();
    await target.setOnboarding('hu', 'es');
    await target.importAll(validateBackupPayload(v2));
    expect(await ids(target)).toEqual(['o1']);
    await target.setOnboarding('es', 'en');
    expect(await ids(target)).toEqual(['e2']);
  });
});

describe('the cloud payload (web sync)', () => {
  it('round-trips the cards of two pairs', async () => {
    const db = new MemoryDB();
    await db.upsertPcicCard(card('o1'));
    await db.setOnboarding('hu', 'es');
    await db.upsertPcicCard(card('o1', 9));
    const raw = await db.exportState();

    const other = new MemoryDB();
    await other.importState(raw);
    expect((await other.getPcicCard('o1'))?.interval).toBe(9);
    await other.setOnboarding('en', 'es');
    expect((await other.getPcicCard('o1'))?.interval).toBe(3);
  });

  it('exportCloudPayload / restoreFromCloud keep the pairs on the shared web store', async () => {
    await importWebState(oldState(['en', 'es'], ['o1'], [], ['en-es']));
    const payload = await exportCloudPayload();
    expect(JSON.parse(JSON.parse(payload).store).v).toBe(2);
    await importWebState(new MemoryStore().serializeState());
    await restoreFromCloud(payload);
    expect(JSON.parse(await exportWebState()).pcicCards.map(([k]: [string]) => k)).toEqual(['en-es|o1']);
  });

  it('an old-app payload (v1 store, bare keys) merged into a new state loses no card', async () => {
    const local = new MemoryDB();
    await local.importState(oldState(['en', 'es'], [], [], ['en-es']));
    await local.upsertPcicCard(card('o1', 5));
    await local.setOnboarding('hu', 'es');
    await local.upsertPcicCard(card('o7'));
    await local.setOnboarding('en', 'es');
    const localPayload = JSON.stringify({ v: 1, store: await local.exportState(), resume: {} });
    const remotePayload = JSON.stringify({ v: 1, store: oldState(['en', 'es'], ['o1', 'o2'], [], ['en-es']), resume: {} });

    const merged = JSON.parse(JSON.parse(mergeCloudPayloads(localPayload, remotePayload)).store);
    expect(merged.v).toBe(2);
    expect(merged.pcicCards.map(([k]: [string]) => k).sort()).toEqual(['en-es|o1', 'en-es|o2', 'hu-es|o7']);
    expect(new Map(merged.pcicCards as [string, any][]).get('en-es|o1')!.interval).toBe(5);
  });

  it('what an older build merges into a new state (bare keys beside pair keys, store still v1) is read back whole', async () => {
    const mixed = JSON.parse(oldState(['en', 'es'], ['o1'], [], ['en-es']));
    mixed.pcicCards.push(['hu-es|o7', card('o7')]);
    const db = new MemoryDB();
    await db.importState(JSON.stringify(mixed));
    expect(await ids(db)).toEqual(['o1']);
    await db.setOnboarding('hu', 'es');
    expect(await ids(db)).toEqual(['o7']);
  });
});
