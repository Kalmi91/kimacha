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
  useLocalSearchParams: () => ({ topic: 'legacy-fixture' }),
}));

// A minimal choice-only fixture lesson
// (lib/__tests__/fixtures/legacy-lesson.json) is added to the content registry.
jest.mock('@/lib/games/content', () => {
  const actual = jest.requireActual('@/lib/games/content');
  const fixture = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const topics = (lang: string) => [...actual.getGrammarTopics(lang), ...(lang === 'es' ? [fixture] : [])];
  return {
    ...actual,
    getGrammarTopics: topics,
    getGrammarTopic: (lang: string, topic: string) =>
      topics(lang).find((t: { topic: string }) => t.topic === topic),
  };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { setLanguage } from '@/lib/i18n';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { hashString } from '@/lib/shuffle';
import GrammarLessonScreen from '../[topic]';
import GrammarSyllabusScreen from '@/app/(tabs)/course';

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
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('lists the whole syllabus, A1 open, later levels reachable', async () => {
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);

    // The learner's own level is expanded, so its units and topics are visible.
    // Kimacha Play: UI always English, regardless of the
    // stored source language, so the unit title renders in English.
    expect(screen.queryByText('The present tense')).toBeTruthy();
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
    const lesson = lessonFor('es', 'legacy-fixture')!;
    // a lecke csak >=80%-nál ír "kész" sort, ezért a teszt mindig
    // a helyes választ nyomja meg. A GrammarDrill seedje Date.now()-ból jön,
    // lemockolva előre kiszámítható ugyanazzal a `buildGrammarRound`-dal.
    const now = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const seed = hashString(`${lesson.topic}:${now}`);
    const round = buildGrammarRound(lesson, seed).filter(isChoiceRoundItem);

    const view = render(<GrammarLessonScreen />);
    await flush(4);

    // The rule and worked examples come BEFORE any question. Kimacha Play: UI
    // always English, regardless of the stored source.
    expect(screen.queryByText(lesson.speak.en)).toBeTruthy();
    expect(screen.queryAllByTestId('grammar-option').length).toBe(0);

    fireEvent.press(screen.getByTestId('grammar-start-choice'));
    await flush(1);

    // Answer every item correctly, dismissing the explanation each time.
    for (const roundItem of round) {
      const options = screen.queryAllByTestId('grammar-option');
      if (!options.length) break;
      fireEvent.press(options[roundItem.correctIndex]);
      await flush(1);
      const next = screen.queryByTestId('grammar-next');
      if (next) fireEvent.press(next);
      await flush(1);
    }

    // The score screen, and the progress row written for the course (not the game).
    expect(screen.queryByTestId('grammar-practice-again')).toBeTruthy();
    await flush(2);
    const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    const row = rows.find((r) => r.itemId === 'legacy-fixture:choice');
    expect(row?.state).toBe('done');
    expect((row?.data as { total?: number })?.total).toBe(lesson.items.length);

    (Date.now as jest.Mock).mockRestore();
    view.unmount();
  });

  // es→en irányban az angol tanterv jelenik meg
  // (A1, A2, B1, B2), a témák lecke nélkül „pronto” jelvénnyel, a spanyol témák nélkül.
  it('es→en irányban az angol tantervet mutatja, spanyol téma nélkül', async () => {
    await getDb().setOnboarding('es', 'en');
    setLanguage('es');
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-level-A1')).toBeTruthy();
    expect(screen.queryByTestId('grammar-level-A2')).toBeTruthy();
    expect(screen.queryByTestId('grammar-level-B1')).toBeTruthy();
    expect(screen.queryByTestId('grammar-level-B2')).toBeTruthy();
    expect(screen.queryByTestId('grammar-level-C1')).toBeTruthy();
    expect(screen.queryByTestId('grammar-topic-presente-regular')).toBeNull();
    expect(screen.queryByTestId('grammar-topic-to_be')).toBeTruthy();
    // az A0-A2 21 angol témához van lecke: egyik sem „próximamente”.
    expect(screen.getByTestId('grammar-percent-basic_verbs').props.children).not.toBe('próximamente');
    expect(screen.getByTestId('grammar-percent-to_be').props.children).not.toBe('próximamente');

    setLanguage('en');
    view.unmount();
  });

  it('shows the finished lesson as done when the syllabus comes back', async () => {
    // no `${topic}:answered`/`${topic}:correct` rows here (old-style
    // progress), so the badge falls back to this round's own correct/total.
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 10, total: 12 });
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);
    expect(screen.queryByText('✓ 83%')).toBeTruthy(); // 10/12 rounded
    view.unmount();
  });
});
