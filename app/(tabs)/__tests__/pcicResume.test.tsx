// FB470 (kártya-szintű folytatás): az app újranyitásakor a Learn-kör ott folytatódik, ahol abbamaradt: ugyanaz a
// soron lévő kártya, a rontott ("again") kártya a helyén (nem előre ugrik), a "+N új szó" adag csíkja ugyanott
// áll. Az újranyitás = unmount + újra render (a DB marad, mint a perzisztált SQLite). Mock-minta:
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  LEVEL_LABELS: { A1: 'Beginner', B1: 'Intermediate' },
  pcicItemsForLevel: (level: string) => mockItemsByLevel[level] ?? [],
  pcicItemsForViewLevel: (level: string) => mockItemsByLevel[level] ?? [],
  findPcicItem: (id: string) => [...mockA1Items, ...mockB1Items].find((i) => i.id === id),
  levelOfItem: (id: string) => (id.startsWith('a1-') ? 'A1' : id.startsWith('b1-') ? 'B1' : undefined),
  isPlusSentence: () => false,
  realLevelOfView: (level: string) => level,
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

// A mock-korpuszban a prompt az angol szó: "a1word<i>".
const promptShown = (screen: ReturnType<typeof render>, i: number) => screen.queryByText(`a1word${i}`) !== null;

describe('PCIC fül: a kör újranyitáskor ott folytatódik, ahol abbamaradt (FB470)', () => {
  const today = localDateString();

  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setPcicNewBonus(0, today);
    await getDb().setPcicLevel('A1');
  });

  it('a rontott kártya a helyén marad: a soron lévő kártya újranyitás után ugyanaz (nem a rontott ugrik előre)', async () => {
    const first = render(<PcicScreen />);
    await flush();
    expect(promptShown(first, 0)).toBe(true);

    // a0: rontott ("Didn't know"): a sor végére megy, időzítővel; a1 a soron lévő kártya
    fireEvent.changeText(first.UNSAFE_getByType(TextInput), 'xyz');
    fireEvent.press(first.getByText('✓ Check'));
    await flush();
    fireEvent.press(first.getByText("Next → Didn't know"));
    await flush();
    expect(promptShown(first, 1)).toBe(true);
    first.unmount();

    // újranyitás: a normál újraépítés a rontott (learning) a0-t a sor ELEJÉRE tenné
    const second = render(<PcicScreen />);
    await flush();
    expect(promptShown(second, 1)).toBe(true);
    expect(promptShown(second, 0)).toBe(false);
  });

  it('a "+N új szó" adag csíkja újranyitás után ugyanott áll', async () => {
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
    expect(parseFloat(before as string)).toBeCloseTo((2 / 4) * 100, 1); // 2 kész, 3 hátra: 2 / (5 - 1)
    first.unmount();

    const second = render(<PcicScreen />);
    await flush();
    expect(StyleSheet.flatten(second.getByTestId('learn-progress-fill').props.style).width).toBe(before);
  });

  it('másik napról maradt mentés eldobódik: a sor a normál úton épül', async () => {
    const stale = mockA1Items.slice(0, 5).map((i) => sm2NewCard(i.id)).reverse();
    await saveLearnResume(getDb(), buildLearnResume(stale, '2000-01-01', 'A1', null));
    const screen = render(<PcicScreen />);
    await flush();
    expect(promptShown(screen, 0)).toBe(true);
  });

  it('másik szinten készült mentés nem érvényes az aktív szintre', async () => {
    const other = mockA1Items.slice(0, 5).map((i) => sm2NewCard(i.id)).reverse();
    await saveLearnResume(getDb(), buildLearnResume(other, today, 'B1', null));
    const screen = render(<PcicScreen />);
    await flush();
    expect(promptShown(screen, 0)).toBe(true);
  });

  it('a mentett, de már nem létező kártya kiesik, a normál sor megy tovább', async () => {
    const ghost = { ...sm2NewCard('a1-nincs-ilyen') };
    await saveLearnResume(getDb(), buildLearnResume([ghost, sm2NewCard(mockA1Items[3].id)], today, 'A1', null));
    const screen = render(<PcicScreen />);
    await flush();
    // a mentett (létező) a1-w3 jön előre, a nem létező kihagyva; nincs elakadás
    expect(promptShown(screen, 3)).toBe(true);
    fireEvent.press(screen.getByText("Don't learn this"));
    await flush();
    expect(promptShown(screen, 0)).toBe(true);
  });

  it('a mentett kártya, ami már nem esedékes (ma értékelt), kiesik: a normál sor megy tovább', async () => {
    await getDb().upsertPcicCard(sm2Review(sm2NewCard(mockA1Items[0].id), 'good', today));
    await saveLearnResume(getDb(), buildLearnResume([sm2NewCard(mockA1Items[0].id), sm2NewCard(mockA1Items[1].id)], today, 'A1', null));
    const screen = render(<PcicScreen />);
    await flush();
    expect(promptShown(screen, 0)).toBe(false);
    expect(promptShown(screen, 1)).toBe(true);
  });
});
