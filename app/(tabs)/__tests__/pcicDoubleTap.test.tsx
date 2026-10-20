// Double tap on a grade button of the Learn tab: two taps in a row, before the first grade's
// awaits (upsertPcicCard, updateStreak, addXp) finish, must grade the card once: one DB write and
// the XP once. Mock pattern: pcicXpChip.test.tsx.

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

const mockItems = Array.from({ length: 30 }, (_, i) => ({
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
  pcicItemsForLevel: (level: string) => (level === 'A1' ? mockItems : []),
  findPcicItem: (id: string) => mockItems.find((i) => i.id === id),
  levelOfItem: (id: string) => (id.startsWith('a1-') ? 'A1' : undefined),
  setPcicTarget: () => {},
}));

import { TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { __resetBetaForTest } from '@/lib/beta';
import { __resetForTests } from '@/lib/dailyXp';
import { setLanguage } from '@/lib/i18n';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { addDays } from '@/lib/sm2';
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

describe('Learn tab: double tap on a grade button', () => {
  const today = localDateString();

  beforeEach(async () => {
    __resetForTests();
    __resetBetaForTest();
    await getDb().setBetaFlag('xpV2', false);
    setLanguage('en');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setPcicNewBonus(0, today);
    await getDb().setPcicLevel('A1');
    await getDb().addDailyXpTenths(today, -10000);
    await getDb().addDailyXpTenths(addDays(today, -1), -10000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setLanguage('en');
  });

  it('two quick "Knew it" taps grade the card once: one DB write, XP 3 not 6', async () => {
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'xyz');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    const upsert = jest.spyOn(getDb(), 'upsertPcicCard');
    const knew = screen.getByText('Knew it');
    fireEvent.press(knew);
    fireEvent.press(knew);
    await flush();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(screen.getByText('XP 3/50')).toBeTruthy();
    expect(await getDb().getDailyXpTenths(today)).toBe(30);
  });
});
