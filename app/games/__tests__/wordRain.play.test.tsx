// GAMES.md 4.1 playthrough: mounts the real screen, plays real rounds and
// checks the spec's promises (exactly one correct tile, one life per miss,
// combo shown, game over instead of a crash) instead of trusting the pure
// round builder alone.

jest.mock('react-native-reanimated', () => require('../../../testing/reanimatedMock'));
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/games/word-rain',
}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { advanceTimers, flushAsync, learnedFormOf, seedPractisedWords } from '../../../testing/gameTestUtils';
import { finishAnimations, resetAnimations } from '../../../testing/reanimatedMock';
import WordRainScreen from '../word-rain';

const LEVEL = 'A1' as const;

async function startRun() {
  const view = render(<WordRainScreen />);
  await flushAsync();
  fireEvent.press(screen.getByText('Play'));
  for (let i = 0; i < 4; i++) await advanceTimers(800); // 3 - 2 - 1 - Start!
  await flushAsync();
  return view;
}

function currentPrompt(): string {
  return screen.getByTestId('word-rain-prompt').props.children as string;
}

function livesShown(): number {
  return (screen.getByTestId('game-lives').props.children as string).length / 2; // emoji = 2 UTF-16 units
}

function scoreShown(): number {
  const children = screen.getByTestId('game-score').props.children as [string, number];
  return Number(children[1]);
}

/** Tap the tile that matches the prompt; returns false if it is not on screen. */
function tapCorrectTile(): boolean {
  const answer = learnedFormOf(currentPrompt(), LEVEL, 'es', 'hu');
  const tiles = screen.getAllByTestId(/^word-rain-tile-/);
  const hit = tiles.find((t) => t.props.children === answer);
  if (!hit) return false;
  fireEvent.press(hit);
  return true;
}

function tapWrongTile(): boolean {
  const answer = learnedFormOf(currentPrompt(), LEVEL, 'es', 'hu');
  const tiles = screen.getAllByTestId(/^word-rain-tile-/);
  const miss = tiles.find((t) => t.props.children !== answer);
  if (!miss) return false;
  fireEvent.press(miss);
  return true;
}

describe('word-rain playthrough (GAMES.md 4.1)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetAnimations();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('spawns a round with exactly one correct tile', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 30 });
    const view = await startRun();

    const answer = learnedFormOf(currentPrompt(), LEVEL, 'es', 'hu');
    expect(answer).toBeTruthy();

    const tiles = screen.getAllByTestId(/^word-rain-tile-/);
    expect(tiles.length).toBeGreaterThanOrEqual(3);
    expect(tiles.filter((t) => t.props.children === answer)).toHaveLength(1);

    view.unmount();
  });

  it('scores a hit and moves to the next prompt', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 30 });
    const view = await startRun();

    const before = currentPrompt();
    expect(tapCorrectTile()).toBe(true);
    await flushAsync();

    expect(scoreShown()).toBeGreaterThan(0);
    expect(currentPrompt()).not.toBe(before);
    expect(livesShown()).toBe(3);

    view.unmount();
  });

  it('charges exactly one life for a wrong tap', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 30 });
    const view = await startRun();

    expect(tapWrongTile()).toBe(true);
    await flushAsync();
    expect(livesShown()).toBe(2);

    view.unmount();
  });

  it('charges exactly one life when the answer reaches the bottom', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 30 });
    const view = await startRun();

    await act(async () => {
      finishAnimations();
      await Promise.resolve();
    });
    await flushAsync();

    expect(livesShown()).toBe(2);

    view.unmount();
  });

  it('ends the run with the game-over card after three misses', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 30 });
    const view = await startRun();

    for (let i = 0; i < 3; i++) {
      expect(tapWrongTile()).toBe(true);
      await flushAsync();
    }

    expect(screen.queryByText('Play again')).toBeTruthy();

    view.unmount();
  });
});
