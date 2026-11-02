// Process death during a Learn round: Android kills the app in the background, the learner force-stops it, or the
// process dies on the card. The progress must not depend on a clean shutdown (no unmount, no "save on exit"):
// a graded card is written the moment the grade is tapped, the card-order snapshot (lib/learnResume.ts) is only a
// convenience on top, and a card that was revealed but not graded leaves no half-written trace. "Dying" here means
// the screen is unmounted and the snapshot writes after a chosen moment are lost, the DB stays (persisted SQLite).
// Mock pattern: pcicResume.test.tsx.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const mockA1Items = Array.from({ length: 30 }, (_, i) => ({
  id: `a1-w${i}`,
  es: `a1palabra${i}`,
  en: `a1word${i}`,
  kind: 'word' as const,
  section: 'Test',
  order: i,
}));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'],
  PCIC_VIEW_LEVELS: ['A1'],
  pcicItemsForLevel: (level: string) => (level === 'A1' ? mockA1Items : []),
  findPcicItem: (id: string) => mockA1Items.find((i) => i.id === id),
  levelOfItem: (id: string) => (id.startsWith('a1-') ? 'A1' : undefined),
  setPcicTarget: () => {},
}));

import { TextInput } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { getXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { localDateString } from '@/lib/usageStats';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

// In the mock corpus the prompt is the English word "a1word<i>", the answer the Spanish "a1palabra<i>".
const promptShown = (screen: ReturnType<typeof render>, i: number) => screen.queryByText(`a1word${i}`) !== null;

async function reveal(screen: ReturnType<typeof render>, typed: string) {
  fireEvent.changeText(screen.UNSAFE_getByType(TextInput), typed);
  fireEvent.press(screen.getByText('✓ Check'));
  await flush();
}

async function answer(screen: ReturnType<typeof render>, typed: string, grade: 'Knew it' | "Didn't know") {
  await reveal(screen, typed);
  fireEvent.press(screen.getByText(`Next → ${grade}`));
  await flush();
}

/** From now on the learner-progress snapshot writes are lost (the process died before they ran); everything else is written. */
function loseResumeWrites() {
  const db = getDb();
  const real = db.setGameProgress.bind(db);
  const spy = jest.spyOn(db, 'setGameProgress').mockImplementation(async (gameId, itemId, state, data) => {
    if (gameId === RESUME_GAME_ID) return;
    return real(gameId, itemId, state, data);
  });
  return () => spy.mockRestore();
}

describe('Learn round: the progress survives a process death', () => {
  const today = localDateString();

  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setPcicNewBonus(0, today);
    await getDb().setPcicLevel('A1');
  });

  it('a graded card is in the database the moment the grade is tapped (SRS state, streak, daily XP)', async () => {
    const xpBefore = (await getXp()).xp;
    const screen = render(<PcicScreen />);
    await flush();
    expect(promptShown(screen, 0)).toBe(true);

    await answer(screen, 'a1palabra0', 'Knew it');

    // no unmount, no end of the round: the DB already holds the answer
    const card = (await getDb().getPcicCards()).find((c) => c.itemId === 'a1-w0');
    expect(card).toMatchObject({ reps: 1, lastReview: today, introducedAt: today, lapses: 0 });
    expect(card?.state).toBe('review');
    expect((card?.due ?? '') > today).toBe(true);
    const streak = await getDb().getStreak();
    expect(streak.last_date).toBe(today);
    expect(streak.current_count).toBeGreaterThanOrEqual(1);
    expect((await getXp()).xp).toBeGreaterThan(xpBefore);
    screen.unmount();
  });

  it('process death right after a grade, before the card-order snapshot is written: the answered card is not asked again', async () => {
    const first = render(<PcicScreen />);
    await flush();
    const restore = loseResumeWrites();

    await answer(first, 'a1palabra0', 'Knew it');
    await answer(first, 'a1palabra1', 'Knew it');
    expect(promptShown(first, 2)).toBe(true);
    first.unmount(); // the process is gone; the snapshot on disk is the one from before the two answers (a0 at its head)
    restore();

    const second = render(<PcicScreen />);
    await flush();
    expect(promptShown(second, 0)).toBe(false);
    expect(promptShown(second, 1)).toBe(false);
    expect(promptShown(second, 2)).toBe(true);
    const rated = (await getDb().getPcicCards()).filter((c) => c.lastReview === today).map((c) => c.itemId).sort();
    expect(rated).toEqual(['a1-w0', 'a1-w1']);
    second.unmount();
  });

  it('process death on the card (answer revealed, not graded): nothing is half-written and the same card comes back', async () => {
    const streakBefore = await getDb().getStreak();
    const xpBefore = (await getXp()).xp;
    const first = render(<PcicScreen />);
    await flush();
    await reveal(first, 'a1palabra0'); // the correct answer is revealed, the grade is not tapped
    expect(first.queryByText('Next → Knew it')).not.toBeNull();
    first.unmount();

    expect((await getDb().getPcicCards()).filter((c) => c.itemId === 'a1-w0' && c.reps > 0)).toEqual([]);
    expect(await getDb().getStreak()).toEqual(streakBefore);
    expect((await getXp()).xp).toBe(xpBefore);

    const second = render(<PcicScreen />);
    await flush();
    expect(promptShown(second, 0)).toBe(true);
    expect(second.queryByText('Next → Knew it')).toBeNull(); // back to an unanswered card, not a revealed one
    second.unmount();
  });

  it('a missed card is in the database as a learning card the moment the grade is tapped', async () => {
    const screen = render(<PcicScreen />);
    await flush();
    await answer(screen, 'xyz', "Didn't know");
    const missed = (await getDb().getPcicCards()).find((c) => c.itemId === 'a1-w0');
    expect(missed).toMatchObject({ state: 'learning', reps: 1, lastReview: today, introducedAt: today });
    screen.unmount();
  });

  // FOUND GAP (skipped, expects the correct behavior): the "again" return timer lives only in the card-order snapshot, so if
  // the process dies between the grade write and the snapshot write, the stale snapshot puts the missed card back at the head.
  // Unskip when the return timer is stored in the same DB write as the grade.
  it.skip('process death right after a missed grade, before the snapshot is written: the missed card does not come straight back', async () => {
    const first = render(<PcicScreen />);
    await flush();
    const restore = loseResumeWrites();
    await answer(first, 'xyz', "Didn't know");
    expect(promptShown(first, 1)).toBe(true);
    first.unmount();
    restore();

    const second = render(<PcicScreen />);
    await flush();
    expect(promptShown(second, 0)).toBe(false);
    expect(promptShown(second, 1)).toBe(true);
    second.unmount();
  });
});
