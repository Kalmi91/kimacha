// the 💬 is on EVERY part of the grammar lesson flow, and the card id
// says which part it is (grammar:<lesson>:<part>): the Grammar tab list, lesson overview,
// during a task, task END (done), lesson test (question / exit / result), deck (card / end /
// empty), and the page of a not-yet-written lesson. On a type-in question the 💬 sits above the docked Check bar
// (bottomOffset). Pattern: app/__tests__/examFeedback.test.tsx + lessonTest.test.tsx + tableDeck.play.test.tsx.

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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
let mockTopicId = 'presente-regular';
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
    default: (p: { currentCard: string; languagePair: string; level: string; bottomOffset?: number }) => (
      <Text testID="fb-card">{`${p.currentCard} | ${p.languagePair} | ${p.level} | ${p.bottomOffset ?? '-'}`}</Text>
    ),
  };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { kindBestKey } from '@/lib/grammar/lessonScore';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { tableCellsForLesson } from '@/lib/grammar/tableDeck';
import { ThemeProvider } from '@/lib/ThemeContext';
import GrammarLessonScreen from '../[topic]';
import TableDeckScreen from '../deck/[topic]';

jest.setTimeout(60000);

const TOPIC = 'presente-regular';
const NOW = 1700000000000;

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
// There is exactly one 💬 on the screen (getByTestId throws on several), we read that out.
const card = () => screen.getByTestId('fb-card').props.children as string;

const seedBest = async (kinds: string[]) => {
  for (const k of kinds) {
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, kindBestKey(TOPIC, k as never), 'best', { correct: 6, total: 10 });
  }
};

// Plays through a "choice" round (picks the first option) until the done page appears.
const answerChoiceRound = async () => {
  for (let i = 0; i < 40 && !screen.queryByTestId('grammar-start-lessontest'); i++) {
    const opt = screen.queryAllByTestId('grammar-option')[0];
    if (opt) {
      fireEvent.press(opt);
      await flush(1);
    }
    const next = screen.queryByTestId('grammar-next');
    if (next) {
      fireEvent.press(next);
      await flush(1);
    }
  }
};

const playChoiceRound = async () => {
  await press('grammar-start-choice');
  await answerChoiceRound();
};

const expectedQuestions = (): LessonTestQuestion[] =>
  buildLessonTest(lessonFor('es', TOPIC)!, { seed: NOW, learnedLang: 'es', contentLang: 'en' });

// Solving one question correctly on the exam card.
const solveOk = async (q: LessonTestQuestion) => {
  const v = q.view;
  if (v.card === 'choice') {
    await press(`exam-option-${v.correctIndex}`);
  } else if (v.card === 'type') {
    fireEvent.changeText(screen.getByTestId('exam-input'), v.answer);
    await press('exam-check');
  } else if (v.card === 'match') {
    for (let i = 0; i < v.pairs.length; i++) await press(`exam-right-${i}`);
    await press('exam-check');
  } else {
    throw new Error('presente-regular nem tartalmaz ilyen kártyát');
  }
};

