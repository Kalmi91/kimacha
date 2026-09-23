// D3 (FB290, 2026-09-17): a lecke-oldal fajtánként külön gombot ad, csak
// azokra a fajtákra, amikből ténylegesen van item a leckében.

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

// jest.mock factories may only touch variables prefixed with "mock".
let mockTopicId = 'ser-estar';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { hashString } from '@/lib/shuffle';
import { buildGrammarRound } from '@/lib/games/grammarChoice';
import { isTransformItem } from '@/lib/games/content';
import { pickTransformRound, TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('grammar lesson screen: per-kind drill buttons', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('schema-2 lesson with all 3 kinds (ser-estar) shows 3 buttons with their own counts', async () => {
    mockTopicId = 'ser-estar';
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    expect(within(screen.getByTestId('grammar-start-choice')).getByText(/\(12\)/)).toBeTruthy();
    expect(within(screen.getByTestId('grammar-start-match')).getByText(/\(1\)/)).toBeTruthy();
    // FB357: 12 authored form items, 2 are vosotros (se-form-09/10), filtered
    // out of the round the button promises.
    expect(within(screen.getByTestId('grammar-start-form')).getByText(/\(10\)/)).toBeTruthy();

    view.unmount();
  });

  it('hay-estar has no form items, so no form button', async () => {
    mockTopicId = 'hay-estar';
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-start-choice')).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-match')).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-form')).toBeFalsy();

    view.unmount();
  });

  it('schema-1 lesson (posesivos) shows a single choice button', async () => {
    mockTopicId = 'posesivos';
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-start-choice')).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-match')).toBeFalsy();
    expect(screen.queryByTestId('grammar-start-form')).toBeFalsy();

    view.unmount();
  });

  // FB316 (NYELVTAN.md NY10): az 50 transform itemes lecke a régi "Átírás
  // (n)" helyett a körös "10 / 50" gombot mutatja (a szám-pár nyelvfüggetlen,
  // az UI nyelve ebben a tesztkörnyezetben en), és egy kör végén egy "10"-et
  // említő gomb kínálja a folytatást. FB357: 4 az 50-ből vosotros, a
  // körös nevező ezért 46.
  it('indefinido-10-verbos (46 non-vosotros transform items) shows a 10/46 round button, and finishing a round offers 10 more', async () => {
    mockTopicId = 'indefinido-10-verbos';
    const now = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const lesson = lessonFor('es', 'indefinido-10-verbos')!;
    const seed = hashString(`${lesson.topic}:${now}`);
    const pool = buildGrammarRound(lesson, seed)
      .map((r) => r.item)
      .filter(isTransformItem);
    const round = pickTransformRound(pool, {}, TRANSFORM_ROUND_SIZE, seed);

    const view = render(<GrammarLessonScreen />);
    await flush(4);

    expect(within(screen.getByTestId('grammar-start-transform')).getByText(/10.*46/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-start-transform'));
    await flush(1);

    for (const item of round) {
      fireEvent.changeText(screen.getByTestId('transform-input'), item.answer);
      fireEvent.press(screen.getByTestId('transform-check'));
      await flush(1);
      fireEvent.press(screen.getByTestId('transform-next'));
      await flush(1);
    }

    expect(within(screen.getByTestId('grammar-more-round')).getByText(/10/)).toBeTruthy();

    // FB316: a kör 10 itemje "gyakoroltnak" számít, egy írással a kör végén.
    const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    const seenRow = rows.find((r) => r.itemId === 'indefinido-10-verbos:transform:seen');
    const seen = seenRow?.data as Record<string, number>;
    expect(Object.keys(seen).sort()).toEqual(round.map((i) => i.id).sort());
    expect(Object.values(seen).every((n) => n === 1)).toBe(true);

    (Date.now as jest.Mock).mockRestore();
    view.unmount();
  });
});
