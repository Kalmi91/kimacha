// Leaving the Practice tab and coming back (blur, then focus) keeps the round: the same sentence and order, the
// same counter, the "Correct!" pause still moves on, and a finished round stays on its score screen.
// Mock pattern: practice.test.tsx, with a useFocusEffect that can be fired again.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    mockFocus = cb;
    useEffect(cb, []);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
jest.mock('@/lib/practice/halfStep', () => {
  const actual = jest.requireActual('@/lib/practice/halfStep');
  return { ...actual, recordPracticeResult: jest.fn(actual.recordPracticeResult) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { __resetBetaForTest } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import PracticeScreen from '../practice';

jest.setTimeout(30000);

const mockRecord = recordPracticeResult as jest.Mock;
const TODAY = localDateString();

// Real words-open cards: o33 ir "Voy con ella." (Voy), o47 hablar "Hablo con mi madre." (Hablo),
// o23 querer "Quiero una casa." (Quiero), o4 tú "Tú estás bien." (Tú).
const learned = (itemId: string, due: string, over: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due,
  lastReview: '2000-01-01',
  introducedAt: '2000-01-01',
  ...over,
});

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const mount = async () => {
  const view = render(<ThemeProvider><PracticeScreen /></ThemeProvider>);
  await flush();
  return view;
};

type View = Awaited<ReturnType<typeof mount>>;

const answer = async (view: View, text: string) => {
  fireEvent.changeText(view.getByTestId('practice-input'), text);
  fireEvent.press(view.getByTestId('practice-action'));
  await flush();
};
// A right answer moves on by itself after the short feedback.
const afterPause = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await flush();
};

beforeEach(async () => {
  jest.useFakeTimers();
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setStrictAccents(false);
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(TODAY, -100000);
  mockRecord.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage('en');
});


// The tab loses focus and gets it back: the focus effect runs again.
const refocus = async () => {
  await act(async () => {
    mockFocus?.();
  });
  await flush();
};
const sentence = (view: View) => String(view.getByTestId('practice-translation').props.children);

const seedFour = async () => {
  await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
  await getDb().upsertPcicCard(learned('o47', '2000-01-02'));
  await getDb().upsertPcicCard(learned('o23', '2000-01-03'));
  await getDb().upsertPcicCard(learned('o4', '2000-01-04'));
};

describe('Practice tab keeps its round across blur and focus', () => {
  it('2 answers done: after blur and focus the same sentence, the same order and the same counter', async () => {
    await seedFour();
    const view = await mount();
    await answer(view, 'voy');
    await afterPause();
    await answer(view, 'Hablo');
    await afterPause();
    expect(view.getByText('3/4')).toBeTruthy();
    const before = sentence(view);

    await refocus();

    expect(view.getByText('3/4')).toBeTruthy();
    expect(sentence(view)).toBe(before);
    // the rest of the round comes in the same order: the answers of o23 and o4 are right only in that order
    await answer(view, 'Quiero');
    await afterPause();
    await answer(view, 'Tú');
    await afterPause();
    expect(view.getByText('4 of 4 right')).toBeTruthy();
    view.unmount();
  });

  it('blur during the "Correct!" pause: the round still moves on to the next sentence', async () => {
    await seedFour();
    const view = await mount();
    await answer(view, 'voy');
    expect(view.getByText('Correct!')).toBeTruthy();

    await refocus();
    expect(view.getByText('Correct!')).toBeTruthy();
    await afterPause();

    expect(view.getByText('2/4')).toBeTruthy();
    expect(view.getByText('I talk with my mother.')).toBeTruthy();
    view.unmount();
  });

  it('a finished round stays on its score screen after blur and focus', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    await answer(view, 'voy');
    await afterPause();
    expect(view.getByText('Round done')).toBeTruthy();

    await refocus();

    expect(view.getByText('Round done')).toBeTruthy();
    expect(view.getByText('1 of 1 right')).toBeTruthy();
    view.unmount();
  });
});
