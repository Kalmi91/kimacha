// A failing save of the level exam's result does not trap the learner: after the last answer an error with a
// retry button shows, and the retry saves the result and shows it. Pattern: examFeedback.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ level: 'A1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
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

const mockExam = [
  { kind: 'word_type', skill: 'words', itemId: 'o1', prompt: 'the window', answer: 'la ventana' },
  { kind: 'gap_mc', skill: 'grammar', topicId: 'presente-regular', sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 },
];
jest.mock('@/lib/exam/builder', () => ({ buildExam: () => mockExam }));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { EXAM_PROGRESS_KEY } from '@/lib/exam/result';
import { seedA1ExamState } from '@/lib/exam/devSeed';
import ExamScreen from '../exam';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Level exam: a failing save of the result', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
  });
  afterEach(() => jest.restoreAllMocks());

  it('saveExamResult rejects on the last answer: an error and a retry button; the retry shows the result', async () => {
    await getDb().setOnboarding('en', 'es');
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    const save = jest.spyOn(getDb(), 'saveExamResult').mockRejectedValueOnce(new Error('disk full'));
    const s = render(<ExamScreen />);
    await flush();
    const press = async (id: string) => {
      fireEvent.press(s.getByTestId(id));
      await flush();
    };

    await press('exam-start');
    fireEvent.changeText(s.getByTestId('exam-input'), 'la ventana');
    await press('exam-check');
    await press('exam-option-0');

    expect(save).toHaveBeenCalledTimes(1);
    expect(s.getByTestId('exam-finish-error')).toBeTruthy();
    expect(s.queryByTestId('exam-verdict')).toBeNull();

    await press('exam-finish-retry');

    expect(save).toHaveBeenCalledTimes(2);
    expect(s.queryByTestId('exam-finish-error')).toBeNull();
    expect(s.getByTestId('exam-verdict')).toBeTruthy();
    s.unmount();
  });
});
