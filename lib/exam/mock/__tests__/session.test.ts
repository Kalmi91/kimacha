// a próbavizsga részenkénti mentése (félbehagyva
// folytatható), a legutóbbi eredmény (a Stats kártya ezt mutatja) és a valódi vizsgaórák.

import { buildMockExam, mockExamSignature } from '../build';
import { scoreMockExam } from '../score';
import {
  CLOCK_WARNING_SECONDS,
  clearMockSession,
  formatClock,
  MOCK_EXAM_PROGRESS_KEY,
  readMockOverview,
  saveMockLast,
  saveMockSession,
  secondsLeft,
  type MockSession,
} from '../session';
import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';

afterAll(() => setPcicTarget('es'));

// Memória-tár ugyanazzal a két metódussal, mint a game_progress (lib/database*.ts).
function memoryStore() {
  const rows = new Map<string, { itemId: string; state: string; data: unknown }>();
  return {
    rows,
    async getGameProgress(gameId: string) {
      return [...rows.entries()].filter(([k]) => k.startsWith(`${gameId}|`)).map(([, v]) => v);
    },
    async setGameProgress(gameId: string, itemId: string, state: string, data?: unknown) {
      // Mint a valódi tábla: JSON-ba megy és vissza.
      rows.set(`${gameId}|${itemId}`, { itemId, state, data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)) });
    },
  };
}

describe('valódi vizsgaidők (E3 a)', () => {
  it('a hátralévő idő az időbélyegből számolódik, 0 alá nem megy', () => {
    const start = 1_000_000;
    expect(secondsLeft(start, 25, start)).toBe(25 * 60);
    expect(secondsLeft(start, 25, start + 1000)).toBe(25 * 60 - 1);
    expect(secondsLeft(start, 25, start + 25 * 60_000 - 500)).toBe(1);
    expect(secondsLeft(start, 25, start + 25 * 60_000)).toBe(0);
    expect(secondsLeft(start, 25, start + 99 * 60_000)).toBe(0);
  });

  it('m:ss formátum, és a figyelmeztetés az utolsó percre jön', () => {
    expect(formatClock(45 * 60)).toBe('45:00');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(-3)).toBe('0:00');
    expect(CLOCK_WARNING_SECONDS).toBe(60);
  });
});

describe('részenkénti mentés és folytatás (E4 b)', () => {
  const exam = () => {
    setPcicTarget('es');
    return buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1'), seed: 21 });
  };

  it('a mentett munkamenet visszaolvasható: mag, ujjlenyomat, kész papírok, válaszok', async () => {
    const store = memoryStore();
    const e = exam();
    const session: MockSession = { seed: e.seed, sig: mockExamSignature(e), done: ['reading'], answers: { 'reading-1': { '0': 2 } } };
    await saveMockSession(store, 'es', 'A1', session);
    const overview = await readMockOverview(store, 'es', ['A1', 'A2']);
    expect(overview.A1?.session).toEqual(session);
    expect(overview.A2?.session).toBeUndefined();
    expect(store.rows.get(`${MOCK_EXAM_PROGRESS_KEY}|es-A1-session`)?.state).toBe('open');
  });

  it('a mag ugyanazt a vizsgát adja vissza: a mentett ujjlenyomat egyezik, így folytatható', async () => {
    const e = exam();
    const sig = mockExamSignature(e);
    const rebuilt = buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1'), seed: e.seed });
    expect(mockExamSignature(rebuilt)).toBe(sig);
    const changed = buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1').slice(40), seed: e.seed });
    expect(mockExamSignature(changed)).not.toBe(sig);
  });

  it('befejezés után a munkamenet lezárul, az eredmény megmarad (Stats kártya)', async () => {
    const store = memoryStore();
    const e = exam();
    await saveMockSession(store, 'es', 'A1', { seed: e.seed, sig: mockExamSignature(e), done: ['reading', 'writing'], answers: {} });
    await clearMockSession(store, 'es', 'A1');
    const last = await saveMockLast(store, 'es', 'A1', scoreMockExam(e, {}), '2026-10-01');
    expect(last).toMatchObject({ passed: false, provisional: true, date: '2026-10-01' });
    const overview = await readMockOverview(store, 'es', ['A1']);
    expect(overview.A1?.session).toBeUndefined();
    expect(overview.A1?.last).toEqual(last);
    expect(store.rows.get(`${MOCK_EXAM_PROGRESS_KEY}|es-A1`)?.state).toBe('failed');
  });

  it('az irányok és szintek külön kulcson élnek (es-A1, es-A2, en-A2)', async () => {
    const store = memoryStore();
    const e = exam();
    const r = scoreMockExam(e, {});
    await saveMockLast(store, 'es', 'A2', r, '2026-10-02');
    await saveMockLast(store, 'en', 'A2', r, '2026-10-03');
    expect((await readMockOverview(store, 'es', ['A1', 'A2'])).A2?.last?.date).toBe('2026-10-02');
    expect((await readMockOverview(store, 'en', ['A2'])).A2?.last?.date).toBe('2026-10-03');
    expect((await readMockOverview(store, 'es', ['A1', 'A2'])).A1?.last).toBeUndefined();
  });
});
