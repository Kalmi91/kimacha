// game_progress (memory db). Play cut
// (2026-09-23): game_scores/game_settings and the vocabPool helper
// (getAllWordCards) lost their last caller with the Game tab and are gone;
// game_progress survives, now also used by the grammar drill.

import { getDb } from '../database.web';

describe('game_progress (memory db)', () => {
  const db = getDb();

  it('tracks per-item progress (story/chat)', async () => {
    await db.setGameProgress('story', 'el-mercado', 'unlocked');
    await db.setGameProgress('story', 'la-casa', 'done', { checklist: 3 });
    const progress = await db.getGameProgress('story');
    expect(progress).toEqual(
      expect.arrayContaining([
        { itemId: 'el-mercado', state: 'unlocked', data: undefined },
        { itemId: 'la-casa', state: 'done', data: { checklist: 3 } },
      ])
    );
  });

  it('resetGameProgress clears one game only (PLAN-fb1001 FB431)', async () => {
    await db.setGameProgress('grammar-x', 'a', 'done');
    await db.setGameProgress('other-x', 'b', 'done');
    await db.resetGameProgress('grammar-x');
    expect(await db.getGameProgress('grammar-x')).toEqual([]);
    expect(await db.getGameProgress('other-x')).toHaveLength(1);
  });

  it('survives an export/import round-trip', async () => {
    await db.setGameProgress('chat', 'coche-usado', 'done', { checklist: 6 });

    const payload = await db.exportAll();
    expect(payload.tables.game_progress.length).toBeGreaterThan(0);

    await db.importAll(payload);
    expect(await db.getGameProgress('chat')).toEqual([{ itemId: 'coche-usado', state: 'done', data: { checklist: 6 } }]);
  });
});
