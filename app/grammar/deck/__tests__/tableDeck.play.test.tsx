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
import TableDeckScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const cells = tableCellsForLesson(lessonFor('es', 'ser-estar')!);

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

  it('extracted exactly 10 non-vosotros cells, starting with yo · ser', () => {
    expect(cells).toHaveLength(10);
    expect(cells[0]).toMatchObject({ person: 'yo', verb: 'ser', answer: 'soy' });
  });

  it('shows the first cell, its "person · verb" caption, and the TABLE chip', async () => {
    const view = render(<TableDeckScreen />);
    await flush();

    expect(screen.getByText('person · verb')).toBeTruthy();
    expect(screen.getByText('TABLE')).toBeTruthy();
    expect(screen.getByText('yo · ser')).toBeTruthy();
    expect(screen.getByText('0 / 10 done')).toBeTruthy();

    view.unmount();
  });

  it('a correct answer marks the cell green and done, a wrong one reveals the answer and comes back later, and progress persists across a remount', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const view = render(<TableDeckScreen />);
    await flush();

    // Wrong on cell 0 (yo · ser): the diff line and the correct answer show,
    // no "done" progress yet.
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'nope');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByText('soy')).toBeTruthy();
    expect(screen.getByText('0 / 10 done')).toBeTruthy();
    fireEvent.press(screen.getByText('Next →'));
    await flush();

    // Cooldown: the next cell shown is cell 1 (tú · ser), not cell 0 again.
    expect(screen.getByText('tú · ser')).toBeTruthy();

    // Correct on cell 1: green "✓ eres", progress advances to 1/10.
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), cells[1].answer);
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByText(`✓ ${cells[1].answer}`)).toBeTruthy();
    fireEvent.press(screen.getByText('Next →'));
    await flush();
    expect(screen.getByText('1 / 10 done')).toBeTruthy();

    view.unmount();

    // Remount (tab switch / app restart): the persisted state comes back,
    // showing cell 2 next (0 and 1 are settled), not starting over at cell 0.
    const view2 = render(<TableDeckScreen />);
    await flush();
    expect(screen.getByText('1 / 10 done')).toBeTruthy();
    expect(screen.getByText(`${cells[2].person} · ${cells[2].verb}`)).toBeTruthy();
    view2.unmount();
  });

  it('finishing every cell shows the completion screen, and "Start again" resets the whole deck', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    render(<TableDeckScreen />);
    await flush();

    // Fail cell 0 once, then answer every other cell correctly in the order
    // the screen actually shows them (cell 0's cooldown pushes it behind the
    // rest, until it is the only one left, per the "learn ahead" rule).
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'nope');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    fireEvent.press(screen.getByText('Next →'));
    await flush();

    for (let i = 1; i < cells.length; i++) {
      expect(screen.getByText(`${cells[i].person} · ${cells[i].verb}`)).toBeTruthy();
      await answerCurrent(cells[i].answer);
    }

    // Only cell 0 is left; shown despite its cooldown because nothing else
    // remains, and answering it correctly finishes the deck.
    expect(screen.getByText('yo · ser')).toBeTruthy();
    await answerCurrent(cells[0].answer);

    expect(screen.getByText('All 10 cells done 🎉')).toBeTruthy();

    fireEvent.press(screen.getByText('Start again'));
    await flush();

    expect(screen.getByText('0 / 10 done')).toBeTruthy();
    expect(screen.getByText('yo · ser')).toBeTruthy();
  });
});
