// The "XP today" chip in the Learn tab header: "XP 20/50" (EN and ES), "XP 63 ✓" after the
// goal, the screen-reader label, the points a grade adds ("Knew it" new 3, review 2, "Didn't know" 0),
// the midnight reset and the undo. Mock pattern: pcicResume.test.tsx.

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
import { __resetForTests } from '@/lib/dailyXp';
import { setLanguage } from '@/lib/i18n';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { addDays, sm2NewCard } from '@/lib/sm2';
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

// Reveal the card, then tap one of the two grade buttons (the tap decides, whatever was typed).
const gradeCard = async (screen: ReturnType<typeof render>, label: "Knew it" | "Didn't know") => {
  fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'xyz');
  fireEvent.press(screen.getByText('✓ Check'));
  await flush();
  fireEvent.press(screen.getByText(label));
  await flush();
};

describe('Learn tab: XP today chip', () => {
  const today = localDateString();

  beforeEach(async () => {
    __resetForTests();
    setLanguage('en');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setPcicNewBonus(0, today);
    await getDb().setPcicLevel('A1');
    await getDb().addDailyXp(today, -1000);
    await getDb().addDailyXp(addDays(today, -1), -1000);
  });

  afterEach(() => setLanguage('en'));

  it('shows XP 0/50 on a fresh day, with the screen-reader label in English', async () => {
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('XP 0/50')).toBeTruthy();
    expect(screen.getByLabelText('XP today: 0 of 50')).toBeTruthy();
  });

  it('shows the saved XP of today as XP 20/50 and the Spanish label in Spanish', async () => {
    await getDb().addDailyXp(today, 20);
    setLanguage('es');
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('XP 20/50')).toBeTruthy();
    expect(screen.getByLabelText('XP de hoy: 20 de 50')).toBeTruthy();
  });

  it('after the goal the chip reads XP 63 ✓', async () => {
    await getDb().addDailyXp(today, 63);
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('XP 63 ✓')).toBeTruthy();
    expect(screen.getByLabelText('XP today: 63 of 50')).toBeTruthy();
  });

  it('yesterday\'s XP does not count today (midnight reset)', async () => {
    await getDb().addDailyXp(addDays(today, -1), 45);
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('XP 0/50')).toBeTruthy();
  });

  it('"Knew it" on a new word adds 3, "Didn\'t know" adds nothing', async () => {
    const screen = render(<PcicScreen />);
    await flush();
    await gradeCard(screen, "Didn't know");
    expect(screen.getByText('XP 0/50')).toBeTruthy();
    await gradeCard(screen, 'Knew it');
    expect(screen.getByText('XP 3/50')).toBeTruthy();
    expect(await getDb().getDailyXp(today)).toBe(3);
  });

  it('"Knew it" on a review card adds 2', async () => {
    // a1-w0 was learned three days ago and is due today: a review
    await getDb().upsertPcicCard({
      ...sm2NewCard('a1-w0'),
      state: 'review',
      interval: 2,
      reps: 2,
      due: today,
      lastReview: addDays(today, -2),
      introducedAt: addDays(today, -3),
    });
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.queryByText('a1word0')).toBeTruthy();
    await gradeCard(screen, 'Knew it');
    expect(screen.getByText('XP 2/50')).toBeTruthy();
  });

  it('undo takes the grade\'s XP back', async () => {
    const screen = render(<PcicScreen />);
    await flush();
    await gradeCard(screen, 'Knew it');
    expect(screen.getByText('XP 3/50')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Undo'));
    await flush();
    expect(screen.getByText('XP 0/50')).toBeTruthy();
    expect(await getDb().getDailyXp(today)).toBe(0);
  });
});
