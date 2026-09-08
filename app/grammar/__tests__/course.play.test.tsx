// The grammar course, walked the way a learner walks it: syllabus, open a
// lesson, read the rule, drill it, see the score, and find the topic ticked off
// when you come back.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

// jest.mock factories may only touch variables prefixed with "mock".
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'presente-regular' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import GrammarLessonScreen from '../[topic]';
import GrammarSyllabusScreen from '../index';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('grammar course', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.updateLevel('A1', 0, 0, 0);
  });

  it('lists the whole syllabus, A1 open, later levels reachable', async () => {
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);

    // The learner's own level is expanded, so its units and topics are visible.
    expect(screen.queryByText('Jelen idő')).toBeTruthy();
    expect(screen.queryByTestId('grammar-topic-presente-regular')).toBeTruthy();

    // Every level of the map is on screen as a header, including the ones above.
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) {
      expect(screen.queryByTestId(`grammar-level-${level}`)).toBeTruthy();
    }

    // A2 opens on tap and shows the past tenses the course was missing.
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush(1);
    expect(screen.queryByTestId('grammar-topic-indefinido-imperfecto')).toBeTruthy();
    expect(screen.queryByTestId('grammar-topic-futuro-simple')).toBeTruthy();

    view.unmount();
  });

  it('opens a lesson from the syllabus', async () => {
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-topic-presente-regular'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/presente-regular');
    view.unmount();
  });

  it('teaches the rule first, then drills it, then records the lesson as done', async () => {
    const lesson = lessonFor('es', 'presente-regular')!;
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    // The rule and worked examples come BEFORE any question.
    expect(screen.queryByText(lesson.rule.hu!)).toBeTruthy();
    expect(screen.queryAllByTestId('grammar-option').length).toBe(0);

    fireEvent.press(screen.getByTestId('grammar-start-drill'));
    await flush(1);

    // Answer every item correctly, dismissing the explanation each time.
    for (let i = 0; i < lesson.items.length; i++) {
      const options = screen.queryAllByTestId('grammar-option');
      if (!options.length) break;
      // The drill shuffles options, so pick by text.
      const sentence = screen.getByTestId('grammar-drill-progress');
      expect(sentence).toBeTruthy();
      fireEvent.press(options[0]);
      await flush(1);
      const next = screen.queryByTestId('grammar-next');
      if (next) fireEvent.press(next);
      await flush(1);
    }

    // The score screen, and the progress row written for the course (not the game).
    expect(screen.queryByTestId('grammar-practice-again')).toBeTruthy();
    await flush(2);
    const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    const row = rows.find((r) => r.itemId === 'presente-regular');
    expect(row?.state).toBe('done');
    expect((row?.data as { total?: number })?.total).toBe(lesson.items.length);

    view.unmount();
  });

  it('shows the finished lesson as done when the syllabus comes back', async () => {
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 10, total: 12 });
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);
    expect(screen.queryByText('✓ 10/12')).toBeTruthy();
    view.unmount();
  });
});
