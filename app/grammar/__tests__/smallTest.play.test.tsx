// The grammar Small test screen played the way a learner plays it: the round start with the new / repeat topic list, the
// questions, "I mistyped", the stop after a topic's repeated misses (lesson, quick check, back in the test), the end of the
// round with the level line and the round chart, leaving and coming back, and a typed task kind (word bank) on the card.
// The lessons are mocked (four topics at A1 built from the legacy fixture, one A2 topic with word-bank items); the engine is
// the real one. Mock pattern: levelTest.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/chime', () => ({ playChime: jest.fn((done?: () => void) => done?.()) }));
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: { level?: string } = { level: 'a1' };
// the focus hook is driven by hand: `blur()` / `focus()` play leaving the screen for the lesson and coming back
let mockFocusCb: (() => void | (() => void)) | null = null;
let mockFocusCleanup: void | (() => void) = undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(() => {
      mockFocusCb = cb;
      mockFocusCleanup = cb();
    }, []);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string; languagePair: string; level: string }) => (
      <Text testID="fb-card">{`${p.currentCard} | ${p.languagePair} | ${p.level}`}</Text>
    ),
  };
});

// lt-0 core+ (Alpha), lt-1 core (Beta), lt-2 exam (Gamma), lt-3 full (Delta), all A1 with 12 choice items; lt-4 core at A2 with 8 word-bank items.
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
  lessons['lt-4'] = {
    ...base,
    topic: 'lt-4',
    level: 'A2',
    items: Array.from({ length: 8 }, (_, i) => ({
      kind: 'bank',
      id: `lt-4-b${i}`,
      bank: ['rojo', 'alto'],
      es: `Los coches ${i} son ___.`,
      word: 'rojo',
      answer: 'rojos',
      tr: { en: 'The cars are red.' },
      why: { en: 'Agrees in number.' },
    })),
  };
  const topics = defs.map((d) => ({ id: d.id, level: d.level, unit: 'u', title: { en: d.title }, blurb: { en: '' } }));
  return {
    ...actual,
    syllabusLevels: () => ['A1', 'A2', 'B1', 'C1'],
    syllabusForLevel: (level: string) => topics.filter((tp) => tp.level === level),
    hasLesson: (_lang: string, id: string) => id in lessons,
    lessonFor: (_lang: string, id: string) => lessons[id],
    getGrammarTier: (id: string) => defs.find((d) => d.id === id)?.tier ?? 'full',
  };
});

import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { GRAMMAR_RANDOM_KEY, evidenceFromRows } from '@/lib/grammar/randomRound';
import { loadSmallState, smallKey } from '@/lib/grammar/smallTest';
import { saveResumeValue } from '@/lib/resumeStore';
import { ThemeProvider } from '@/lib/ThemeContext';
import SmallTestScreen from '../small-test';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const NOW = 1700000000000;
const SEED = NOW % 2147483647;
const TOPICS = ['lt-0', 'lt-1', 'lt-2', 'lt-3'];
const TITLES: Record<string, string> = { 'lt-0': 'Alpha topic', 'lt-1': 'Beta topic', 'lt-2': 'Gamma topic', 'lt-3': 'Delta topic' };

