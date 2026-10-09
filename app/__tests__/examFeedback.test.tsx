// The feedback button is on every part of the old level exam, and the
// card id says which part it is (exam:<level>:<part>); on a typing question the 💬
// sits above the docked Check bar (bottomOffset). Pattern: mockExamFeedback.test.tsx + exam.test.tsx.

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

describe('Level exam: feedback button on every part', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
  });

  it('locked: it is on the lock sheet too, with its own identifier', async () => {
    const s = render(<ExamScreen />);
    await flush();
    expect(s.getByTestId('fb-card').props.children).toBe('exam:A1:locked | en→es | A1 | -');
    s.unmount();
  });

  it('intro, questions (above the docked bar for typed ones), exit, result: all with their own identifier', async () => {
    await getDb().setOnboarding('en', 'es');
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    const s = render(<ExamScreen />);
    await flush();
    const card = () => s.getByTestId('fb-card').props.children as string;
    const press = async (id: string) => {
      fireEvent.press(s.getByTestId(id));
      await flush();
    };

    expect(card()).toBe('exam:A1:intro | en→es | A1 | -');
    await press('exam-start');
    // Typing question: there is a docked Check bar, the 💬 sits higher by the bar's height (it does not cover it).
    expect(card()).toMatch(/^exam:A1:q1:word_type \| en→es \| A1 \| [1-9]\d*$/);
    await press('exam-close');
    expect(card()).toBe('exam:A1:leave | en→es | A1 | -');
    await press('exam-keep-going');
    expect(card()).toMatch(/^exam:A1:q1:word_type /);
    fireEvent.changeText(s.getByTestId('exam-input'), 'la ventana');
    await press('exam-check');
    // Multiple-choice question: no docked bar, base position.
    expect(card()).toBe('exam:A1:q2:gap_mc | en→es | A1 | -');
    await press('exam-option-0');
    expect(card()).toBe('exam:A1:result | en→es | A1 | -');
    s.unmount();
  });
});
