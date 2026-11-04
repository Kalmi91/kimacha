// The grammar level test screen (FB571), played the way a learner plays it: an endless stream from one level's topics,
// the core topics first, the lowest test percent first, every answer saved as the random round's topic evidence, the ✕
// leaves at once and the next visit continues with the then lowest topic, a wrong answer shows the right one and a link
// to the lesson, the done screen comes once when the last topic ticks.
// The lessons are mocked (four topics at A1, one at A2, built from the legacy fixture), the engine is the real one.
// Mock pattern: randomRound.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/chime', () => ({ playChime: jest.fn((done?: () => void) => done?.()) }));
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: { level?: string } = { level: 'A1' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => mockParams,
}));
// the 💬 shows which part of the test it is about
jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string; languagePair: string; level: string }) => (
      <Text testID="fb-card">{`${p.currentCard} | ${p.languagePair} | ${p.level}`}</Text>
    ),
  };
});

// lt-0 core+ (Alpha), lt-1 core (Beta), lt-2 exam (Gamma), lt-3 full (Delta), all A1; lt-4 core at A2; B1 has no topic.
jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const base = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const defs = [
    { id: 'lt-0', level: 'A1', title: 'Alpha topic', tier: 'core-plus' },
    { id: 'lt-1', level: 'A1', title: 'Beta topic', tier: 'core' },
    { id: 'lt-2', level: 'A1', title: 'Gamma topic', tier: 'exam' },
    { id: 'lt-3', level: 'A1', title: 'Delta topic', tier: 'full' },
    { id: 'lt-4', level: 'A2', title: 'Epsilon topic', tier: 'core' },
  ];
  const lessons: Record<string, unknown> = {};
  for (const d of defs) {
    lessons[d.id] = {
      ...base,
      topic: d.id,
      level: d.level,
      items: base.items.map((it: { id: string; sentence: string }) => ({ ...it, id: `${d.id}-${it.id}`, sentence: `${d.id}: ${it.sentence}` })),
    };
  }
  const topics = defs.map((d) => ({ id: d.id, level: d.level, unit: 'u', title: { en: d.title }, blurb: { en: '' } }));
  return {
    ...actual,
    syllabusLevels: () => ['A1', 'A2', 'B1'],
    syllabusForLevel: (level: string) => topics.filter((tp) => tp.level === level),
    hasLesson: (_lang: string, id: string) => id in lessons,
    lessonFor: (_lang: string, id: string) => lessons[id],
    getGrammarTier: (id: string) => defs.find((d) => d.id === id)?.tier ?? 'full',
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { playChime } from '@/lib/chime';
import { speak } from '@/lib/speech';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { GRAMMAR_RANDOM_KEY, evidenceFromRows, topicPercent, topicTicked, type EvidenceAnswer } from '@/lib/grammar/randomRound';
import { ThemeProvider } from '@/lib/ThemeContext';
import LevelTestScreen from '../level-test';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const NOW = 1700000000000;
const SEED = NOW % 2147483647;
const TOPICS = ['lt-0', 'lt-1', 'lt-2', 'lt-3', 'lt-4'];

const flush = makeFlush(4);
const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const text = (testID: string) => {
  const c = screen.getByTestId(testID).props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

let questions: { topic: string; q: LessonTestQuestion }[] = [];
const buildAll = () =>
  TOPICS.flatMap((topic) =>
    buildLessonTest(lessonFor('es', topic)!, { seed: SEED, learnedLang: 'es', contentLang: 'en', size: 9999 }).map((q) => ({ topic, q }))
  );

// The question on screen, found by its sentence (it starts with its topic id).
const onScreen = () => {
  const sentence = text('exam-text');
  const found = questions.find((x) => x.q.view.card === 'choice' && x.q.view.text === sentence);
  if (!found) throw new Error(`no question for "${sentence}"`);
  return found;
};
const topicOnScreen = () => onScreen().topic;

// A tap on the right or on a wrong option; the card hands the answer over at once.
const answer = async (ok: boolean) => {
  const found = onScreen();
  const v = found.q.view;
  if (v.card !== 'choice') throw new Error('choice only');
  await press(`exam-option-${ok ? v.correctIndex : (v.correctIndex + 1) % v.options.length}`);
  return found;
};

// Evidence written ahead: 'c' right choice, 'f' right form, 'x' wrong choice (ids that match no question).
const seedEvidence = (topicId: string, spec: string[]) =>
  getDb().setGameProgress(GRAMMAR_RANDOM_KEY, topicId, 'evidence', {
    answers: spec.map((s, i): EvidenceAnswer => ({ id: `old${i}`, kind: s === 'f' ? 'form' : 'choice', ok: s !== 'x', at: '2026-11-01' })),
  });
const TICKED = ['c', 'f', 'c', 'f', 'c'];
const evidenceNow = async () => evidenceFromRows(await getDb().getGameProgress(GRAMMAR_RANDOM_KEY));

describe.each(['brand', 'classic'] as const)('grammar level test (%s palette)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = { level: 'A1' };
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    questions = buildAll();
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const open = async () => {
    const view = render(
      <ThemeProvider>
        <LevelTestScreen />
      </ThemeProvider>
    );
    await flush();
    return view;
  };

  it('starts on the core+ topic of the level, with the level percent in the header and no topic name before the answer', async () => {
    await open();
    expect(topicOnScreen()).toBe('lt-0');
    expect(text('level-test-header')).toBe('A1 level test · 0%');
    expect(screen.getByTestId('level-test-progress')).toBeTruthy();
    for (const name of ['Alpha topic', 'Beta topic', 'Gamma topic', 'Delta topic', 'Epsilon topic']) expect(screen.queryByText(name)).toBeNull();
    // the A2 topic is not part of the A1 test
    expect(screen.queryByText(/lt-4/)).toBeNull();
  });

  it('a right answer chimes, reads the sentence, is marked green, goes into the topic evidence and moves on to another topic', async () => {
    await open();
    const { q } = await answer(true);
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(q.say, 'es-MX');
    expect((playChime as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((speak as jest.Mock).mock.invocationCallOrder[0]);
    expect(screen.getByTestId('level-test-right-mark')).toHaveTextContent(/Correct/);
    expect(topicOnScreen()).toBe('lt-1'); // never the same topic twice in a row, and lt-1 has no answer yet
    const ev = await evidenceNow();
    expect(ev.get('lt-0')?.answers).toEqual([{ id: q.id, kind: q.kind, ok: true, at: expect.any(String) }]);
  });

  it('a wrong answer shows the right one, the why and a link to the lesson; Next goes on', async () => {
    await open();
    await answer(true); // lt-0
    const { q, topic } = await answer(false); // lt-1
    expect(topic).toBe('lt-1');
    expect(playChime).toHaveBeenCalledTimes(1); // only the right answer chimed
    expect(speak).toHaveBeenLastCalledWith(q.say, 'es-MX');
    expect(screen.queryByTestId('level-test-right-mark')).toBeNull();
    expect(text('level-test-topic')).toBe('Beta topic');
    expect(text('level-test-feedback-answer')).toBe(q.review.answer);
    expect(screen.getByTestId('level-test-feedback-badge')).toHaveTextContent(/Not quite/);
    await press('level-test-rule');
    expect(mockPush).toHaveBeenCalledWith('/grammar/lt-1');
    expect(screen.getByTestId('level-test-feedback-answer')).toBeTruthy(); // back from the lesson: the card is still there
    await press('level-test-next');
    expect(screen.queryByTestId('level-test-feedback-answer')).toBeNull();
    expect(topicOnScreen()).toBe('lt-0'); // lt-1 was just asked, lt-0 is the other core topic
    const ev = await evidenceNow();
    expect(ev.get('lt-1')?.answers.map((a) => a.ok)).toEqual([false]);
  });

  it('the 💬 names the level and the question, on the question and on the wrong-answer card', async () => {
    await open();
    const first = onScreen();
    expect(text('fb-card')).toBe(`grammar-level-test:A1:${first.q.id} | en→es | A1`);
    await answer(false);
    expect(text('fb-card')).toBe(`grammar-level-test:A1:${first.q.id} | en→es | A1`);
  });

  it('the core topics come first by percent, then the other tiers once every core topic is ticked off', async () => {
    // lt-0 ticked, lt-1 (core) 25%, lt-2 (exam) with no answer, lt-3 (full) 0%
    await seedEvidence('lt-0', TICKED);
    await seedEvidence('lt-1', ['c', 'x', 'x', 'x']);
    await seedEvidence('lt-3', ['x', 'x', 'x', 'x']);
    const view = await open();
    expect(topicOnScreen()).toBe('lt-1');
    view.unmount();

    // all core topics ticked: the lowest of the others (lt-2 has no answer)
    await seedEvidence('lt-1', TICKED);
    const again = await open();
    expect(topicOnScreen()).toBe('lt-2');
    again.unmount();

    // lt-2 answered 100% (4 answers, unticked): lt-3 at 0% comes next
    await seedEvidence('lt-2', ['c', 'c', 'c', 'c']);
    await open();
    expect(topicOnScreen()).toBe('lt-3');
  });

  it('the level percent is live: a third answer gives the topic its percent and the header follows', async () => {
    // three ticked topics (100% each), lt-0 with two right answers (no percent yet): the header says 75%
    await seedEvidence('lt-0', ['c', 'c']);
    for (const id of ['lt-1', 'lt-2', 'lt-3']) await seedEvidence(id, TICKED);
    await open();
    expect(topicOnScreen()).toBe('lt-0');
    expect(text('level-test-header')).toBe('A1 level test · 75%');
    await answer(true);
    expect(text('level-test-header')).toBe('A1 level test · 100%');
  });

  it('the ✕ leaves at once with no question, progress stays, and the next visit continues with the then lowest topic', async () => {
    const view = await open();
    await answer(true); // lt-0
    await press('level-test-close');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Leave/)).toBeNull(); // no confirm
    const saved = (await evidenceNow()).get('lt-0');
    expect(saved?.answers).toHaveLength(1);
    view.unmount();

    await open();
    expect(topicOnScreen()).toBe('lt-1'); // lt-0 has an answer now, lt-1 none
    await answer(true);
    expect(topicOnScreen()).toBe('lt-0'); // the stream goes on and every answer adds to the same evidence
    expect((await evidenceNow()).get('lt-1')?.answers).toHaveLength(1);
  });

  it('answers raise the same evidence the random round and the lesson badge use: 5 right answers over two kinds tick the topic', async () => {
    await seedEvidence('lt-0', ['f', 'c', 'f', 'c']); // 4 answers, 100%, two kinds: one more tick it
    for (const id of ['lt-1', 'lt-2', 'lt-3']) await seedEvidence(id, TICKED);
    await open();
    expect(topicOnScreen()).toBe('lt-0');
    expect(topicTicked((await evidenceNow()).get('lt-0'))).toBe(false);
    await answer(true);
    const ev = (await evidenceNow()).get('lt-0');
    expect(topicPercent(ev)).toBe(100);
    expect(topicTicked(ev)).toBe(true);
  });

  describe('the done screen', () => {
    // lt-0..lt-2 ticked; lt-3 has 4 answers, one more right one ticks it and the whole level
    const almostDone = async () => {
      for (const id of ['lt-0', 'lt-1', 'lt-2']) await seedEvidence(id, TICKED);
      await seedEvidence('lt-3', ['f', 'c', 'f', 'c']);
    };

    it('comes once when the last topic ticks; "Keep practising" goes on with the stream, "Leave" goes back', async () => {
      await almostDone();
      await open();
      expect(topicOnScreen()).toBe('lt-3');
      expect(screen.queryByTestId('level-test-done')).toBeNull();
      await answer(true);
      expect(text('level-test-done-title')).toBe('A1: every topic ticked off');
      expect(screen.getByText('You can leave now or keep practising.')).toBeTruthy();
      await press('level-test-done-keep');
      expect(screen.queryByTestId('level-test-done')).toBeNull();
      expect(screen.getByTestId('exam-text')).toBeTruthy(); // the stream continues
      await answer(true);
      expect(screen.queryByTestId('level-test-done')).toBeNull(); // once
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('Leave on the done screen goes back', async () => {
      await almostDone();
      await open();
      await answer(true);
      await press('level-test-done-leave');
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('a level that is already all ticked has no done screen on entry; the stream asks the lowest topic', async () => {
      for (const id of ['lt-0', 'lt-1', 'lt-2', 'lt-3']) await seedEvidence(id, TICKED);
      await seedEvidence('lt-2', ['c', 'f', 'c', 'f', 'c', 'x', 'c', 'f']); // still ticked, 88%
      await open();
      expect(screen.queryByTestId('level-test-done')).toBeNull();
      expect(topicOnScreen()).toBe('lt-2');
      expect(text('level-test-header')).toBe('A1 level test · 97%');
    });
  });

  it('a topic with every question in the window keeps coming back instead of drying up', async () => {
    // the first topic has 12 questions: 14 right answers in a row on a single-topic level never stop the stream
    mockParams = { level: 'A2' };
    await open();
    expect(topicOnScreen()).toBe('lt-4');
    for (let i = 0; i < 14; i++) {
      expect(topicOnScreen()).toBe('lt-4');
      await answer(true);
    }
    expect((await evidenceNow()).get('lt-4')?.answers).toHaveLength(10);
  });

  it('an unknown level falls back to the learner level; a level without any topic goes straight back', async () => {
    mockParams = { level: 'Z9' };
    const view = await open();
    expect(text('level-test-header')).toBe('A1 level test · 0%');
    view.unmount();

    mockBack.mockClear();
    mockParams = { level: 'B1' };
    await open();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