describe.each(['brand', 'classic'] as const)('nyelvtani lecke: 💬 minden részen (%s paletta)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockTopicId = TOPIC;
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  it('Nyelvtan fül listája: grammar-syllabus', async () => {
    const view = render(
      <ThemeProvider>
        <GrammarSyllabusScreen />
      </ThemeProvider>
    );
    await flush();
    expect(card()).toBe('grammar-syllabus | en→es | A1 | -');
    view.unmount();
  });

  it('még meg nem írt lecke lapja: grammar:<lecke>:soon', async () => {
    mockTopicId = 'no-such-lesson';
    const view = render(
      <ThemeProvider>
        <GrammarLessonScreen />
      </ThemeProvider>
    );
    await flush();
    expect(card()).toBe('grammar:no-such-lesson:soon | en→es | A1 | -');
    view.unmount();
  });

  it('áttekintés, feladat közben, feladat VÉGE (done): mind saját azonosítóval', async () => {
    await seedBest(['match', 'form', 'why']);
    const view = render(
      <ThemeProvider>
        <GrammarLessonScreen />
      </ThemeProvider>
    );
    await flush();
    expect(card()).toBe(`grammar:${TOPIC}:lesson | en→es | A1 | -`);
    await press('grammar-start-choice');
    expect(card()).toMatch(new RegExp(`^grammar:${TOPIC}:drill(:.+)? \\| en→es \\| A1 \\| (-|\\d+)$`));
    await answerChoiceRound();
    // this was missing: there was no 💬 at the end of a task (result page).
    expect(screen.getByTestId('grammar-start-lessontest')).toBeTruthy();
    expect(card()).toBe(`grammar:${TOPIC}:done | en→es | A1 | -`);
    view.unmount();
  });

  it('lecke-teszt: kérdés (beírósnál a dokkolt sáv fölött), kilépés, vissza, eredmény', async () => {
    await seedBest(['match', 'form', 'why']);
    const view = render(
      <ThemeProvider>
        <GrammarLessonScreen />
      </ThemeProvider>
    );
    await flush();
    await playChoiceRound();
    await press('grammar-start-lessontest');

    const qs = expectedQuestions();
    const prefix = (i: number) => `grammar:${TOPIC}:lessontest:q${i + 1}:${qs[i].id} | en→es | A1 | `;
    expect(card().startsWith(prefix(0))).toBe(true);

    // Exit confirmation, then back to the same question.
    await press('lesson-test-close');
    expect(card()).toBe(`grammar:${TOPIC}:lessontest:leave | en→es | A1 | -`);
    await press('lesson-test-keep-going');
    expect(card().startsWith(prefix(0))).toBe(true);

    for (let i = 0; i < qs.length; i++) {
      // On a type-in question there is a docked Check bar: the 💬 sits higher by the bar's height; otherwise the default position.
      expect(card().startsWith(prefix(i))).toBe(true);
      const offset = card().slice(prefix(i).length);
      if (qs[i].view.card === 'type') expect(offset).toMatch(/^[1-9]\d*$/);
      else expect(offset).toBe('-');
      await solveOk(qs[i]);
    }
    expect(card()).toBe(`grammar:${TOPIC}:lessontest:result | en→es | A1 | -`);
    view.unmount();
  });
});

describe('nyelvtani pakli (deck): 💬 kártyán, a pakli végén, üres lapon', () => {
  const cells = tableCellsForLesson(lessonFor('es', 'ser-estar')!);

  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette('classic');
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });

  it('kártya: grammar:<lecke>:tabledeck:<cella>, a dokkolt sáv fölött', async () => {
    mockTopicId = 'ser-estar';
    const view = render(<TableDeckScreen />);
    await flush();
    expect(card()).toMatch(/^grammar:ser-estar:tabledeck:.+ \| en→es \| A1 \| [1-9]\d*$/);
    view.unmount();
  });

  it('pakli vége: grammar:<lecke>:tabledeck', async () => {
    mockTopicId = 'ser-estar';
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'ser-estar:tabledeck', 'progress', {
      cells: cells.map((c) => ({ id: c.id, done: true, dueAt: null })),
      resetCount: 0,
      shuffled: false,
    });
    const view = render(<TableDeckScreen />);
    await flush();
    expect(screen.getByTestId('tabledeck-start-again')).toBeTruthy();
    expect(card()).toBe('grammar:ser-estar:tabledeck | en→es | A1 | -');
    view.unmount();
  });

  it('üres pakli (nincs cella és nincs szó-pakli): grammar:<lecke>:tabledeck:empty', async () => {
    mockTopicId = 'no-such-lesson';
    const view = render(<TableDeckScreen />);
    await flush();
    expect(card()).toBe('grammar:no-such-lesson:tabledeck:empty | en→es | A1 | -');
    view.unmount();
  });
});
