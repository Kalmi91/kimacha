// The random grammar round screen, played the way a learner plays it: the first round is a full check, the
// next ones are mixed (10 check questions -> check result with the weak topics -> practice with an explanation
// -> re-check -> end with before -> now), a closed app resumes at the same question, the ✕ keeps the round.
// The lessons are mocked (three topics built from the legacy fixture), the engine is the real one.
// Mock pattern: lessonTest.test.tsx / course.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
// the chime is a sound: not in jest. The mock ends it at once, so what follows it (the sentence) runs.
jest.mock('@/lib/chime', () => ({ playChime: jest.fn((done?: () => void) => done?.()) }));
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({}),
}));

// Eight written topics (four at A1, four at A2), each with 12 choice items of the legacy fixture (a full round
// of 20 needs at least 7 topics: it asks 3 answers per topic first). The sentence carries the topic id in front,
// so a question on screen can be told apart from the others'.
jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const base = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  const defs = names.map((name, i) => ({ id: `rr-${i}`, level: i < 4 ? 'A1' : 'A2', title: `${name} topic` }));
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
    syllabusLevels: () => ['A1', 'A2'],
    syllabusForLevel: (level: string) => topics.filter((tp) => tp.level === level),
    hasLesson: (_lang: string, id: string) => id in lessons,
    lessonFor: (_lang: string, id: string) => lessons[id],
    getGrammarTier: () => 'core',
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { playChime } from '@/lib/chime';
import { speak } from '@/lib/speech';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import {
  GRAMMAR_RANDOM_KEY,
  META_ITEM_ID,
  RUN_ITEM_ID,
  evidenceFromRows,
  runFromRows,
  topicPercent,
} from '@/lib/grammar/randomRound';
import { ThemeProvider } from '@/lib/ThemeContext';
import RandomRoundScreen from '../random';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const NOW = 1700000000000;
const SEED = NOW % 2147483647;
const TOPICS = Array.from({ length: 8 }, (_, i) => `rr-${i}`);
const NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
const TITLES: Record<string, string> = Object.fromEntries(TOPICS.map((id, i) => [id, `${NAMES[i]} topic`]));

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

// The question on screen, found by its sentence.
const onScreen = () => {
  const sentence = text('exam-text');
  const found = questions.find((x) => x.q.view.card === 'choice' && x.q.view.text === sentence);
  if (!found) throw new Error(`no question for "${sentence}"`);
  return found;
};

// Answers the question on screen (a tap on the right or a wrong option; a wrong one needs its "Next", except in the
// practice, where the card hands the answer over at once and the explanation card shows the right one).
const answer = async (ok: boolean, instant = false) => {
  const found = onScreen();
  const v = found.q.view;
  if (v.card !== 'choice') throw new Error('choice only');
  await press(`exam-option-${ok ? v.correctIndex : (v.correctIndex + 1) % v.options.length}`);
  if (!ok && !instant) await press('exam-next');
  return found;
};

const rows = () => getDb().getGameProgress(GRAMMAR_RANDOM_KEY);

