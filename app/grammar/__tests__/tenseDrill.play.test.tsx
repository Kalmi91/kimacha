// The German tense drill, walked the way a learner walks it: the Grammar tab of the German course offers it (the Spanish
// course does not), the setup offers the levels and the tenses a level teaches, a round asks "person · verb" in a tense, the
// typed form is graded strictly for the umlaut and the ß, a wrong answer shows the right one, and the round ends with a result.

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
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({}),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { setLanguage } from '@/lib/i18n';
import { speak } from '@/lib/speech';
import { buildTenseRound } from '@/lib/games/deTenseDrill';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import TenseDrillScreen from '../tense-drill';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);
const NOW = 1_700_000_000_000;

async function open(source: 'en' | 'es' | 'hu', level = 'A1') {
  const db = getDb();
  await db.setOnboarding(source, 'de');
  setLanguage(source);
  (db as any).__setLevelForTest(level);
  render(<TenseDrillScreen />);
  await flush(4);
}

const answer = async (typed: string) => {
  fireEvent.changeText(screen.getByTestId('tensedrill-input'), typed);
  fireEvent.press(screen.getByTestId('tensedrill-dock'));
  await flush();
};
const next = async () => {
  fireEvent.press(screen.getByTestId('tensedrill-dock'));
  await flush();
};

describe('the German tense drill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    setLanguage('en');
  });

  it('is offered by the German course only', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'de');
    (db as any).__setLevelForTest('A1');
    const de = render(<GrammarSyllabusScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-tense-drill-start'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/tense-drill');
    de.unmount();

    await db.setOnboarding('en', 'es');
    render(<GrammarSyllabusScreen />);
    await flush(4);
    expect(screen.queryByTestId('grammar-tense-drill-start')).toBeNull();
  });

  it('the setup starts on the learner\'s level and offers only the tenses the level teaches', async () => {
    await open('en', 'A1');
    expect(screen.getByTestId('tensedrill-level-A1').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('tensedrill-tense-praesens')).toBeTruthy();
    expect(screen.getByTestId('tensedrill-tense-perfekt')).toBeTruthy();
    expect(screen.queryByTestId('tensedrill-tense-praeteritum')).toBeNull();
    expect(screen.queryByTestId('tensedrill-tense-konjunktiv2')).toBeNull();

    fireEvent.press(screen.getByTestId('tensedrill-level-B1'));
    for (const tense of ['praesens', 'perfekt', 'praeteritum', 'futur1', 'konjunktiv2']) expect(screen.getByTestId(`tensedrill-tense-${tense}`)).toBeTruthy();

    // a tense the new level does not teach is dropped from the choice
    fireEvent.press(screen.getByTestId('tensedrill-tense-konjunktiv2'));
    fireEvent.press(screen.getByTestId('tensedrill-level-A1'));
    expect(screen.getByTestId('tensedrill-tense-mixed').props.accessibilityState.selected).toBe(true);
  });

  it('plays a round: the right form passes, a wrong one shows the right one, the result counts', async () => {
    await open('es', 'A1');
    fireEvent.press(screen.getByTestId('tensedrill-tense-praesens'));
    fireEvent.press(screen.getByTestId('tensedrill-begin'));
    await flush(4);

    const round = buildTenseRound({ level: 'A1', tense: 'praesens', seed: NOW % 2147483647 });
    expect(round).toHaveLength(10);
    expect(screen.getByTestId('tensedrill-prompt')).toBeTruthy();
    expect(screen.getByText(`${round[0].personLabel} · ${round[0].infinitive}`)).toBeTruthy();
    expect(screen.getByText('1 / 10')).toBeTruthy();

    // the first one right, with the pronoun left out (allowed), then the rest right, but the third wrong
    for (let i = 0; i < round.length; i++) {
      const wrong = i === 2;
      await answer(wrong ? 'ich xyz' : i === 0 ? round[i].answer.split(' ').slice(1).join(' ') : round[i].answer);
      if (wrong) {
        expect(screen.getByTestId('tensedrill-answer').props.children).toBe(round[i].answer);
        expect(speak).toHaveBeenCalledWith(round[i].answer, 'de-DE');
      } else {
        expect(screen.getByTestId('tensedrill-correct')).toBeTruthy();
      }
      await next();
    }
    expect(screen.getByTestId('tensedrill-result').props.children).toBe('9 de 10 correctas');
    fireEvent.press(screen.getByTestId('tensedrill-again'));
    await flush(4);
    expect(screen.getByText('1 / 10')).toBeTruthy();
  });

  it('grades the umlaut: a form without its dots is wrong', async () => {
    await open('en', 'A1');
    fireEvent.press(screen.getByTestId('tensedrill-tense-praesens'));
    fireEvent.press(screen.getByTestId('tensedrill-begin'));
    await flush(4);
    const round = buildTenseRound({ level: 'A1', tense: 'praesens', seed: NOW % 2147483647 });
    // walk to the first question whose answer has an umlaut or ß, answering the ones before it right
    const at = round.findIndex((q) => /[äöüß]/.test(q.answer));
    expect(at).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < at; i++) {
      await answer(round[i].answer);
      await next();
    }
    const stripped = round[at].answer.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 's');
    await answer(stripped);
    expect(screen.queryByTestId('tensedrill-correct')).toBeNull();
    expect(screen.getByTestId('tensedrill-answer')).toBeTruthy();
  });
});
