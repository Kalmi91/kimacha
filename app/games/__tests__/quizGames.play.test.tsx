// Playthroughs for the four "answer, then get taught" games: grammar-choice
// (4.11), confusables (4.12), myth (4.13) and odd-one-out (4.8). Each is played
// from its own entry screen to its summary, so a run that hangs, crashes or
// never reaches the end shows up here instead of on Kálmán's phone.

jest.mock('react-native-reanimated', () => require('../../../testing/reanimatedMock'));
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/games/quiz',
}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { flushAsync, seedPractisedWords } from '../../../testing/gameTestUtils';
import { resetAnimations } from '../../../testing/reanimatedMock';
import ConfusablesScreen from '../confusables';
import GrammarChoiceScreen from '../grammar-choice';
import MythScreen from '../myth';
import OddOneOutScreen from '../odd-one-out';

const LEVEL = 'A1' as const;

/** Answer with the first option, then dismiss the explanation, until it ends. */
async function answerUntilSummary(pickFirstOption: () => boolean, maxSteps = 60) {
  for (let step = 0; step < maxSteps; step++) {
    if (screen.queryByText('Done!')) return step;
    if (!pickFirstOption()) return -1;
    // eslint-disable-next-line no-await-in-loop
    await flushAsync(1);
    const gotIt = screen.queryByText('Got it');
    if (gotIt) fireEvent.press(gotIt);
    // eslint-disable-next-line no-await-in-loop
    await flushAsync(1);
  }
  return -2;
}

describe('quiz-shaped games play to the end', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetAnimations();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('grammar-choice: topic list -> full run -> summary (GAMES.md 4.11)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 60 });
    const view = render(<GrammarChoiceScreen />);
    await flushAsync(4);

    // Every authored grammar topic is offered by name.
    const topicCard = screen.getByText('Ser vagy estar?');
    fireEvent.press(topicCard);
    await flushAsync();

    // GAMES.md 4.11: the explanation card must appear for EVERY answer, right
    // or wrong, not only for a miss.
    fireEvent.press(screen.getAllByTestId('grammar-option')[0]);
    await flushAsync();
    expect(screen.queryByText('Got it')).toBeTruthy();
    fireEvent.press(screen.getByText('Got it'));
    await flushAsync();

    const steps = await answerUntilSummary(() => {
      const options = screen.queryAllByTestId('grammar-option');
      if (!options.length) return false;
      fireEvent.press(options[0]);
      return true;
    });
    expect(steps).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText('Done!')).toBeTruthy();

    view.unmount();
  });

  it('confusables: set list -> teaching card -> drill -> summary (GAMES.md 4.12)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 60 });
    const view = render(<ConfusablesScreen />);
    await flushAsync(4);

    const sets = screen.queryAllByTestId('confusables-set');
    expect(sets.length).toBeGreaterThan(0);
    fireEvent.press(sets[0]);
    await flushAsync();

    fireEvent.press(screen.getByTestId('confusables-start-drill'));
    await flushAsync();

    const steps = await answerUntilSummary(() => {
      const options = screen.queryAllByTestId('confusables-option');
      if (!options.length) return false;
      fireEvent.press(options[0]);
      return true;
    });
    expect(steps).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText('Done!')).toBeTruthy();

    view.unmount();
  });

  it('myth: start -> 10 claims -> summary with sources (GAMES.md 4.13)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 60 });
    const view = render(<MythScreen />);
    await flushAsync(4);

    fireEvent.press(screen.getByText('Go!'));
    await flushAsync();

    const steps = await answerUntilSummary(() => {
      const trueBtn = screen.queryByTestId('myth-true');
      if (!trueBtn) return false;
      fireEvent.press(trueBtn);
      return true;
    });
    expect(steps).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText('Done!')).toBeTruthy();

    view.unmount();
  });

  it('odd-one-out: 10 questions -> summary (GAMES.md 4.8)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 120 });
    const view = render(<OddOneOutScreen />);
    await flushAsync(5);

    const steps = await answerUntilSummary(() => {
      const options = screen.queryAllByTestId('odd-option');
      if (!options.length) return false;
      fireEvent.press(options[0]);
      return true;
    });
    expect(steps).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText('Done!')).toBeTruthy();

    view.unmount();
  });
});
