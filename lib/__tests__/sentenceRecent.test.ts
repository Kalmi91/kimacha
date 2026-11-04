// FB587: the sentences of the last rounds are kept per language pair, and a corrupt stored value is ignored.

import type { DB } from '@/lib/database';
import { loadRecentSentences, RECENT_ROUNDS, rememberRound } from '../sentenceRecent';

function fakeDb() {
  const rows: Array<{ itemId: string; state: string; data: unknown }> = [];
  const db = {
    setGameProgress: async (_g: string, itemId: string, state: string, data?: unknown) => {
      const at = rows.findIndex((r) => r.itemId === itemId);
      const row = { itemId, state, data: data ?? null };
      if (at >= 0) rows[at] = row;
      else rows.push(row);
    },
    getGameProgress: async () => rows,
  } as unknown as DB;
  return { db, rows };
}

describe('sentenceRecent', () => {
  it('nothing saved = nothing recent', async () => {
    expect((await loadRecentSentences(fakeDb().db, 'es→en')).size).toBe(0);
  });

  it('keeps the last 3 rounds, the oldest falls out', async () => {
    const { db } = fakeDb();
    for (const r of ['a', 'b', 'c', 'd']) await rememberRound(db, 'es→en', [`${r}1`, `${r}2`]);
    const recent = await loadRecentSentences(db, 'es→en');
    expect(RECENT_ROUNDS).toBe(3);
    expect([...recent].sort()).toEqual(['b1', 'b2', 'c1', 'c2', 'd1', 'd2']);
  });

  it('is per direction', async () => {
    const { db } = fakeDb();
    await rememberRound(db, 'es→en', ['x']);
    expect((await loadRecentSentences(db, 'es→hu')).size).toBe(0);
    expect([...(await loadRecentSentences(db, 'es→en'))]).toEqual(['x']);
  });

  it('a corrupt stored value is ignored, and a good round is added on top of it', async () => {
    const { db, rows } = fakeDb();
    rows.push({ itemId: 'sentences-recent:es→en', state: 'saved', data: { not: 'a list' } });
    expect((await loadRecentSentences(db, 'es→en')).size).toBe(0);
    rows[0].data = [['ok'], 'bad', [1, 2], ['fine']];
    expect([...(await loadRecentSentences(db, 'es→en'))].sort()).toEqual(['fine', 'ok']);
    await rememberRound(db, 'es→en', ['new']);
    expect([...(await loadRecentSentences(db, 'es→en'))].sort()).toEqual(['fine', 'new', 'ok']);
  });
});
