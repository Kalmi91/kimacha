// Card-level resume: when the app is reopened, the Learn round continues where it stopped: the same
// card is up next, the missed ("again") card stays in its place (does not jump ahead), and the bar of the "+N new words" batch
// stays at the same point. Reopening = unmount + render again (the DB stays, like persisted SQLite). Mock pattern:
// pcicMoreNewSteps.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const mkItems = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-w${i}`,
    es: `${prefix}palabra${i}`,
    en: `${prefix}word${i}`,
    kind: 'word' as const,
    section: 'Test',
    order: i,
  }));
const mockA1Items = mkItems('a1', 50);
const mockB1Items = mkItems('b1', 100);
const mockItemsByLevel: Record<string, ReturnType<typeof mkItems>> = { A1: mockA1Items, B1: mockB1Items };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1', 'B1'],
  PCIC_VIEW_LEVELS: ['A1', 'B1'],
  pcicItemsForLevel: (level: string) => mockItemsByLevel[level] ?? [],
  findPcicItem: (id: string) => [...mockA1Items, ...mockB1Items].find((i) => i.id === id),
  levelOfItem: (id: string) => (id.startsWith('a1-') ? 'A1' : id.startsWith('b1-') ? 'B1' : undefined),
  setPcicTarget: () => {},
}));

import { StyleSheet, TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { buildLearnResume, saveLearnResume } from '@/lib/learnResume';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { sm2NewCard, sm2Review } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import PcicScreen from '../index';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// In the mock corpus the prompt is the English word: "a1word<i>".
const promptShown = (screen: ReturnType<typeof render>, i: number) => screen.queryByText(`a1word${i}`) !== null;

describe('PCIC tab: on reopening, the round resumes where it left off', () => {
  const today = localDateString();

  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setPcicNewBonus(0, today);
    await getDb().setPcicLevel('A1');
  });

  it('the missed card stays in place: the current card is the same after reopening (the missed one does not jump ahead)', async () => {
    const first = render(<PcicScreen />);
    await flush();
    expect(promptShown(first, 0)).toBe(true);

    // a0: missed ("Didn't know"): goes to the end of the queue, with a timer; a1 is the card that is up next
    fireEvent.changeText(first.UNSAFE_getByType(TextInput), 'xyz');
    fireEvent.press(first.getByText('✓ Check'));
    await flush();
    fireEvent.press(first.getByText("Next → Didn't know"));
    await flush();
    expect(promptShown(first, 1)).toBe(true);
    first.unmount();

    // reopening: the normal rebuild would put the missed (learning) a0 at the START of the queue
    const second = render(<PcicScreen />);
    await flush();
    expect(promptShown(second, 1)).toBe(true);
    expect(promptShown(second, 0)).toBe(false);
  });

  it('the "+N new words" batch bar stays in the same place after reopening', async () => {
    for (const item of mockA1Items.slice(0, 10)) await getDb().upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', today));
    const first = render(<PcicScreen />);
    await flush();
    fireEvent.press(first.getByTestId('learn-more-new-5'));
    await flush();
    for (let i = 0; i < 2; i++) {
      fireEvent.press(first.getByText("Don't learn this"));
      await flush();
    }
    const before = StyleSheet.flatten(first.getByTestId('learn-progress-fill').props.style).width;
    expect(parseFloat(before as string)).toBeCloseTo((2 / 4) * 100, 1); // 2 done, 3 to go: 2 / (5 - 1)
    first.unmount();

    const second = render(<PcicScreen />);
    await flush();
    expect(StyleSheet.flatten(second.getByTestId('learn-progress-fill').props.style).width).toBe(before);
  });

  it('a save left over from another day is discarded: the queue is built the normal way', async () => {
    const stale = mockA1Items.slice(0, 5).map((i) => sm2NewCard(i.id)).reverse();
    await saveLearnResume(getDb(), buildLearnResume(stale, '2000-01-01', 'A1', null));
    const screen = render(<PcicScreen />);
    await flush();
    expect(promptShown(screen, 0)).toBe(true);
  });

  it('a save made on another level is not valid for the active level', async () => {
    const other = mockA1Items.slice(0, 5).map((i) => sm2NewCard(i.id)).reverse();
    await saveLearnResume(getDb(), buildLearnResume(other, today, 'B1', null));
    const screen = render(<PcicScreen />);
    await flush();
    expect(promptShown(screen, 0)).toBe(true);
  });

  it('a saved card that no longer exists is dropped, the normal queue continues', async () => {
    const ghost = { ...sm2NewCard('a1-nincs-ilyen') };
    await saveLearnResume(getDb(), buildLearnResume([ghost, sm2NewCard(mockA1Items[3].id)], today, 'A1', null));
    const screen = render(<PcicScreen />);
    await flush();
    // the saved (existing) a1-w3 comes first, the non-existent one is skipped; no stall
    expect(promptShown(screen, 3)).toBe(true);
    fireEvent.press(screen.getByText("Don't learn this"));
    await flush();
    expect(promptShown(screen, 0)).toBe(true);
  });

  it('a saved card that is no longer due (rated today) is dropped: the normal queue continues', async () => {
    await getDb().upsertPcicCard(sm2Review(sm2NewCard(mockA1Items[0].id), 'good', today));
    await saveLearnResume(getDb(), buildLearnResume([sm2NewCard(mockA1Items[0].id), sm2NewCard(mockA1Items[1].id)], today, 'A1', null));
    const screen = render(<PcicScreen />);
    await flush();
    expect(promptShown(screen, 0)).toBe(false);
    expect(promptShown(screen, 1)).toBe(true);
  });
});
