// GAMES.md 4.2 playthrough. The acceptance criterion ("kategóriánként mindig
// van legalább 3 jó és 3 rossz buborék") is unit-tested on the round builder;
// what only a mounted screen can prove is that the ANNOUNCED category and the
// bubbles on the board agree, that a wrong pop costs exactly one life, and
// that clearing five rounds ends the run instead of hanging.

jest.mock('react-native-reanimated', () => require('../../../testing/reanimatedMock'));
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/games/bubble-pop',
}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getTopicName, getTopicsForLevel } from '@/data/topics';
import { getWordsForLevel, getWordTopic } from '@/data/words';
import { flushAsync, seedPractisedWords } from '../../../testing/gameTestUtils';
import { resetAnimations } from '../../../testing/reanimatedMock';
import BubblePopScreen from '../bubble-pop';

const LEVEL = 'A1' as const;

function promptText(): string {
  const children = screen.getByTestId('bubble-pop-prompt').props.children;
  return Array.isArray(children) ? children.join('') : String(children);
}

/** The topic id the round announced, resolved back from its displayed name. */
function announcedTopicId(): string | null {
  const prompt = promptText();
  const topics = getTopicsForLevel(LEVEL, 'es');
  const hit = topics.find((t) => prompt.includes(getTopicName(t, 'hu')));
  return hit?.id ?? null;
}

function bubbleWordIds(): number[] {
  return screen
    .queryAllByTestId(/^bubble-\d+$/)
    .map((n) => Number(String(n.props.testID).replace('bubble-', '')));
}

function topicOf(wordId: number): string | undefined {
  const word = getWordsForLevel(LEVEL, 'es').find((w) => w.id === wordId);
  return word ? getWordTopic(word) : undefined;
}

function livesShown(): number {
  return (screen.getByTestId('game-lives').props.children as string).length / 2;
}

function roundLine(): string {
  const children = screen.getByTestId('bubble-pop-round').props.children;
  return Array.isArray(children) ? children.join('') : String(children);
}

/** Pop every bubble that belongs to the announced category. */
async function popAllGood(topicId: string) {
  for (const wordId of bubbleWordIds()) {
    if (topicOf(wordId) !== topicId) continue;
    const node = screen.queryByTestId(`bubble-${wordId}`);
    if (node) fireEvent.press(node);
    await flushAsync(1);
  }
  await flushAsync();
}

describe('bubble-pop playthrough (GAMES.md 4.2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetAnimations();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fills the board with the announced category, at least 3 good and 3 bad', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 120 });
    const view = render(<BubblePopScreen />);
    await flushAsync(5);

    const topicId = announcedTopicId();
    expect(topicId).toBeTruthy();

    const ids = bubbleWordIds();
    expect(ids.length).toBeGreaterThanOrEqual(8);
    const good = ids.filter((id) => topicOf(id) === topicId);
    const bad = ids.filter((id) => topicOf(id) !== topicId);
    expect(good.length).toBeGreaterThanOrEqual(3);
    expect(bad.length).toBeGreaterThanOrEqual(3);

    view.unmount();
  });

  it('charges exactly one life for popping a wrong bubble', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 120 });
    const view = render(<BubblePopScreen />);
    await flushAsync(5);

    const topicId = announcedTopicId()!;
    const wrong = bubbleWordIds().find((id) => topicOf(id) !== topicId)!;
    fireEvent.press(screen.getByTestId(`bubble-${wrong}`));
    await flushAsync();

    expect(livesShown()).toBe(4);

    view.unmount();
  });

  it('advances to the next round when every good bubble is popped', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 120 });
    const view = render(<BubblePopScreen />);
    await flushAsync(5);

    const before = roundLine();
    await popAllGood(announcedTopicId()!);

    expect(roundLine()).not.toBe(before);
    expect(bubbleWordIds().length).toBeGreaterThan(0);

    view.unmount();
  });

  it('ends the run after five cleared rounds', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 120 });
    const view = render(<BubblePopScreen />);
    await flushAsync(5);

    for (let round = 0; round < 5; round++) {
      const topicId = announcedTopicId();
      if (!topicId) break;
      await popAllGood(topicId);
    }

    expect(screen.queryByText('Play again')).toBeTruthy();

    view.unmount();
  });
});
