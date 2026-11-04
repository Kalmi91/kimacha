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

// lt-0 core+ (Alpha), lt-1 core (Beta), lt-2 exam (Gamma), lt-3 full (Delta), all A1; lt-4 core at A2; lt-5 core at B1 holds three typed
// form items (a table, a rule, a typed-mistake text); C1 has no topic.
jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const base = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const defs = [
    { id: 'lt-0', level: 'A1', title: 'Alpha topic', tier: 'core-plus' },
    { id: 'lt-1', level: 'A1', title: 'Beta topic', tier: 'core' },
    { id: 'lt-2', level: 'A1', title: 'Gamma topic', tier: 'exam' },
    { id: 'lt-3', level: 'A1', title: 'Delta topic', tier: 'full' },
    { id: 'lt-4', level: 'A2', title: 'Epsilon topic', tier: 'core' },
    { id: 'lt-5', level: 'B1', title: 'Zeta topic', tier: 'core' },
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
  const wrongLos = { 'los gustan': { en: 'Los is a direct object pronoun.', es: 'Los es un pronombre de objeto directo.' } };
  const formItem = (id: string, verb: string, person: string, answer: string) => ({ id, kind: 'form', verb, person, answer, table: 'lt5-table', wrong: wrongLos });
  lessons['lt-5'] = {
    ...base,
    topic: 'lt-5',
    level: 'B1',
    body: [
      { kind: 'text', text: { en: 'Gustar always takes an indirect pronoun: me, te, le, nos, les.', es: 'Gustar lleva siempre un pronombre indirecto.' } },
      {
        kind: 'table',
        id: 'lt5-table',
        title: { en: 'Gustar, present', es: 'Gustar, presente' },
        header: [
          { en: 'Person', es: 'Persona' },
          { en: 'one thing', es: 'una cosa' },
          { en: 'several things', es: 'varias cosas' },
        ],
        rows: [
          ['yo', 'me gusta', 'me gustan'],
          ['nosotros', 'nos gusta', 'nos gustan'],
          ['ellos/ellas/ustedes', 'les gusta', 'les gustan'],
        ],
      },
    ],
    items: [
      formItem('lt5-f1', 'una cosa', 'yo', 'me gusta'),
      formItem('lt5-f2', 'varias cosas', 'yo', 'me gustan'),
      formItem('lt5-f3', 'varias cosas', 'ellos/ellas/ustedes', 'les gustan'),
    ],
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

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { playChime } from '@/lib/chime';
import { speak } from '@/lib/speech';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { levelRoundKey } from '@/lib/grammar/levelTest';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { GRAMMAR_RANDOM_KEY, evidenceFromRows, topicPercent, topicTicked, type EvidenceAnswer } from '@/lib/grammar/randomRound';
import { ThemeProvider } from '@/lib/ThemeContext';
import LevelTestScreen from '../level-test';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const NOW = 1700000000000;
const SEED = NOW % 2147483647;
const TOPICS = ['lt-0', 'lt-1', 'lt-2', 'lt-3', 'lt-4', 'lt-5'];

const flush = makeFlush(4);
const roundKey = (level: string) => levelRoundKey('en→es', level);
const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const text = (testID: string) => {
  const c = screen.getByTestId(testID).props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

// the whole text of a node with nested Text children
const flat = (testID: string): string => {
  const walk = (n: any): string => (typeof n === 'string' ? n : (n.children ?? []).map(walk).join(''));
  return walk(screen.getByTestId(testID));
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

// Every answer stops on its result card; the test moves on only with Next (FB578).
const next = () => press('level-test-next');
// A tap on the right or on a wrong option; the card hands the answer over at once.
const answer = async (ok: boolean) => {
  const found = onScreen();
  const v = found.q.view;
  if (v.card !== 'choice') throw new Error('choice only');
  await press(`exam-option-${ok ? v.correctIndex : (v.correctIndex + 1) % v.options.length}`);
  return found;
};
// the answer, then Next: the following question is on screen
const answerNext = async (ok: boolean) => {
  const found = await answer(ok);
  await next();
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
    for (const lvl of ['A1', 'A2', 'B1', 'C1']) await saveResumeValue(db, roundKey(lvl), null);
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
    expect(text('level-test-header')).toBe('A1 · 0% · 1/20');
    expect(screen.getByTestId('level-test-progress')).toBeTruthy();
    for (const name of ['Alpha topic', 'Beta topic', 'Gamma topic', 'Delta topic', 'Epsilon topic']) expect(screen.queryByText(name)).toBeNull();
    // the A2 topic is not part of the A1 test
    expect(screen.queryByText(/lt-4/)).toBeNull();
  });

  it('a right answer chimes, reads the sentence, stops on a green result card and goes into the topic evidence; only Next moves on to another topic', async () => {
    await open();
    const { q } = await answer(true);
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(q.say, 'es-MX');
    expect((playChime as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((speak as jest.Mock).mock.invocationCallOrder[0]);
    expect(screen.getByTestId('level-test-feedback-badge')).toHaveTextContent(/Correct/);
    expect(screen.queryByTestId('exam-text')).toBeNull(); // no next question under the card
    const ev = await evidenceNow();
    expect(ev.get('lt-0')?.answers).toEqual([{ id: q.id, kind: q.kind, ok: true, at: expect.any(String) }]);
    await next();
    expect(topicOnScreen()).toBe('lt-1'); // never the same topic twice in a row, and lt-1 has no answer yet
  });

  it('a wrong answer shows the right one, the why and a link to the lesson; Next goes on', async () => {
    await open();
    await answerNext(true); // lt-0
    const { q, topic } = await answer(false); // lt-1
    expect(topic).toBe('lt-1');
    expect(playChime).toHaveBeenCalledTimes(1); // only the right answer chimed
    expect(speak).toHaveBeenLastCalledWith(q.say, 'es-MX');
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
    expect(text('level-test-header')).toBe('A1 · 92% · 1/20'); // 3 topics at 100, lt-0 with 2 right answers counts 67
    await answer(true);
    expect(text('level-test-header')).toBe('A1 · 100% · 1/20');
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
    await answerNext(true);
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
      expect(screen.getByTestId('level-test-feedback-badge')).toBeTruthy(); // the result card of that answer is under it
      await next();
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
      expect(text('level-test-header')).toBe('A1 · 97% · 1/20');
    });
  });

  it('a topic with every question in the window keeps coming back instead of drying up', async () => {
    // the topic has 12 questions: 14 right answers in a row on a single-topic level never stop the stream
    mockParams = { level: 'A2' };
    await open();
    expect(topicOnScreen()).toBe('lt-4');
    for (let i = 0; i < 14; i++) {
      expect(topicOnScreen()).toBe('lt-4');
      await answer(true);
      if (screen.queryByTestId('level-test-done')) await press('level-test-done-keep'); // ticked after the 5th answer
      await next();
    }
    expect((await evidenceNow()).get('lt-4')?.answers).toHaveLength(10);
  });

  it('a topic whose lesson has one exercise kind ticks on answers and percent alone, and the level is done', async () => {
    // lt-4 (the only topic of A2) has choice questions only: five right answers tick it and finish the level
    mockParams = { level: 'A2' };
    await open();
    for (let i = 0; i < 4; i++) await answerNext(true);
    expect(screen.queryByTestId('level-test-done')).toBeNull();
    expect(topicTicked((await evidenceNow()).get('lt-4'))).toBe(false); // the plain rule asks two kinds
    await answer(true);
    expect(text('level-test-done-title')).toBe('A2: every topic ticked off');
  });

  describe('the result card (FB578, FB580, FB588)', () => {
    it('a right answer stops on the card: badge, the filled sentence with the right word, the topic, Next and the lesson link; nothing moves on by itself', async () => {
      await open();
      const { q } = await answer(true);
      expect(screen.getByTestId('level-test-feedback-badge')).toHaveTextContent(/Correct/);
      expect(flat('level-test-feedback-sentence')).toBe(q.review.answer);
      expect(text('level-test-topic')).toBe('Alpha topic');
      expect(screen.getByTestId('level-test-next')).toBeTruthy();
      expect(screen.getByText('Open the lesson')).toBeTruthy();
      expect(screen.queryByTestId('exam-text')).toBeNull();
      expect(screen.queryByTestId('level-test-right-mark')).toBeNull();
      await press('level-test-rule');
      expect(mockPush).toHaveBeenCalledWith('/grammar/lt-0');
      expect(screen.getByTestId('level-test-feedback-badge')).toBeTruthy(); // back from the lesson: still the card
    });

    it('a right answer offers "Why not the others?", and it opens in place with the text of every wrong option', async () => {
      await open();
      const { q } = await answer(true);
      const whyNot = q.detail?.whyNot ?? [];
      expect(whyNot.length).toBeGreaterThan(0);
      expect(screen.queryByTestId('level-test-whynot')).toBeNull();
      await press('level-test-whynot-link');
      expect(screen.queryByTestId('level-test-whynot-link')).toBeNull();
      for (const w of whyNot) expect(flat('level-test-whynot')).toContain(`${w.option}: ${w.text}`);
      expect(screen.getByTestId('level-test-next')).toBeTruthy(); // still on the same card
    });

    it('a wrong choice shows the question, what was chosen, the right answer, the why and every why-not text, no extra link', async () => {
      await open();
      const { q } = await answer(false);
      const v = q.view;
      if (v.card !== 'choice') throw new Error('choice only');
      const chosen = v.options[(v.correctIndex + 1) % v.options.length];
      expect(text('level-test-feedback-question')).toBe(q.review.question);
      expect(screen.getByTestId('level-test-feedback-given')).toHaveTextContent(`You chose: ${chosen}`);
      expect(text('level-test-feedback-answer')).toBe(q.review.answer);
      expect(screen.getByTestId('level-test-feedback-why')).toHaveTextContent(q.review.why ?? '');
      for (const w of q.detail?.whyNot ?? []) expect(flat('level-test-whynot')).toContain(`${w.option}: ${w.text}`);
      expect(screen.queryByTestId('level-test-whynot-link')).toBeNull();
      expect(screen.getByTestId('level-test-practice')).toBeTruthy(); // Practice is offered on a wrong answer
    });
  });

  describe('typed form questions (FB576, FB577, FB589)', () => {
    const formOnScreen = () => {
      const prompt = text('exam-prompt');
      const found = questions.find((x) => x.q.view.card === 'type' && x.q.view.prompt === prompt);
      if (!found) throw new Error(`no form question for "${prompt}"`);
      return found;
    };
    const typeIn = async (value: string) => {
      fireEvent.changeText(screen.getByTestId('exam-input'), value);
      await press('exam-check');
    };

    it('the task reads verb (meaning) · person with the hint to type the form of the verb', async () => {
      mockParams = { level: 'B1' };
      await open();
      const { q } = formOnScreen();
      expect(text('exam-prompt')).toMatch(/^(una|varias) cosas \(.*\) · (yo|ellos\/ellas\/ustedes)$/);
      expect(text('exam-hint')).toBe('Type the form of the verb');
      expect(q.view).toMatchObject({ card: 'type' });
    });

    it("a typed mistake: 'You typed' and the right answer have the differing words marked, the item's own text, the table with the asked cell", async () => {
      mockParams = { level: 'B1' };
      await open();
      const { q } = formOnScreen();
      await typeIn('los gustan');
      expect(screen.getByTestId('level-test-feedback-given')).toHaveTextContent('You typed: los gustan');
      expect(flat('level-test-feedback-answer')).toBe(q.review.answer);
      // the differing word is struck in what was typed and bold in the right answer; the other word is plain
      const given = screen.getByTestId('level-test-feedback-given');
      const struck = given.findAll((n) => n.props.style?.textDecorationLine === 'line-through' && n.props.children !== undefined);
      expect(struck.length).toBeGreaterThan(0);
      expect(screen.getByTestId('level-test-feedback-typed')).toHaveTextContent('Los is a direct object pronoun.');
      expect(screen.getByTestId('level-test-table')).toBeTruthy();
      expect(flat('level-test-table-hl')).toBe(q.review.answer);
    });

    it('a typed answer that is another cell of the table says which form it is', async () => {
      mockParams = { level: 'B1' };
      await open();
      formOnScreen();
      await typeIn('nos gusta');
      expect(screen.getByTestId('level-test-feedback-typed')).toHaveTextContent('That is another form: nosotros · one thing.');
    });

    it('anything else shows the rule before the table', async () => {
      mockParams = { level: 'B1' };
      await open();
      formOnScreen();
      await typeIn('zzz');
      // the item has a table: the generic rule would only push the table down, so it is not shown
      expect(screen.queryByTestId('level-test-feedback-typed')).toBeNull();
      expect(screen.getByTestId('level-test-table-hl')).toBeTruthy();
    });

    it('"I don\'t know" shows the right answer and the rule, no "You typed" line', async () => {
      mockParams = { level: 'B1' };
      await open();
      const { q } = formOnScreen();
      await press('exam-dont-know');
      expect(screen.queryByTestId('level-test-feedback-given')).toBeNull();
      expect(text('level-test-feedback-answer')).toBe(q.review.answer);
      // the item has a table: the generic rule would only push the table down, so it is not shown
      expect(screen.queryByTestId('level-test-feedback-typed')).toBeNull();
      expect(screen.getByTestId('level-test-table-hl')).toBeTruthy();
    });

    it('a right typed answer: green card, the task and the answer, no table', async () => {
      mockParams = { level: 'B1' };
      await open();
      const { q } = formOnScreen();
      await typeIn(q.review.answer);
      expect(screen.getByTestId('level-test-feedback-badge')).toHaveTextContent(/Correct/);
      expect(text('level-test-feedback-question')).toBe(q.review.question);
      expect(text('level-test-feedback-answer')).toBe(q.review.answer);
      expect(screen.queryByTestId('level-test-table')).toBeNull();
    });
  });

  describe('rounds of 20 (FB581)', () => {
    const KEY = roundKey('A1');
    const saved = async () => loadResumeValue(getDb(), KEY);

    it('the header counts the question of the round and every answer is saved', async () => {
      await open();
      expect(text('level-test-header')).toBe('A1 · 0% · 1/20');
      await answer(true);
      expect(text('level-test-header')).toBe('A1 · 8% · 1/20'); // the card of the 1st answer: 1 right of 1 moves the level (33 / 4 topics)
      await next();
      expect(text('level-test-header')).toBe('A1 · 8% · 2/20');
      await answerNext(false);
      expect(text('level-test-header')).toBe('A1 · 8% · 3/20');
      expect(await saved()).toEqual({ n: 2, right: 1, startPct: 0 });
    });

    it('re-entry mid-round: the position and the right count survive leaving, and a damaged value starts a new round', async () => {
      const view = await open();
      await answerNext(true);
      await answerNext(true);
      await press('level-test-close');
      view.unmount();
      const second = await open();
      expect(text('level-test-header')).toContain('3/20');
      second.unmount();

      await saveResumeValue(getDb(), KEY, { n: 99, right: 3 });
      const again = await open();
      expect(text('level-test-header')).toBe('A1 · 17% · 1/20');
      again.unmount();
      // the pair and the level are separate rounds
      await saveResumeValue(getDb(), roundKey('A2'), { n: 7, right: 2, startPct: 10 });
      await open();
      expect(text('level-test-header')).toBe('A1 · 17% · 1/20');
    });

    const nearEnd = async () => {
      // lt-1..lt-3 ticked, lt-2 at 50% would not tick: keep lt-2 weakest among the percents; lt-0 has two right answers
      await seedEvidence('lt-0', ['c', 'c']);
      await seedEvidence('lt-1', TICKED);
      await seedEvidence('lt-2', ['c', 'c', 'x', 'x']);
      await seedEvidence('lt-3', TICKED);
      await saveResumeValue(getDb(), KEY, { n: 19, right: 10, startPct: 60 });
    };

    it('after the 20th result comes the round screen: right count, level percent before and after, the weakest topic, Next 20, Leave', async () => {
      await nearEnd();
      await open();
      expect(text('level-test-header')).toMatch(/· 20\/20$/); // the 20th question
      await answer(true);
      expect(text('level-test-header')).toMatch(/· 20\/20$/);
      expect(screen.queryByTestId('level-test-round-score')).toBeNull(); // the 20th result card first
      await next();
      expect(text('level-test-round-score')).toBe('11 / 20');
      const after = /A1 · (\d+)% · 20\/20/.exec(text('level-test-header'))![1];
      expect(text('level-test-round-levels')).toBe(`A1 level: 60% → ${after}%`);
      expect(text('level-test-round-weakest')).toBe('Gamma topic · 50%');
      expect(text('fb-card')).toBe('grammar-level-test:A1:round-end | en→es | A1');
      expect(screen.queryByTestId('exam-text')).toBeNull();
    });

    it('Next 20 starts a fresh round on the next question; Leave goes back and the finished round is not shown again', async () => {
      await nearEnd();
      const view = await open();
      await answerNext(true);
      await press('level-test-round-next');
      const pctNow = /A1 · (\d+)%/.exec(text('level-test-header'))![1];
      expect(text('level-test-header')).toBe(`A1 · ${pctNow}% · 1/20`);
      expect(screen.getByTestId('exam-text')).toBeTruthy();
      expect(await saved()).toEqual({ n: 0, right: 0, startPct: Number(pctNow) });
      view.unmount();

      await saveResumeValue(getDb(), KEY, { n: 20, right: 12, startPct: 30 });
      await open();
      expect(text('level-test-round-score')).toBe('12 / 20'); // killed on the 20th card: the summary is still due
      await press('level-test-round-leave');
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(await saved()).toBeNull();
    });

    it('when the level is done on the 20th answer the done screen goes first, then the result card, then the round screen', async () => {
      for (const id of ['lt-0', 'lt-1', 'lt-2']) await seedEvidence(id, TICKED);
      await seedEvidence('lt-3', ['f', 'c', 'f', 'c']);
      await saveResumeValue(getDb(), KEY, { n: 19, right: 19, startPct: 90 });
      await open();
      await answer(true);
      expect(text('level-test-done-title')).toBe('A1: every topic ticked off');
      expect(screen.queryByTestId('level-test-round-score')).toBeNull();
      await press('level-test-done-keep');
      expect(screen.getByTestId('level-test-feedback-badge')).toBeTruthy();
      await next();
      expect(text('level-test-round-score')).toBe('20 / 20');
      expect(screen.queryByTestId('level-test-done')).toBeNull(); // once
    });
  });

  describe('Practice after a wrong answer (FB574, FB575)', () => {
    const typeWrongForm = async () => {
      mockParams = { level: 'B1' };
      await open();
      fireEvent.changeText(screen.getByTestId('exam-input'), 'zzz');
      await press('exam-check');
    };

    it('the wrong-answer card offers "Practice this · N" below Next, a right answer does not', async () => {
      await typeWrongForm();
      // 3 forms of the verb column (rows of the table) + the 2 other form items
      expect(screen.getByTestId('level-test-practice')).toHaveTextContent('Practice this · 5');
    });

    it('Practice shows the rule, counts 1/5, writes no evidence, leaves the percent and the round alone; ✕ lands on the next test question', async () => {
      await typeWrongForm();
      const before = await evidenceNow();
      const pct = /· (\d+)% ·/.exec(text('level-test-header'))![1];
      await press('level-test-practice');
      expect(text('level-practice-header')).toBe('Practice · 1/5');
      expect(screen.queryByTestId('level-test-table') ?? screen.queryByTestId('level-practice-rule')).toBeTruthy();
      expect(text('fb-card')).toMatch(/^grammar-level-practice:B1:lt5-f\d \| en→es \| A1$/);
      fireEvent.changeText(screen.getByTestId('exam-input'), 'zzz');
      await press('exam-check');
      expect(screen.queryByText(/Practice this/)).toBeNull(); // no Practice button on the Practice card
      await press('level-test-next');
      await press('level-practice-close');
      expect(screen.queryByTestId('level-practice-header')).toBeNull();
      expect(text('exam-prompt')).toBeTruthy(); // the next test question
      expect(text('level-test-header')).toBe(`B1 · ${pct}% · 2/20`);
      expect(await evidenceNow()).toEqual(before);
      expect(await loadResumeValue(getDb(), roundKey('B1'))).toEqual({ n: 1, right: 0, startPct: Number(pct) });
    });

    it('the rule table highlights the cell the CURRENT task asks, on every task (not only the first)', async () => {
      await typeWrongForm();
      await press('level-test-practice');
      const expected: Record<string, string[]> = { yo: ['me gusta', 'me gustan'], nosotros: ['nos gusta', 'nos gustan'], 'ellos/ellas/ustedes': ['les gusta', 'les gustan'] };
      const seen: string[] = [];
      for (let i = 0; i < 3; i++) {
        const prompt = text('exam-prompt');
        const person = prompt.split(' · ')[1];
        const col = prompt.startsWith('una') ? 0 : 1;
        expect(flat('level-test-table-hl')).toBe(expected[person][col]);
        seen.push(flat('level-test-table-hl'));
        await press('exam-dont-know');
        await press('level-test-next');
      }
      expect(new Set(seen).size).toBe(3);
    });

    it('a wrong task comes back once, the total grows by one; the end says "x of N right" and Back to the test returns', async () => {
      await typeWrongForm();
      await press('level-test-practice');
      for (let i = 0; i < 5; i++) {
        await press('exam-dont-know');
        await press('level-test-next');
      }
      // each of the first 3 misses came back 3 places later (the total is 8 now); the last 2 are still to be missed
      expect(text('level-practice-header')).toBe('Practice · 6/8');
      for (let i = 0; i < 5; i++) {
        await press('exam-dont-know');
        await press('level-test-next');
      }
      expect(text('level-practice-end')).toBe('0 of 10 right');
      await press('level-practice-back');
      expect(screen.queryByTestId('level-practice-end')).toBeNull();
      expect(text('level-test-header')).toMatch(/· 2\/20$/);
    });
  });

  it('an unknown level falls back to the learner level; a level without any topic goes straight back', async () => {
    mockParams = { level: 'Z9' };
    const view = await open();
    expect(text('level-test-header')).toBe('A1 · 0% · 1/20');
    view.unmount();

    mockBack.mockClear();
    mockParams = { level: 'C1' };
    await open();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
