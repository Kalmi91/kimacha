// The four typed task kinds on the lesson screen of the two A1 sample topics: the buttons (with counts, before `write`),
// a round played from the button, and the feedback button carrying the item's card id.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTopicId = 'sustantivo-numero';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));
jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string }) => <Text testID="fb-card">{p.currentCard}</Text>,
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { type GrammarItem } from '@/lib/games/content';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { KIND_ORDER } from '@/lib/grammar/useGrammarTopic';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import GrammarLessonScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);
const NEW_KINDS = ['noun', 'opencloze', 'fix', 'bank'] as const;
const itemsOf = (topic: string, kind: string) => (lessonFor('es', topic)!.items as GrammarItem[]).filter((i) => i.kind === kind);

async function resetState(topic: string) {
  mockTopicId = topic;
  const db = getDb();
  await db.setOnboarding('en', 'es');
  (db as any).__setLevelForTest('A1');
  await db.setStrictAccents(false);
  await db.resetGameProgress(RESUME_GAME_ID);
  for (const kind of NEW_KINDS) {
    for (const suffix of ['best', 'run', 'answered', 'correct']) {
      await db.setGameProgress(GRAMMAR_PROGRESS_KEY, `${topic}:${kind}:${suffix}`, 'cleared', null);
    }
  }
}

async function open(topic: string, kind: string) {
  await resetState(topic);
  render(<GrammarLessonScreen />);
  await flush(4);
  fireEvent.press(screen.getByTestId(`grammar-start-${kind}`));
  await flush(2);
}

describe.each(['sustantivo-numero', 'adjetivo-concordancia'])('typed kinds on %s', (topic) => {
  it('has a button per new kind with its count, in KIND_ORDER, and `write` stays last', async () => {
    await resetState(topic);
    render(<GrammarLessonScreen />);
    await flush(4);
    const ids = screen.getAllByTestId(/^grammar-start-/).map((n) => n.props.testID as string);
    for (const k of NEW_KINDS) {
      expect(ids).toContain(`grammar-start-${k}`);
      expect(screen.getByTestId(`grammar-start-${k}`)).toHaveTextContent(new RegExp(`[(]${itemsOf(topic, k).length}[)]$`));
    }
    const order = ids.map((id) => id.replace('grammar-start-', '')).filter((k) => KIND_ORDER.includes(k as never));
    expect(order).toEqual(KIND_ORDER.filter((k) => order.includes(k)));
    expect(KIND_ORDER[KIND_ORDER.length - 1]).toBe('write');
  });

  it('plays a noun round and the feedback button carries the item id', async () => {
    const [first] = itemsOf(topic, 'noun') as unknown as { id: string; answer: string }[];
    await open(topic, 'noun');
    expect(screen.getByTestId('noun-item')).toBeTruthy();
    expect(screen.getByTestId('fb-card')).toHaveTextContent(`grammar:${topic}:drill:${first.id}`);
    fireEvent.changeText(screen.getByTestId('noun-input'), first.answer);
    fireEvent.press(screen.getByTestId('noun-check'));
    await flush(1);
    expect(screen.getByTestId('noun-correct')).toBeTruthy();
  });

  it.each(['opencloze', 'fix', 'bank'] as const)('plays a %s round', async (kind) => {
    await open(topic, kind);
    const id = { opencloze: 'cloze', fix: 'fix', bank: 'bank' }[kind];
    expect(screen.getByTestId(`${id}-item`)).toBeTruthy();
    expect(screen.getByTestId('fb-card')).toHaveTextContent(new RegExp(`^grammar:${topic}:drill:`));
  });
});