const flush = makeFlush(4);
// the clock the screen's double-tap guard reads: every press is 600 ms after the one before it
let mockNow = NOW;
const press = async (testID: string) => {
  mockNow += 600;
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const text = (testID: string) => {
  const c = screen.getByTestId(testID).props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};
const has = (testID: string) => screen.queryByTestId(testID) !== null;

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
const answer = async (ok: boolean) => {
  const found = onScreen();
  const v = found.q.view;
  if (v.card !== 'choice') throw new Error('choice only');
  await press(`exam-option-${ok ? v.correctIndex : (v.correctIndex + 1) % v.options.length}`);
  return found;
};
// the answer, then Next on the result card (a wrong one: not "I mistyped")
const answerNext = async (ok: boolean) => {
  const found = await answer(ok);
  await press('level-test-next');
  return found;
};
const stateNow = () => loadSmallState(getDb(), 'en→es', 'A1');

describe.each(['brand', 'classic'] as const)('grammar small test (%s palette)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = { level: 'a1' };
    mockFocusCb = null;
    mockFocusCleanup = undefined;
    mockNow = NOW;
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    for (const lvl of ['A1', 'A2']) await saveResumeValue(db, smallKey('en→es', lvl), null);
    questions = buildAll();
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const open = async () => {
    const view = render(
      <ThemeProvider>
        <SmallTestScreen />
      </ThemeProvider>
    );
    await flush();
    return view;
  };
  const start = async () => {
    const view = await open();
    await press('small-test-start');
    return view;
  };

  it('opens on the round start: the 10-question title, the round topics with new / repeat tags, the 💬 on the start card', async () => {
    await open();
    expect(text('small-test-header')).toBe('A1 test · round 1');
    expect(text('small-test-intro-title')).toBe('This round: 10 questions');
    for (const id of TOPICS) {
      expect(has(`small-test-intro-topic-${id}`)).toBe(true);
      expect(text(`small-test-intro-tag-${id}`)).toBe('new');
    }
    expect(has('small-test-intro-topic-lt-4')).toBe(false); // an A2 topic is not in the A1 test
    expect(text('fb-card')).toBe('grammar-small-test:A1:intro | en→es | A1');
    expect(StyleSheet.flatten(screen.getByTestId('small-test-progress-fill').props.style).width).toBe('0%');
  });

  it('Start shows the first question with the position in the header; the 💬 names the question', async () => {
    await start();
    expect(text('small-test-header')).toBe('A1 test · 1/10');
    expect(has('small-test-question')).toBe(true);
    const first = onScreen();
    expect(text('fb-card')).toBe(`grammar-small-test:A1:${first.q.id} | en→es | A1`);
    await answerNext(true);
    expect(text('small-test-header')).toBe('A1 test · 2/10');
  });

  it('a wrong answer: the card shows "I mistyped"; pressing it counts the answer as right, in the run and in the topic evidence', async () => {
    await start();
    const { q, topic } = await answer(false);
    expect(has('small-test-mistyped')).toBe(true);
    expect(text('fb-card')).toBe(`grammar-small-test:A1:${q.id} | en→es | A1`);
    await press('small-test-mistyped');
    expect(text('small-test-header')).toBe('A1 test · 2/10');
    const st = await stateNow();
    expect(st.run!.answers[0]).toMatchObject({ qid: q.id, ok: true, mistyped: true });
    expect(st.run!.pending).toHaveLength(0); // no follow-up: it is not a miss
    const ev = evidenceFromRows(await getDb().getGameProgress(GRAMMAR_RANDOM_KEY));
    expect(ev.get(topic)?.answers).toEqual([{ id: q.id, kind: q.kind, ok: true, at: expect.any(String) }]);
  });

  it('a right answer has no "I mistyped"; a wrong one without it is a miss: the same topic comes back within 5 questions', async () => {
    await start();
    const first = await answer(true);
    expect(has('small-test-mistyped')).toBe(false);
    await press('level-test-next');
    const second = await answerNext(false); // a miss (whatever topic is on)
    const missTopic = second.topic;
    const seq: string[] = [];
    for (let i = 0; i < 5; i++) seq.push((await answerNext(true)).topic);
    expect(seq.slice(0, 5).filter((x) => x === missTopic)).toHaveLength(2);
    expect(seq[0]).not.toBe(missTopic); // not right after the miss
    expect(first.topic).toBeTruthy();
  });

  it('the stop: both follow-ups wrong -> the stop card; Open lesson goes to the lesson; back, a 3-question check; then the test goes on', async () => {
    await start();
    const topic = onScreen().topic;
    let guard = 0;
    while (!has('small-test-stop') && guard++ < 12) {
      const cur = onScreen();
      await answerNext(cur.topic !== topic);
    }
    expect(has('small-test-stop')).toBe(true);
    expect(text('small-test-stop-title')).toBe("Let's stop here");
    expect(text('small-test-stop-misses')).toBe('3 misses');
    expect(text('small-test-stop-topic')).toBe(TITLES[topic]);
    expect(text('fb-card')).toBe('grammar-small-test:A1:stop | en→es | A1');
    const answered = (await stateNow()).run!.answers.length;
    expect(text('small-test-header')).toBe(`A1 test · ${answered}/10`);
    expect(text('small-test-stop-then')).toBe(`Then the test continues at question ${answered + 1}.`);
    await press('small-test-stop-open');
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${topic}`);
    expect((await stateNow()).run!.phase).toBe('lesson');
    // the lesson is left (blur), then the learner comes back (focus)
    await act(async () => {
      mockFocusCleanup?.();
    });
    await act(async () => {
      mockFocusCleanup = mockFocusCb!();
    });
    await flush();
    expect(text('small-test-header')).toBe('Quick check · 1/3');
    expect(onScreen().topic).toBe(topic);
    await answerNext(true);
    expect(text('small-test-header')).toBe('Quick check · 2/3');
    await answerNext(true);
    await answerNext(false);
    expect(text('small-test-header')).toBe(`A1 test · ${answered + 1}/10`); // the check did not count as a test question
    expect(onScreen().topic).not.toBe(topic);
    expect((await stateNow()).run!.answers).toHaveLength(answered);
  });

  it('"Later, end the round" drops the round and leaves', async () => {
    await start();
    const topic = onScreen().topic;
    let guard = 0;
    while (!has('small-test-stop') && guard++ < 12) await answerNext(onScreen().topic !== topic);
    await press('small-test-stop-later');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect((await stateNow()).run).toBeNull();
  });

  it('a whole round: the end card with the score, topic statuses, the level line and the round chart; New round and Done', async () => {
    await start();
    for (let i = 0; i < 10; i++) await answerNext(true);
    expect(has('small-test-end')).toBe(true);
    expect(text('small-test-header')).toBe('A1 test · round 1');
    expect(text('small-test-end-title')).toBe('Round done · 10 of 10');
    expect(text('fb-card')).toBe('grammar-small-test:A1:end | en→es | A1');
    // 3 right answers in a row learn a topic: the topics asked 3+ times are learned, the others need one more round
    const asked = (id: string) => ((state) => state.run!.answers.filter((a) => a.topic === id).length)(round1);
    const round1 = await stateNow();
    for (const id of TOPICS) expect(text(`small-test-end-status-${id}`)).toBe(asked(id) >= 3 ? 'learned' : '1 more round');
    const coreLearned = ['lt-0', 'lt-1'].filter((id) => asked(id) >= 3).length;
    expect(text('small-test-end-level')).toBe(`A1 level · ${coreLearned} of 2 core topics learned`);
    expect(has('small-test-end-bar-0')).toBe(true);
    expect(screen.getByTestId('small-test-end-bar-0')).toHaveProp('accessibilityLabel', '100%');
    // a second round: the same topics are "repeat"
    await press('small-test-end-new');
    expect(text('small-test-header')).toBe('A1 test · round 2');
    for (const id of TOPICS) expect(text(`small-test-intro-tag-${id}`)).toBe('repeat');
    await press('small-test-start');
    for (let i = 0; i < 10; i++) await answerNext(true);
    // two clean rounds: every topic has 3+ right answers in a row by now, the core topics are learned and the level is done
    expect(text('small-test-end-level')).toBe('A1 level · 2 of 2 core topics learned');
    expect(has('small-test-end-level-done')).toBe(true);
    expect(screen.getByTestId('small-test-end-bar-1')).toBeTruthy();
    const ev = evidenceFromRows(await getDb().getGameProgress(GRAMMAR_RANDOM_KEY));
    expect(ev.get('lt-0')!.answers.every((a) => a.ok)).toBe(true);
    await press('small-test-end-done');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect((await stateNow()).run).toBeNull();
  });

  it('leaving with the X and coming back continues on the same question', async () => {
    const first = await start();
    await answerNext(true);
    await answerNext(false);
    const seen = onScreen().q.id;
    await press('small-test-close');
    expect(mockBack).toHaveBeenCalledTimes(1);
    first.unmount();
    await open();
    expect(has('small-test-intro')).toBe(false);
    expect(text('small-test-header')).toBe('A1 test · 3/10');
    expect(onScreen().q.id).toBe(seen);
  });

  it('a tap on an answer within 500 ms of a new question records nothing (the double tap after Next)', async () => {
    await start();
    const first = onScreen();
    const v = first.q.view;
    if (v.card !== 'choice') throw new Error('choice only');
    // no time passed since the question appeared: the option is ignored, the same question is still there
    fireEvent.press(screen.getByTestId(`exam-option-${v.correctIndex}`));
    await flush();
    expect(has('level-test-next')).toBe(false);
    expect(onScreen().q.id).toBe(first.q.id);
    expect(text('small-test-header')).toBe('A1 test · 1/10');
    // after the guard time the same tap counts
    await press(`exam-option-${v.correctIndex}`);
    expect(has('level-test-next')).toBe(true);
  });

  it('a saved question that is no longer in the content: another question of the topic comes, and the X is on the screen', async () => {
    const first = await start();
    const db = getDb();
    const st = await stateNow();
    const gone = { ...st.run!.current!, qid: 'gone-after-update' };
    await saveResumeValue(db, smallKey('en→es', 'A1'), { ...st, run: { ...st.run!, current: gone } });
    first.unmount();
    await open();
    expect(has('small-test-question')).toBe(true);
    expect(has('small-test-close')).toBe(true);
    expect((await stateNow()).run!.current!.qid).not.toBe('gone-after-update');
  });

  it('a typed task kind (word bank, A2): its own card; a wrong answer gets the short miss card with "I mistyped"', async () => {
    mockParams = { level: 'a2' };
    await open();
    expect(text('small-test-header')).toBe('A2 test · round 1');
    await press('small-test-start');
    expect(has('small-test-question')).toBe(true);
    expect(has('bank-item')).toBe(true);
    expect(text('fb-card')).toMatch(/^grammar-small-test:A2:lt-4-b\d \| en→es \| A1$/);
    fireEvent.changeText(screen.getByTestId('bank-input'), 'rojo');
    await press('bank-check');
    await press('grammar-next');
    expect(has('small-test-miss')).toBe(true);
    await press('small-test-mistyped');
    expect(text('small-test-header')).toBe('A2 test · 2/10');
    const st = await loadSmallState(getDb(), 'en→es', 'A2');
    expect(st.run!.answers[0]).toMatchObject({ ok: true, mistyped: true, type: 'bank' });
    // a right typed answer goes straight on
    fireEvent.changeText(screen.getByTestId('bank-input'), 'rojos');
    await press('bank-check');
    await press('grammar-next');
    expect(text('small-test-header')).toBe('A2 test · 3/10');
  });
});