describe.each(['brand', 'classic'] as const)('random grammar round (%s palette)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
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
        <RandomRoundScreen />
      </ThemeProvider>
    );
    await flush();
    return view;
  };
  // the next rounds are mixed ones: the first (nothing finished yet) is the full check.
  const mixedNext = () => getDb().setGameProgress(GRAMMAR_RANDOM_KEY, META_ITEM_ID, 'meta', { rounds: 1 });

  it('the first round is a full check: intro line, 20 questions, no topic name before the answer', async () => {
    await open();
    expect(text('random-counter')).toBe('Full check 1/20');
    expect(screen.getByTestId('random-full-intro')).toBeTruthy();
    expect(screen.queryByTestId('random-ladder-A1')).toBeNull();
    for (const title of Object.values(TITLES)) expect(screen.queryByText(title)).toBeNull();
    await answer(true);
    expect(text('random-counter')).toBe('Full check 2/20');
    expect(screen.queryByTestId('random-full-intro')).toBeNull();
  });

  describe('FB549: the sentence, the chime and the green mark', () => {
    const mockChime = playChime as jest.Mock;
    const mockSpeak = speak as jest.Mock;

    it('a right answer chimes, then reads the right sentence aloud, and a green badge marks it', async () => {
      await open();
      const { q } = onScreen();
      expect(q.say).toBeTruthy();
      await answer(true);
      expect(mockChime).toHaveBeenCalledTimes(1);
      expect(mockSpeak).toHaveBeenCalledTimes(1);
      expect(mockSpeak).toHaveBeenCalledWith(q.say, 'es-MX');
      expect(mockChime.mock.invocationCallOrder[0]).toBeLessThan(mockSpeak.mock.invocationCallOrder[0]);
      expect(screen.getByTestId('random-right-mark')).toHaveTextContent(/Correct/);
    });

    it('the sentence waits for the end of the chime', async () => {
      mockChime.mockImplementationOnce(() => {}); // a chime that is still playing
      await open();
      const { q } = onScreen();
      await answer(true);
      expect(mockSpeak).not.toHaveBeenCalled();
      mockChime.mock.calls[0][0]();
      expect(mockSpeak).toHaveBeenCalledWith(q.say, 'es-MX');
    });

    it('a wrong answer does not chime, the right sentence is still read aloud, nothing is marked green', async () => {
      await open();
      const { q } = onScreen();
      await answer(false);
      expect(mockChime).not.toHaveBeenCalled();
      expect(mockSpeak).toHaveBeenCalledWith(q.say, 'es-MX');
      expect(screen.queryByTestId('random-right-mark')).toBeNull();
    });

    it('practice: the explanation card of a right answer is green, a wrong one is not; both read the sentence', async () => {
      await mixedNext();
      await open();
      for (let i = 0; i < 10; i++) await answer(i >= 4);
      await press('random-practice-these');
      mockChime.mockClear();
      mockSpeak.mockClear();
      const right = await answer(true, true);
      expect(screen.getByTestId('random-feedback-green')).toBeTruthy();
      expect(text('random-feedback-answer')).toBe(right.q.review.answer);
      expect(mockChime).toHaveBeenCalledTimes(1);
      expect(mockSpeak).toHaveBeenLastCalledWith(right.q.say, 'es-MX');
      expect(screen.queryByTestId('random-right-mark')).toBeNull(); // the card is the mark here
      await press('random-next');
      const wrong = await answer(false, true);
      expect(screen.queryByTestId('random-feedback-green')).toBeNull();
      expect(mockChime).toHaveBeenCalledTimes(1);
      expect(mockSpeak).toHaveBeenLastCalledWith(wrong.q.say, 'es-MX');
    });
  });

  it('a full round to the end: topics with their percent or the answers so far, then another round is a mixed one', async () => {
    await open();
    for (let i = 0; i < 20; i++) await answer(true);
    expect(screen.getByTestId('random-end-full')).toHaveTextContent('Full check 20/20');
    const evidence = evidenceFromRows(await rows());
    const touched = [...evidence.keys()];
    expect(touched.length).toBeGreaterThan(5); // the full round spreads over the topics
    for (const id of touched) {
      const pct = topicPercent(evidence.get(id));
      expect(text(`random-end-pct-${id}`)).toBe(pct === null ? `${evidence.get(id)!.answers.length}/3 answers` : `${pct}%`);
    }
    const meta = (await rows()).find((r) => r.itemId === META_ITEM_ID);
    expect(meta?.data).toEqual({ rounds: 1 });
    expect((await rows()).find((r) => r.itemId === RUN_ITEM_ID)).toMatchObject({ state: 'none', data: null });
    await press('random-another');
    expect(text('random-counter')).toBe('Check 1/10'); // the second round is a mixed one
    await press('random-close');
    await press('random-leave');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('FB550: every topic row of the end screen opens that topic\'s lesson, the round stays', async () => {
    await open();
    for (let i = 0; i < 20; i++) await answer(true);
    const touched = [...evidenceFromRows(await rows()).keys()];
    expect(touched.length).toBeGreaterThan(5);
    for (const id of touched) expect(screen.getByTestId(`random-open-${id}`)).toBeTruthy();
    await press(`random-open-${touched[0]}`);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${touched[0]}`);
    expect(screen.getByTestId('random-end-full')).toBeTruthy(); // a push: the end screen is still there
    await press(`random-open-${touched[touched.length - 1]}`);
    expect(mockPush).toHaveBeenLastCalledWith(`/grammar/${touched[touched.length - 1]}`);
  });

  it('FB550: a weak topic of the mixed round\'s check result opens its lesson', async () => {
    await mixedNext();
    await open();
    for (let i = 0; i < 10; i++) await answer(i >= 4);
    const saved = runFromRows(await rows())!;
    expect(saved.weak.length).toBeGreaterThan(0);
    await press(`random-open-${saved.weak[0]}`);
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${saved.weak[0]}`);
    expect(screen.getByTestId('random-practice-these')).toBeTruthy(); // the result pause stays
  });

  it('a full round marks the topic that is ticked off: 5+ answers, 80%, two kinds', async () => {
    // every topic has 4 right answers of two kinds: nothing is needed any more, each topic gets 2 more questions
    for (const topic of TOPICS) {
      const answers = (['form', 'form', 'choice', 'choice'] as const).map((kind, i) => ({ id: `seed-${topic}-${i}`, kind, ok: true, at: '2026-10-30' }));
      await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, topic, 'evidence', { answers });
    }
    await open();
    for (let i = 0; i < 40 && screen.queryByTestId('exam-text'); i++) await answer(true);
    expect(screen.getByTestId('random-end-full')).toHaveTextContent('Full check 16/16');
    for (const topic of TOPICS) {
      expect(text(`random-end-pct-${topic}`)).toBe('100%');
      expect(screen.getByTestId(`random-end-ticked-${topic}`)).toHaveTextContent('✓ ticked off');
    }
  });

  it('a mixed round: check on the ladder, check result with the weak topics, practice with explanation, re-check, before -> now', async () => {
    await mixedNext();
    await open();
    expect(text('random-counter')).toBe('Check 1/10');
    expect(screen.getByTestId('random-ladder-A1')).toBeTruthy();
    expect(screen.getByTestId('random-ladder-A2')).toBeTruthy();
    expect(screen.queryByTestId('random-full-intro')).toBeNull();

    for (let i = 0; i < 10; i++) {
      expect(text('random-counter')).toBe(`Check ${i + 1}/10`);
      for (const title of Object.values(TITLES)) expect(screen.queryByText(title)).toBeNull();
      await answer(i >= 4); // the first four are wrong
    }

    // the check result
    expect(text('random-result-score')).toBe('6/10');
    expect(screen.getByTestId('random-result-level')).toBeTruthy();
    const saved = runFromRows(await rows())!;
    expect(saved.weak.length).toBeGreaterThan(0);
    for (const id of saved.weak) expect(screen.getByTestId(`random-weak-${id}`)).toHaveTextContent(TITLES[id]);
    expect(screen.getByTestId('random-practice-these')).toBeTruthy();

    // practice: the topic title is on screen, the explanation card follows every answer
    await press('random-practice-these');
    for (let i = 0; i < 8; i++) {
      expect(text('random-counter')).toBe(`Practice ${i + 1}/8`);
      expect(screen.getByTestId('random-practice-title')).toBeTruthy();
      const { topic, q } = await answer(i !== 0, true);
      // only the explanation card: no "Not quite!" reveal and no Next of the exam card on top of it
      expect(screen.queryByTestId('exam-next')).toBeNull();
      expect(screen.queryByText('Not quite!')).toBeNull();
      expect(text('random-counter')).toBe(`Practice ${i + 1}/8`);
      expect(text('random-feedback-question')).toBe(q.review.question);
      expect(text('random-feedback-answer')).toBe(q.review.answer);
      if (q.review.why) expect(text('random-feedback-why')).toBe(q.review.why);
      expect(screen.getByTestId('random-feedback-badge')).toBeTruthy();
      if (i === 0) {
        expect(screen.getByTestId('random-feedback-badge')).toHaveTextContent(/Not quite$/);
        await press('random-rule');
        expect(mockPush).toHaveBeenCalledWith(`/grammar/${topic}`);
        expect(screen.getByTestId('random-feedback-badge')).toBeTruthy(); // the round stays where it was
      }
      await press('random-next');
    }

    // re-check: one question per weak topic
    const n = saved.weak.length;
    for (let i = 0; i < n; i++) {
      expect(text('random-counter')).toBe(`Re-check ${i + 1}/${n}`);
      await answer(true);
    }

    // the end
    expect(screen.getByTestId('random-end-check')).toHaveTextContent('Check 6/10');
    expect(screen.getByTestId('random-end-practice')).toHaveTextContent('Practice 7/8');
    expect(screen.getByTestId('random-end-recheck')).toHaveTextContent(`Re-check ${n}/${n}`);
    const evidence = evidenceFromRows(await rows());
    for (const id of saved.weak) {
      const before = saved.before[id];
      const now = topicPercent(evidence.get(id));
      const pct = (p: number | null) => (p === null ? '–' : `${p}%`);
      expect(text(`random-end-topic-${id}`)).toBe(`${TITLES[id]} ${pct(before)} → ${pct(now)}`);
    }
    mockPush.mockClear();
    await press(`random-open-${saved.weak[0]}`); // FB550: the end screen's weak list opens the lesson too
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${saved.weak[0]}`);
    expect((await rows()).find((r) => r.itemId === META_ITEM_ID)?.data).toEqual({ rounds: 2 });
    expect((await rows()).find((r) => r.itemId === RUN_ITEM_ID)).toMatchObject({ state: 'none', data: null });
    await press('random-done');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('a check without a wrong answer: no weak topic, "another round" or done', async () => {
    await mixedNext();
    await open();
    for (let i = 0; i < 10; i++) await answer(true);
    expect(text('random-result-score')).toBe('10/10');
    expect(screen.getByTestId('random-no-weak')).toHaveTextContent('No weak topics in this round.');
    expect(screen.queryByTestId('random-practice-these')).toBeNull();
    expect((await rows()).find((r) => r.itemId === META_ITEM_ID)?.data).toEqual({ rounds: 2 });
    await press('random-another');
    expect(text('random-counter')).toBe('Check 1/10');
  });

  it('"Done" on the check result ends the round there: it is counted, the practice is skipped', async () => {
    await mixedNext();
    await open();
    for (let i = 0; i < 10; i++) await answer(i >= 3);
    expect(screen.getByTestId('random-practice-these')).toBeTruthy();
    expect((await rows()).find((r) => r.itemId === META_ITEM_ID)?.data).toEqual({ rounds: 1 });
    await press('random-done');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect((await rows()).find((r) => r.itemId === META_ITEM_ID)?.data).toEqual({ rounds: 2 });
    expect((await rows()).find((r) => r.itemId === RUN_ITEM_ID)).toMatchObject({ state: 'none', data: null });
  });

  it('every answer is saved as evidence of its topic', async () => {
    await mixedNext();
    await open();
    const first = await answer(true);
    const second = await answer(false);
    const evidence = evidenceFromRows(await rows());
    const mine = (topic: string) => [first, second].filter((x) => x.topic === topic);
    for (const topic of new Set([first.topic, second.topic])) {
      const answers = evidence.get(topic)!.answers;
      expect(answers.map((a) => a.id)).toEqual(mine(topic).map((x) => x.q.id));
      expect(answers.map((a) => a.ok)).toEqual(mine(topic).map((x) => x === first));
    }
  });

  it('continue: the screen closed in the middle comes back at the same question and counter', async () => {
    await mixedNext();
    const view = await open();
    await answer(true);
    await answer(false);
    await answer(true);
    expect(text('random-counter')).toBe('Check 4/10');
    const sentence = text('exam-text');
    view.unmount();
    await flush();
    await open();
    expect(text('random-counter')).toBe('Check 4/10');
    expect(text('exam-text')).toBe(sentence);
    expect(text('random-counter')).toBe('Check 4/10');
    await answer(true);
    expect(text('random-counter')).toBe('Check 5/10');
  });

  it('continue on the check result: the result comes back until the practice starts', async () => {
    await mixedNext();
    const view = await open();
    for (let i = 0; i < 10; i++) await answer(i >= 2);
    const score = text('random-result-score');
    view.unmount();
    await flush();
    await open();
    expect(text('random-result-score')).toBe(score);
    await press('random-practice-these');
    expect(text('random-counter')).toBe('Practice 1/8');
  });

  it('✕ asks first, "keep going" returns to the question, leaving keeps the round', async () => {
    await mixedNext();
    await open();
    await answer(true);
    await press('random-close');
    expect(screen.getByTestId('random-leave-overlay')).toBeTruthy();
    expect(screen.getByText('Leave the round?')).toBeTruthy();
    expect(screen.getByText('Your answers are saved. You can continue later.')).toBeTruthy();
    await press('random-keep-going');
    expect(screen.queryByTestId('random-leave-overlay')).toBeNull();
    expect(text('random-counter')).toBe('Check 2/10');
    await press('random-close');
    await press('random-leave');
    expect(mockBack).toHaveBeenCalledTimes(1);
    const run = runFromRows(await rows());
    expect(run?.steps).toHaveLength(1);
    expect(run?.pending).not.toBeNull();
  });

  it('✕ does not remount the question: a revealed wrong answer stays revealed and cannot be answered again', async () => {
    await mixedNext();
    await open();
    const { q } = onScreen();
    const v = q.view;
    if (v.card !== 'choice') throw new Error('choice only');
    await press(`exam-option-${(v.correctIndex + 1) % v.options.length}`); // wrong: the card reveals the right option
    expect(screen.getByTestId('exam-next')).toBeTruthy();
    await press('random-close');
    await press('random-keep-going');
    // the same card as it was left: still revealed, still waiting for Next, a tap on the right option does nothing
    expect(screen.getByTestId('exam-next')).toBeTruthy();
    expect(text('random-counter')).toBe('Check 1/10');
    await press(`exam-option-${v.correctIndex}`);
    expect(text('random-counter')).toBe('Check 1/10');
    expect(evidenceFromRows(await rows()).size).toBe(0);
    await press('exam-next');
    expect(text('random-counter')).toBe('Check 2/10');
    const answers = [...evidenceFromRows(await rows()).values()].flatMap((e) => e.answers);
    expect(answers.map((a) => [a.id, a.ok])).toEqual([[q.id, false]]);
  });

  it('saves the round before the evidence, and on closing the round before the counter', async () => {
    await mixedNext();
    await open();
    const spy = jest.spyOn(getDb(), 'setGameProgress');
    const saved = () => spy.mock.calls.filter((c) => c[0] === GRAMMAR_RANDOM_KEY).map((c) => `${c[1]}:${c[2]}`);
    try {
      await answer(true);
      let calls = saved();
      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe(`${RUN_ITEM_ID}:run`);
      expect(calls[1]).toMatch(/^rr-[0-9]+:evidence$/);
      spy.mockClear();
      for (let i = 0; i < 9; i++) await answer(true); // the 10th answer ends a check without a wrong answer: the round is closed
      calls = saved();
      const last = calls.slice(-3);
      expect(last[0]).toBe(`${RUN_ITEM_ID}:none`);
      expect(last[1]).toBe(`${META_ITEM_ID}:meta`);
      expect(last[2]).toMatch(/^rr-[0-9]+:evidence$/);
    } finally {
      spy.mockRestore();
    }
  });
});
