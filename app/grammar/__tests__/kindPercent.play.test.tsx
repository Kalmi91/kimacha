// FB380 ("kint írja, hogy ez a lecke 80% kész, itt benn jelezze ki az app,
// hogy melyik feladat milyen százalékkal van kész"): each kind's own button
// on the lesson screen shows its own cumulative percent, computed with the
// SAME lessonPercent(answered, correct) logic that produces the outside
// (done-screen / syllabus) number. The test drives one match round (1 item,
// 100%) and one form round (10 items, 6 right = 60%) and checks the outside
// number is the WEIGHTED combination of the two (64%, not the 80% a simple
// average of 100 and 60 would give), proving the parts really are the parts
// the outside number is built from.

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
import { lessonPercent } from '@/lib/grammar/lessonScore';
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
// FB357), in authored order, buildGrammarRound does not shuffle form
// items, so this is exactly the round the screen shows. First 6 answered
// right, last 4 wrong (6/10 = 60%).
const FORM_ANSWERS = ['soy', 'estoy', 'eres', 'estás', 'es', 'está', 'somos', 'estamos', 'son', 'están'];
const FORM_CORRECT_COUNT = 6;

describe('grammar lesson screen: per-kind percent (FB380)', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('shows each kind\'s own %, and the parts sum back to the outside % (weighted, not averaged)', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    // No round played yet: no kind shows a percent line.
    expect(screen.queryByTestId('grammar-kind-percent-match')).toBeNull();
    expect(screen.queryByTestId('grammar-kind-percent-form')).toBeNull();

    // 1) Match round: all 6 pairs matched correctly -> 1/1 for this kind (a
    // match round is one item, however many pairs it has inside).
    fireEvent.press(screen.getByTestId('grammar-start-match'));
    await flush(1);
    for (let li = 0; li < 6; li++) {
      fireEvent.press(screen.getByTestId(`match-left-${li}`));
      fireEvent.press(screen.getByTestId(`match-right-${RIGHT_ORDER.indexOf(li)}`));
    }
    expect(screen.getByText('Correct!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    await flush(1);

    // Done screen: 1/1 for this round, outside cumulative also 1/1 = 100%.
    expect(screen.getByTestId('grammar-lesson-percent')).toHaveTextContent('So far: 100% correct');
    fireEvent.press(screen.getByText('Read the rule again'));
    await flush(1);

    expect(screen.getByTestId('grammar-kind-percent-match')).toHaveTextContent('So far: 100% correct');
    expect(screen.queryByTestId('grammar-kind-percent-form')).toBeNull();

    // 2) Form round: 10 items, first 6 right, last 4 wrong -> 6/10 = 60%.
    fireEvent.press(screen.getByTestId('grammar-start-form'));
    await flush(1);
    for (let i = 0; i < FORM_ANSWERS.length; i++) {
      const typed = i < FORM_CORRECT_COUNT ? FORM_ANSWERS[i] : 'xxx';
      fireEvent.changeText(screen.getByTestId('formInput'), typed);
      fireEvent.press(screen.getByTestId('formCheck'));
      await flush(1);
      fireEvent.press(screen.getByTestId('grammar-next'));
      await flush(1);
    }

    // Outside number: (1 + 6) / (1 + 10) = 7/11 = 63.6% -> 64%. A simple
    // average of the two kinds' percents (100, 60) would be 80%; the
    // outside number must be the WEIGHTED sum (match only carries 1 item's
    // weight against form's 10), which is what proves this isn't coincidence.
    const expectedOutside = lessonPercent(1 + FORM_ANSWERS.length, 1 + FORM_CORRECT_COUNT);
    expect(expectedOutside).toBe(64);
    expect(screen.getByTestId('grammar-lesson-percent')).toHaveTextContent(`So far: ${expectedOutside}% correct`);

    fireEvent.press(screen.getByText('Read the rule again'));
    await flush(1);

    expect(screen.getByTestId('grammar-kind-percent-match')).toHaveTextContent('So far: 100% correct');
    expect(screen.getByTestId('grammar-kind-percent-form')).toHaveTextContent('So far: 60% correct');

    view.unmount();
  });
});
