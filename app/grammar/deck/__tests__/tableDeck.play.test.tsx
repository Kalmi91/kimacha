// PLAN-play 13. lépés (s6): end-to-end playthrough of the table-deck screen
// on the real ser-estar lesson (2 conjugation tables, 10 cells after
// vosotros is dropped). Mock pattern from
// app/grammar/__tests__/lessonV2.play.test.tsx and
// app/(tabs)/__tests__/pcicCardShell.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { tableCellsForLesson } from '@/lib/grammar/tableDeck';
import { hashString, shuffleArray } from '@/lib/shuffle';
import TableDeckScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const cells = tableCellsForLesson(lessonFor('es', 'ser-estar')!);

// FB377: the deck no longer shows the cells in table order, it uses a
// seeded shuffle (lesson id + reset count, lib/grammar/tableDeck.ts). This
// recomputes that same order (reset count 0, the first pass) so the test
// walks the cells in the order the screen actually shows them.
const deckOrder = shuffleArray(cells.map((c) => c.id).sort(), hashString('ser-estar:0'));
const cellAt = (i: number) => cells.find((c) => c.id === deckOrder[i])!;

const answerCurrent = async (typed: string) => {
  fireEvent.changeText(screen.getByTestId('tabledeck-input'), typed);
  fireEvent.press(screen.getByText('✓ Check'));
  await flush();
  fireEvent.press(screen.getByText('Next →'));
  await flush();
};

describe('table-deck screen: ser-estar playthrough', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    // Each test starts a fresh deck; the web db's game_progress map otherwise
    // carries state over between `it` blocks in this file.
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'ser-estar:tabledeck', 'progress', { cells: [] });
  });

  afterEach(() => {
    (Date.now as jest.Mock).mockRestore?.();
  });

  it('extracted exactly 10 non-vosotros cells (raw table order, not the deck order)', () => {
    expect(cells).toHaveLength(10);
    expect(cells[0]).toMatchObject({ person: 'yo', verb: 'ser', answer: 'soy' });
  });

  it('shows the first cell in the seeded-shuffle order, its "person · verb" caption, and the TABLE chip', async () => {
    const view = render(<TableDeckScreen />);
    await flush();

    expect(screen.getByText('person · verb')).toBeTruthy();
    expect(screen.getByText('TABLE')).toBeTruthy();
    expect(screen.getByText(`${cellAt(0).person} · ${cellAt(0).verb}`)).toBeTruthy();
    expect(screen.getByText('0 / 10 done')).toBeTruthy();

    view.unmount();
  });

  it('a correct answer marks the cell green and done, a wrong one reveals the answer and comes back later, and progress persists across a remount', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const view = render(<TableDeckScreen />);
    await flush();

    // Wrong on the first deck cell: the diff line and the correct answer
    // show, no "done" progress yet.
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'nope');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByText(cellAt(0).answer)).toBeTruthy();
    expect(screen.getByText('0 / 10 done')).toBeTruthy();
    fireEvent.press(screen.getByText('Next →'));
    await flush();

    // Cooldown: the next cell shown is the deck's second cell, not the first again.
    expect(screen.getByText(`${cellAt(1).person} · ${cellAt(1).verb}`)).toBeTruthy();

    // Correct on that second cell: green "✓ <answer>", progress advances to 1/10.
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), cellAt(1).answer);
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByText(`✓ ${cellAt(1).answer}`)).toBeTruthy();
    fireEvent.press(screen.getByText('Next →'));
    await flush();
    expect(screen.getByText('1 / 10 done')).toBeTruthy();

    view.unmount();

    // Remount (tab switch / app restart): the persisted state comes back,
    // showing the deck's third cell next (the first two are settled), not
    // starting over, and the SAME order (reset count still 0).
    const view2 = render(<TableDeckScreen />);
    await flush();
    expect(screen.getByText('1 / 10 done')).toBeTruthy();
    expect(screen.getByText(`${cellAt(2).person} · ${cellAt(2).verb}`)).toBeTruthy();
    view2.unmount();
  });

  it('finishing every cell shows the completion screen, and "Start again" resets and reshuffles the deck', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    render(<TableDeckScreen />);
    await flush();

    // Fail the first deck cell once, then answer every other cell correctly
    // in the order the screen actually shows them (its cooldown pushes it
    // behind the rest, until it is the only one left, "learn ahead").
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'nope');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    fireEvent.press(screen.getByText('Next →'));
    await flush();

    for (let i = 1; i < deckOrder.length; i++) {
      expect(screen.getByText(`${cellAt(i).person} · ${cellAt(i).verb}`)).toBeTruthy();
      await answerCurrent(cellAt(i).answer);
    }

    // Only the first deck cell is left; shown despite its cooldown because
    // nothing else remains, and answering it correctly finishes the deck.
    expect(screen.getByText(`${cellAt(0).person} · ${cellAt(0).verb}`)).toBeTruthy();
    await answerCurrent(cellAt(0).answer);

    expect(screen.getByText('All 10 cells done 🎉')).toBeTruthy();

    fireEvent.press(screen.getByText('Start again'));
    await flush();

    // A fresh pass (reset count 1) gets a different, still deterministic,
    // shuffle; recompute it the same way instead of assuming it matches pass 0.
    const nextOrder = shuffleArray(cells.map((c) => c.id).sort(), hashString('ser-estar:1'));
    const nextFirst = cells.find((c) => c.id === nextOrder[0])!;
    expect(screen.getByText('0 / 10 done')).toBeTruthy();
    expect(screen.getByText(`${nextFirst.person} · ${nextFirst.verb}`)).toBeTruthy();
  });
});
