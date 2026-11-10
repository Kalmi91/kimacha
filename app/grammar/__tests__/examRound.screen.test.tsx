// The exam round screen (app/grammar/exam-round.tsx), played the way a learner plays it: two gap texts, no feedback until
// "Check", the result page with the right words, topics and "Repeat these" rows, every answer saved as the topic's `cloze`
// evidence exactly once, and a run that survives leaving. The syllabus is mocked (four A1 topics), the texts are in-test
// fixtures (the real file is checked by the data gate), the engine is the real one.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
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
jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string; languagePair: string; level: string }) => (
      <Text testID="fb-card">{`${p.currentCard} | ${p.languagePair} | ${p.level}`}</Text>
    ),
  };
});

jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const topics = [
    { id: 'lt-0', title: 'Alpha topic' },
    { id: 'lt-1', title: 'Beta topic' },
    { id: 'lt-2', title: 'Gamma topic' },
    { id: 'lt-3', title: 'Delta topic' },
  ].map((d) => ({ id: d.id, level: 'A1', unit: 'u', title: { en: d.title }, blurb: { en: '' } }));
  return {
    ...actual,
    syllabusForLevel: (level: string) => topics.filter((tp) => tp.level === level),
    syllabusTopic: (id: string) => topics.find((tp) => tp.id === id),
    hasLesson: (_lang: string, id: string) => topics.some((tp) => tp.id === id),
  };
});

