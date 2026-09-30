// FB380 -> FB415 / FB420 / FB421 (PLAN-fb0929 4. lépés, Kálmán 2026-09-29):
//  - FB415: a lecke %-a az ÖSSZES feladat-fajta átlaga, a meg nem csinált 0;
//    a lecke-lista és a lecke-képernyő ugyanazt a számot adja (lessonScore).
//  - FB420: a párosítás részpontot kap (1 hiba 6 párból = 5/6, nem 0).
//  - FB421: a félbehagyott feladat elmentődik ("3/10 · 20%"), újranyitva onnan
//    folytatódik, a jobb eredmény felülírja a régit.

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
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { hashString, shuffleArray } from '@/lib/shuffle';
import { GRAMMAR_PROGRESS_KEY, lessonKinds } from '@/lib/grammar/syllabus';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// ser-estar's se-match-01 has 6 pairs; the right column order is a seeded
// shuffle of the pair indices, keyed by the item's own id (GrammarDrill.tsx
// MatchDrillItem), so it is exactly reproducible here.
const RIGHT_ORDER = shuffleArray([0, 1, 2, 3, 4, 5], hashString('se-match-01'));

// ser-estar's 12 form items minus the 2 vosotros ones (se-form-09/10,
// FB357), in authored order, buildGrammarRound does not shuffle form items.
const FORM_ANSWERS = ['soy', 'estoy', 'eres', 'estás', 'es', 'está', 'somos', 'estamos', 'son', 'están'];

const KIND_COUNT = lessonKinds('es', 'ser-estar').length;

async function solveMatch(wrongFirst = false) {
  if (wrongFirst) {
    // az 1. bal (0. pár) egy rossz jobbal: az a pár elveszik
    const wrongPos = RIGHT_ORDER.findIndex((p) => p !== 0);
    fireEvent.press(screen.getByTestId('match-left-0'));
    fireEvent.press(screen.getByTestId(`match-right-${wrongPos}`));
  }
  for (let li = 0; li < 6; li++) {
    fireEvent.press(screen.getByTestId(`match-left-${li}`));
    fireEvent.press(screen.getByTestId(`match-right-${RIGHT_ORDER.indexOf(li)}`));
  }
  fireEvent.press(screen.getByTestId('grammar-next'));
  await flush(1);
}

async function answerForm(i: number, right: boolean) {
  fireEvent.changeText(screen.getByTestId('formInput'), right ? FORM_ANSWERS[i] : 'xxx');
  fireEvent.press(screen.getByTestId('formCheck'));
  await flush(1);
  fireEvent.press(screen.getByTestId('grammar-next'));
  await flush(1);
}

async function clearProgress() {
  const db = getDb();
  await db.setOnboarding('en', 'es');
  (db as any).__setLevelForTest('A1');
  // tiszta lap: a web DB memóriában él a tesztek között
  for (const kind of ['choice', 'match', 'form', 'why', 'transform']) {
    for (const suffix of ['best', 'run', 'answered', 'correct']) {
      await db.setGameProgress(GRAMMAR_PROGRESS_KEY, `ser-estar:${kind}:${suffix}`, 'cleared', null);
    }
  }
}

describe('grammar lesson screen: lesson % = average of ALL kinds (FB415)', () => {
  beforeEach(clearProgress);

  it('one perfect kind out of several is NOT 100% for the lesson', async () => {
    expect(KIND_COUNT).toBeGreaterThan(1);
    render(<GrammarLessonScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-kind-percent-match')).toBeNull();

    fireEvent.press(screen.getByTestId('grammar-start-match'));
    await flush(1);
    await solveMatch();

    // 6/6 pár = 100% a fajtára, de a lecke átlaga az összes fajtán: 100 / KIND_COUNT
    expect(screen.getByTestId('grammar-lesson-percent')).toHaveTextContent(`So far: ${Math.round(100 / KIND_COUNT)}% correct`);
    fireEvent.press(screen.getByText('Read the rule again'));
    await flush(1);
    expect(screen.getByTestId('grammar-kind-percent-match')).toHaveTextContent('So far: 100% correct');
    expect(screen.queryByTestId('grammar-kind-percent-form')).toBeNull();
  });

  it('a match with one wrong pair out of six scores 5/6 = 83%, not 0 (FB420)', async () => {
    render(<GrammarLessonScreen />);
    await flush(4);

    fireEvent.press(screen.getByTestId('grammar-start-match'));
    await flush(1);
    await solveMatch(true);

    fireEvent.press(screen.getByText('Read the rule again'));
    await flush(1);
    expect(screen.getByTestId('grammar-kind-percent-match')).toHaveTextContent('So far: 83% correct');
  });
});

describe('grammar lesson screen: a half-done round is saved and resumed (FB421)', () => {
  beforeEach(clearProgress);

  it('shows "3/10 · 20%" for 2 right of 3 answered, resumes at item 4, and a weaker restart does not lower the best', async () => {
    render(<GrammarLessonScreen />);
    await flush(4);

    fireEvent.press(screen.getByTestId('grammar-start-form'));
    await flush(1);
    await answerForm(0, true);
    await answerForm(1, true);
    await answerForm(2, false);

    // ✕: vissza a leckéhez, a kör félbe marad
    fireEvent.press(screen.getByText('←'));
    await flush(1);
    expect(screen.getByTestId('grammar-kind-percent-form')).toHaveTextContent('3/10 · 20%');

    // újranyitva a 4. tételnél folytatja
    fireEvent.press(screen.getByTestId('grammar-start-form'));
    await flush(1);
    expect(screen.getByTestId('grammar-drill-progress')).toHaveTextContent('4 / 10');
    for (let i = 3; i < 10; i++) await answerForm(i, true);

    // 9/10 = 90%: a kör vége, a fajta legjobbja
    expect(screen.getByText('9 / 10')).toBeTruthy();
    fireEvent.press(screen.getByText('Read the rule again'));
    await flush(1);
    expect(screen.getByTestId('grammar-kind-percent-form')).toHaveTextContent('So far: 90% correct');

    // új, gyengébb kör félig: a sor a saját állását mutatja, de a fajta legjobbja nem romlik
    fireEvent.press(screen.getByTestId('grammar-start-form'));
    await flush(1);
    await answerForm(0, false);
    fireEvent.press(screen.getByText('←'));
    await flush(1);
    expect(screen.getByTestId('grammar-kind-percent-form')).toHaveTextContent('1/10 · 0%');
    const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    expect(rows.find((r) => r.itemId === 'ser-estar:form:best')?.data).toEqual({ correct: 9, total: 10 });
  });
});
