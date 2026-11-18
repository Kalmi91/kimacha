// FB671 / FB672 on the grammar Small test screen: a word order task is shown as the tiles card with 2 or 3 unneeded tiles
// and nothing is read aloud. (The Big test has only multiple-choice items of its own, no word order task.) Mock pattern:
// smallTest.play.test.tsx; here every lesson holds 12 word order items.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/chime', () => ({ playChime: jest.fn((done?: () => void) => done?.()) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(() => cb(), []);
  },
  useLocalSearchParams: () => ({ level: 'a1' }),
}));
jest.mock('@/components/FeedbackModal', () => ({ __esModule: true, default: () => null }));

jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const base = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const foods = ['pan', 'arroz', 'sopa', 'carne', 'pollo', 'fruta', 'queso', 'leche', 'agua', 'jugo', 'pasta', 'tacos'];
  const defs = [
    { id: 'lt-0', tier: 'core-plus' },
    { id: 'lt-1', tier: 'core' },
    { id: 'lt-2', tier: 'exam' },
    { id: 'lt-3', tier: 'full' },
  ];
  const lessons: Record<string, unknown> = {};
  for (const d of defs) {
    lessons[d.id] = {
      ...base,
      topic: d.id,
      level: 'A1',
      items: foods.map((f, i) => ({
        kind: 'order',
        id: `${d.id}-o${i}`,
        prompt: { en: `P ${d.id}-o${i}`, es: `P ${d.id}-o${i}` },
        es: `Yo como ${f} hoy.`,
      })),
    };
  }
  const topics = defs.map((d) => ({ id: d.id, level: 'A1', unit: 'u', title: { en: d.id }, blurb: { en: '' } }));
  return {
    ...actual,
    syllabusLevels: () => ['A1', 'A2', 'B1', 'C1'],
    syllabusForLevel: (level: string) => topics.filter((tp) => tp.level === level),
    hasLesson: (_lang: string, id: string) => id in lessons,
    lessonFor: (_lang: string, id: string) => lessons[id],
    getGrammarTier: (id: string) => defs.find((d) => d.id === id)?.tier ?? 'full',
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { GRAMMAR_RANDOM_KEY } from '@/lib/grammar/randomRound';
import { smallKey } from '@/lib/grammar/smallTest';
import { lessonFor } from '@/lib/grammar/syllabus';
import { saveResumeValue } from '@/lib/resumeStore';
import { speak } from '@/lib/speech';
import { ThemeProvider } from '@/lib/ThemeContext';
import SmallTestScreen from '../small-test';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const NOW = 1700000000000;
const SEED = NOW % 2147483647;
const flush = makeFlush(4);
let mockNow = NOW;

describe('grammar small test: a word order task', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockNow = NOW;
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    await saveResumeValue(db, smallKey('en→es', 'A1'), null);
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  it('shows 2 or 3 unneeded tiles, a wrong tile is a wrong answer, and nothing is spoken', async () => {
    render(
      <ThemeProvider>
        <SmallTestScreen />
      </ThemeProvider>,
    );
    await flush();
    fireEvent.press(screen.getByTestId('small-test-start'));
    await flush();

    const prompt = screen.getByText(/^P lt-\d-o\d+$/);
    const id = String(prompt.props.children);
    const topic = id.replace(/^P /, '').replace(/-o\d+$/, '');
    const q = buildLessonTest(lessonFor('es', topic) as never, { seed: SEED, learnedLang: 'es', contentLang: 'en', size: 9999 }).find(
      (x: LessonTestQuestion) => x.id === id.replace(/^P /, ''),
    )!;
    expect(q.view.card).toBe('tiles');
    if (q.view.card !== 'tiles') return;
    const extra = q.view.distractors ?? [];
    expect([2, 3]).toContain(extra.length);
    for (const w of [...q.view.answerTokens, ...extra]) expect(screen.getAllByText(w).length).toBeGreaterThan(0);

    for (const w of [...q.view.answerTokens, extra[0]]) fireEvent.press(screen.getAllByText(w)[0]);
    mockNow += 600; // the screen's double-tap guard
    fireEvent.press(screen.getByTestId('exam-check'));
    await flush();
    expect(screen.getByTestId('small-test-mistyped')).toBeTruthy(); // the build was wrong: the miss card
    expect(speak).not.toHaveBeenCalled();
  });
});