// the gap texts: the file is a variable of the test
let mockFile: any;
jest.mock('@/lib/grammar/examRound', () => ({
  ...jest.requireActual('@/lib/grammar/examRound'),
  examRoundFile: () => mockFile,
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { examRunKey, type ExamRoundText } from '@/lib/grammar/examRound';
import { GRAMMAR_RANDOM_KEY, evidenceFromRows, type EvidenceAnswer } from '@/lib/grammar/randomRound';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { ThemeProvider } from '@/lib/ThemeContext';
import ExamRoundScreen from '../exam-round';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const flush = makeFlush(4);
const KEY = examRunKey('en→es', 'A1');

const mk = (id: string, title: string, topics: string[], correct: number[]): ExamRoundText => ({
  id,
  title,
  text: topics.map((_, i) => `palabra {{${i + 1}}}`).join(' '),
  gaps: topics.map((topic, i) => ({ options: ['a', 'b', 'c'].map((c) => `${c}${i + 1}word`), correct: correct[i], topic })),
});
// EX-1: right options 0 1 2 0 1 2, topics lt-0 lt-0 lt-1 lt-2 lt-3 lt-1
const EX1 = () => mk('EX-1', 'Texto uno', ['lt-0', 'lt-0', 'lt-1', 'lt-2', 'lt-3', 'lt-1'], [0, 1, 2, 0, 1, 2]);
const EX2 = () => mk('EX-2', 'Texto dos', ['lt-2', 'lt-3', 'lt-2', 'lt-3', 'lt-1', 'lt-0'], [2, 2, 2, 1, 1, 1]);

const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const text = (testID: string) => {
  const walk = (n: any): string => (typeof n === 'string' ? n : (n.children ?? []).map(walk).join(''));
  return walk(screen.getByTestId(testID));
};
const pick = async (gap: number, option: number) => press(`mock-option-c${gap}-${option}`);
/** The picks (option index per gap) on the screen. */
const fill = async (picks: number[]) => {
  for (let i = 0; i < picks.length; i++) await pick(i, picks[i]);
};
const evidenceNow = async () => evidenceFromRows(await getDb().getGameProgress(GRAMMAR_RANDOM_KEY));
const savedRun = async () => loadResumeValue(getDb(), KEY) as Promise<any>;

// lt-0 is the weakest topic: 5 old wrong answers, so EX-1 (two gaps of it) scores higher and comes first
const seedWeak = () =>
  getDb().setGameProgress(GRAMMAR_RANDOM_KEY, 'lt-0', 'evidence', {
    answers: Array.from({ length: 5 }, (_, i): EvidenceAnswer => ({ id: `old${i}`, kind: 'choice', ok: false, at: '2026-11-01' })),
  });

describe.each(['brand', 'classic'] as const)('exam round screen (%s palette)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = { level: 'A1' };
    mockFile = { lang: 'es', level: 'A1', texts: [EX1(), EX2()] };
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    await saveResumeValue(db, KEY, null);
    await seedWeak();
  });

  const open = async () => {
    const view = render(
      <ThemeProvider>
        <ExamRoundScreen />
      </ThemeProvider>,
    );
    await flush();
    return view;
  };

  it('opens on the text with the most gaps of the weakest topic; header, instruction, feedback button', async () => {
    await open();
    expect(text('exam-round-header')).toBe('A1 exam round · text 1 of 2');
    expect(screen.getByText('Texto uno')).toBeTruthy();
    expect(screen.getByText('Read the text and choose the right word for each gap.')).toBeTruthy();
    expect(screen.getByTestId('fb-card')).toHaveTextContent('grammar-exam-round:A1:EX-1:text | en→es | A1');
    expect(screen.queryByTestId('exam-round-score')).toBeNull();
    // the open run is saved at once
    expect(await savedRun()).toMatchObject({ texts: ['EX-1', 'EX-2'], index: 0, checked: false, answers: {} });
  });

  it('"Check" waits for all 6 gaps; nothing is written before it', async () => {
    await open();
    await press('exam-round-check');
    expect(screen.queryByTestId('exam-round-score')).toBeNull();
    await fill([0, 1, 2, 0, 1]); // 5 of 6
    await press('exam-round-check');
    expect(screen.queryByTestId('exam-round-score')).toBeNull();
    expect((await evidenceNow()).get('lt-1')).toBeUndefined();
    await pick(5, 2);
    await press('exam-round-check');
    expect(screen.getByTestId('exam-round-score')).toHaveTextContent('6 / 6');
  });

  it('the result: score, one row per gap with the right word, the topic, repeat rows; the evidence is saved per topic as cloze, in gap order', async () => {
    await open();
    await fill([0, 0, 2, 1, 1, 2]); // gap 2 and gap 4 wrong
    await press('exam-round-check');
    expect(screen.getByTestId('exam-round-score')).toHaveTextContent('4 / 6');
    expect(text('exam-round-gap-1')).toBe('✓ a1wordAlpha topic');
    expect(text('exam-round-gap-2')).toBe('✗ a2word → b2wordAlpha topic');
    expect(text('exam-round-gap-4')).toBe('✗ b4word → a4wordGamma topic');
    expect(screen.getByTestId('fb-card')).toHaveTextContent('grammar-exam-round:A1:EX-1:result | en→es | A1');
    expect(screen.getByText("Every answer counts into its topic's percent.")).toBeTruthy();

    const ev = await evidenceNow();
    const at = expect.any(String);
    expect(ev.get('lt-0')!.answers.slice(-2)).toEqual([
      { id: 'EX-1#1', kind: 'cloze', ok: true, at },
      { id: 'EX-1#2', kind: 'cloze', ok: false, at },
    ]);
    expect(ev.get('lt-0')!.answers).toHaveLength(7); // 5 old + 2 new
    expect(ev.get('lt-1')!.answers).toEqual([
      { id: 'EX-1#3', kind: 'cloze', ok: true, at },
      { id: 'EX-1#6', kind: 'cloze', ok: true, at },
    ]); // two gaps of one topic: two answers, in gap order
    expect(ev.get('lt-2')!.answers).toEqual([{ id: 'EX-1#4', kind: 'cloze', ok: false, at }]);
    expect(ev.get('lt-3')!.answers).toEqual([{ id: 'EX-1#5', kind: 'cloze', ok: true, at }]);
    expect((await savedRun()).checked).toBe(true);

    // repeat rows: one per topic with a wrong gap, in gap order; a tap opens the lesson
    expect(screen.getByText('Repeat these')).toBeTruthy();
    expect(screen.getByTestId('exam-round-repeat-lt-0')).toBeTruthy();
    expect(screen.getByTestId('exam-round-repeat-lt-2')).toBeTruthy();
    expect(screen.queryByTestId('exam-round-repeat-lt-1')).toBeNull();
    await press('exam-round-repeat-lt-2');
    expect(mockPush).toHaveBeenCalledWith('/grammar/lt-2');
  });

  it('no wrong gap: no "Repeat these" block', async () => {
    await open();
    await fill([0, 1, 2, 0, 1, 2]);
    await press('exam-round-check');
    expect(screen.getByTestId('exam-round-score')).toHaveTextContent('6 / 6');
    expect(screen.queryByText('Repeat these')).toBeNull();
  });

  it('"Next text" opens text 2 (empty picks); after it "Done" leaves, clears the run and keeps the seen texts', async () => {
    await open();
    await fill([0, 1, 2, 0, 1, 2]);
    await press('exam-round-check');
    expect(screen.queryByTestId('exam-round-done')).toBeNull();
    await press('exam-round-next');
    expect(text('exam-round-header')).toBe('A1 exam round · text 2 of 2');
    expect(screen.getByText('Texto dos')).toBeTruthy();
    expect(screen.queryByTestId('exam-round-score')).toBeNull();
    expect(await savedRun()).toMatchObject({ index: 1, checked: false, answers: {} });
    await fill([2, 2, 2, 1, 1, 0]); // the last one is wrong
    await press('exam-round-check');
    expect(screen.getByTestId('exam-round-score')).toHaveTextContent('5 / 6');
    expect(screen.queryByTestId('exam-round-next')).toBeNull();
    await press('exam-round-done');
    expect(mockBack).toHaveBeenCalledTimes(1);
    // both texts are finished and they are every text of the file, so the list restarts with these two
    const run = await savedRun();
    expect(run.texts).toEqual([]);
    expect([...run.seen].sort()).toEqual(['EX-1', 'EX-2']);
    expect((await evidenceNow()).get('lt-1')!.answers).toHaveLength(3); // 2 of text 1, 1 of text 2
  });

  it('the next round after "Done" starts with texts not seen yet', async () => {
    mockFile.texts.push(mk('EX-3', 'Texto tres', ['lt-1', 'lt-1', 'lt-2', 'lt-2', 'lt-3', 'lt-3'], [0, 1, 2, 0, 1, 2]));
    await saveResumeValue(getDb(), KEY, { texts: [], index: 0, answers: {}, checked: false, seed: 1, seen: ['EX-1', 'EX-2'] });
    await open();
    expect(screen.getByText('Texto tres')).toBeTruthy(); // the only unseen text comes first
    expect((await savedRun()).texts[0]).toBe('EX-3');
  });

  it('leaving and coming back shows the same text with the same picks', async () => {
    const first = await open();
    await fill([0, 1, 2]);
    first.unmount();
    mockFile = { lang: 'es', level: 'A1', texts: [EX2(), EX1()] }; // another file order must not change the saved texts
    await open();
    expect(text('exam-round-header')).toBe('A1 exam round · text 1 of 2');
    expect(screen.getByText('Texto uno')).toBeTruthy();
    expect(screen.getByTestId('mock-option-c0-0').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('mock-option-c2-2').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('mock-option-c3-0').props.accessibilityState).toMatchObject({ selected: false });
    await pick(3, 0);
    await pick(4, 1);
    await pick(5, 2);
    await press('exam-round-check'); // the saved picks count
    expect(screen.getByTestId('exam-round-score')).toHaveTextContent('6 / 6');
  });

  it('a result page restored from the store shows the same result and writes no second evidence', async () => {
    const first = await open();
    await fill([0, 0, 2, 1, 1, 2]);
    await press('exam-round-check');
    const before = await evidenceNow();
    first.unmount();
    await open();
    expect(screen.getByTestId('exam-round-score')).toHaveTextContent('4 / 6');
    expect(text('exam-round-gap-2')).toBe('✗ a2word → b2wordAlpha topic');
    await act(async () => {
      await flush();
    });
    const after = await evidenceNow();
    expect(after.get('lt-1')!.answers).toHaveLength(2);
    expect(after.get('lt-0')!.answers).toHaveLength(7);
    expect([...after.entries()]).toEqual([...before.entries()]);
    // and "Next text" still works from the restored page
    await press('exam-round-next');
    expect(text('exam-round-header')).toBe('A1 exam round · text 2 of 2');
  });

  it('a saved text that is no longer in the file starts a new round (the finished texts stay seen)', async () => {
    await saveResumeValue(getDb(), KEY, { texts: ['GONE', 'EX-2'], index: 0, answers: { 0: 1 }, checked: true, seed: 3, seen: ['EX-2', 'OLD'] });
    await open();
    expect(screen.queryByTestId('exam-round-score')).toBeNull();
    const run = await savedRun();
    expect(run).toMatchObject({ index: 0, checked: false, answers: {} });
    expect([...run.texts].sort()).toEqual(['EX-1', 'EX-2']);
    expect(run.seen).toEqual(['EX-2']);
  });

  it('a level without texts shows one line and the cross', async () => {
    mockFile = { lang: 'es', level: 'A1', texts: [] };
    await open();
    expect(screen.getByTestId('exam-round-empty')).toHaveTextContent('There are no gap texts for this level yet.');
    expect(screen.queryByTestId('exam-round-check')).toBeNull();
    await press('exam-round-close');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('a level with no file at all is the same empty state', async () => {
    mockFile = undefined;
    await open();
    expect(screen.getByTestId('exam-round-empty')).toBeTruthy();
  });

  it('the cross leaves at once', async () => {
    await open();
    await press('exam-round-close');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
