// The level exam writes its grammar answers as test evidence of their topics (lib/grammar/examEvidence.ts), once, also when
// the save is retried, and the result page tells the learner where the missed topics went. Pattern: examFinishError.test.tsx.

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ level: 'A1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/components/FeedbackModal', () => ({ __esModule: true, default: () => null }));

const mockExam = [
  { kind: 'word_type', skill: 'words', itemId: 'o1', prompt: 'the window', answer: 'la ventana' },
  { kind: 'gap_mc', skill: 'grammar', itemId: 'g1', topicId: 'presente-regular', sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 },
];
jest.mock('@/lib/exam/builder', () => ({ buildExam: () => mockExam }));

import { fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { GRAMMAR_RANDOM_KEY, evidenceFromRows } from '@/lib/grammar/randomRound';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { EXAM_PROGRESS_KEY } from '@/lib/exam/result';
import { seedA1ExamState } from '@/lib/exam/devSeed';
import ExamScreen from '../exam';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

describe('Level exam: grammar answers as evidence', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().resetGameProgress(GRAMMAR_RANDOM_KEY);
    await getDb().setPcicLevel('A1');
    await getDb().setOnboarding('en', 'es');
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
  });
  afterEach(() => jest.restoreAllMocks());

  const run = async (grammarOption: string) => {
    const s = render(<ExamScreen />);
    await flush();
    const press = async (id: string) => {
      fireEvent.press(s.getByTestId(id));
      await flush();
    };
    await press('exam-start');
    fireEvent.changeText(s.getByTestId('exam-input'), 'la ventana');
    await press('exam-check');
    await press(grammarOption);
    // a wrong answer shows the solution first; Next goes on
    if (grammarOption !== 'exam-option-0') await press('exam-next');
    return { s, press };
  };

  const stored = async () => evidenceFromRows(await getDb().getGameProgress(GRAMMAR_RANDOM_KEY)).get('presente-regular');

  it('a wrong grammar answer is written once as a wrong exam answer, a retried save does not double it, the note shows', async () => {
    // the first evidence write lands and then reports an error: the retry runs the whole finish again
    const real = getDb().setGameProgress.bind(getDb());
    let failed = false;
    jest.spyOn(getDb(), 'setGameProgress').mockImplementation(async (...args: Parameters<typeof real>) => {
      await real(...args);
      if (args[0] === GRAMMAR_RANDOM_KEY && !failed) {
        failed = true;
        throw new Error('disk full');
      }
    });
    const { s, press } = await run('exam-option-1');
    expect(s.getByTestId('exam-finish-error')).toBeTruthy();
    expect((await stored())?.answers).toHaveLength(1);

    await press('exam-finish-retry');
    const ev = await stored();
    expect(ev?.answers).toHaveLength(1);
    expect(ev?.answers[0]).toMatchObject({ kind: 'choice', ok: false });
    expect(ev?.answers[0].id).toMatch(/^exam:L\d+:g1$/);
    expect(s.getByTestId('exam-missed-note')).toHaveTextContent(/under Weakest now/);
    s.unmount();
  });

  it('a right grammar answer is written as a right answer and there is no note', async () => {
    const { s } = await run('exam-option-0');
    const ev = await stored();
    expect(ev?.answers).toHaveLength(1);
    expect(ev?.answers[0].ok).toBe(true);
    expect(s.queryByTestId('exam-missed-note')).toBeNull();
    s.unmount();
  });
});
