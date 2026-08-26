// GAMES.md 3.5 (F0): the three new Game-tab tables (game_scores, game_settings,
// game_progress) and the vocabPool helper (getAllWordCards), on the memory DB
// (the pattern every other DB-touching test in this repo follows, see
// lib/__tests__/backup.test.ts).

import { createEmptyCard } from 'ts-fsrs';
import { getDb } from '../database.web';

describe('game_scores / game_settings / game_progress (memory db)', () => {
  const db = getDb();

  it('getAllWordCards returns only non-buried word cards of the given pair', async () => {
    await db.setOnboarding('hu', 'es');
    await db.ensureCard(9001, 'word');
    await db.ensureCard(9002, 'word');
    await db.ensureCard(9003, 'sentence');
    await db.buryCard(9002, 'word');

    const cards = await db.getAllWordCards('hu-es');
    const ids = cards.map((c) => c.word_id).sort();
    expect(ids).toEqual([9001]);
  });

  it('tracks the best score and play count across attempts', async () => {
    const first = await db.recordGameScore('word-rain', 400);
    expect(first).toEqual({ isNewBest: true, best: 400 });

    const worse = await db.recordGameScore('word-rain', 100);
    expect(worse).toEqual({ isNewBest: false, best: 400 });

    const better = await db.recordGameScore('word-rain', 900);
    expect(better).toEqual({ isNewBest: true, best: 900 });

    const stored = await db.getGameScore('word-rain');
    expect(stored?.bestScore).toBe(900);
    expect(stored?.plays).toBe(3);
    expect(stored?.lastPlayed).toBeTruthy();

    expect(await db.getGameScore('never-played')).toBeNull();
  });

  it('round-trips per-game settings as JSON', async () => {
    expect(await db.getGameSettings('bubble-pop')).toBeNull();
    await db.setGameSettings('bubble-pop', { bubbleCount: 12, speed: 'fast' });
    expect(await db.getGameSettings('bubble-pop')).toEqual({ bubbleCount: 12, speed: 'fast' });
  });

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

  it('survives an export/import round-trip', async () => {
    await db.recordGameScore('memory-pairs', 750);
    await db.setGameSettings('memory-pairs', { gridSize: '4x4' });
    await db.setGameProgress('chat', 'coche-usado', 'done', { checklist: 6 });

    const payload = await db.exportAll();
    expect(payload.tables.game_scores.length).toBeGreaterThan(0);
    expect(payload.tables.game_settings.length).toBeGreaterThan(0);
    expect(payload.tables.game_progress.length).toBeGreaterThan(0);

    await db.importAll(payload);
    expect(await db.getGameScore('memory-pairs')).toMatchObject({ bestScore: 750 });
    expect(await db.getGameSettings('memory-pairs')).toEqual({ gridSize: '4x4' });
    expect(await db.getGameProgress('chat')).toEqual([{ itemId: 'coche-usado', state: 'done', data: { checklist: 6 } }]);
  });
});
