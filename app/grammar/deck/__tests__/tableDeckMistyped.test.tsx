// end-to-end playthrough of the table-deck screen
// on the real ser-estar lesson (2 conjugation tables, 10 cells after
// vosotros is dropped). Mock pattern from
// app/grammar/__tests__/lessonV2.play.test.tsx and
// app/(tabs)/__tests__/pcicCardShell.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { tableCellsForLesson } from '@/lib/grammar/tableDeck';
import TableDeckScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

const cells = tableCellsForLesson(lessonFor('es', 'ser-estar')!);

// the 1st round (and "Start again") again comes in the
// table/source order, so the screen shows the `cells` array's own
// order; there is no shuffle to recompute for pass 0.
const tableOrder = cells.map((c) => c.id);
const cellAt = (i: number) => cells.find((c) => c.id === tableOrder[i])!;

describe('table-deck screen: "I mistyped" (FB723)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'ser-estar:tabledeck', 'progress', { cells: [], resetCount: 0, shuffled: false });
  });

  it('no mistyped button before Check or after a right answer', async () => {
    const view = render(<TableDeckScreen />);
    await flush();
    expect(screen.queryByTestId('grammar-mistyped')).toBeNull();
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), cellAt(0).answer);
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.queryByTestId('grammar-mistyped')).toBeNull();
    const box = StyleSheet.flatten(screen.getByTestId('tabledeck-result').props.style);
    expect(within(screen.getByTestId('tabledeck-result')).getByTestId('tabledeck-result-badge')).toBeTruthy();
    expect(box.borderColor).toBe(Colors.dark.success);
    expect(box.borderStyle).toBe('solid');
    view.unmount();
  });

  it('after a wrong answer the button counts it as done and moves on', async () => {
    const view = render(<TableDeckScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'nope');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByText('0 / 10 done')).toBeTruthy();
    const box = StyleSheet.flatten(screen.getByTestId('tabledeck-result').props.style);
    expect(within(screen.getByTestId('tabledeck-result')).getByTestId('tabledeck-result-badge')).toBeTruthy();
    expect(box.borderColor).toBe(Colors.dark.danger);
    expect(box.borderStyle).toBe('dashed');
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    await flush();
    expect(screen.getByText('1 / 10 done')).toBeTruthy();
    expect(screen.queryByTestId('grammar-mistyped')).toBeNull();
    view.unmount();
  });
});
