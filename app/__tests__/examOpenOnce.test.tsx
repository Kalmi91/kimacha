// FB647: opening the level exam froze the app. buildExam rebuilt the learned-vocabulary set (knownTokens) for
// EVERY example sentence (432 times for a fully learned A1 deck, seconds on the JS thread). This test opens the real
// screen with the real learner provider and the real builder, with every A1 word learned, and counts calls
// (never wall time: that fails under load): the load effect builds the exam once, the vocabulary set is built once.

const mockParams = { level: 'A1' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

const mockCalls = { build: 0, knownTokens: 0, sentenceKnownIn: 0, sentenceKnown: 0, refresh: 0 };
jest.mock('@/lib/exam/builder', () => {
  const actual = jest.requireActual('@/lib/exam/builder');
  return { ...actual, buildExam: (...a: unknown[]) => (mockCalls.build++, actual.buildExam(...a)) };
});
jest.mock('@/lib/knownSentence', () => {
  const actual = jest.requireActual('@/lib/knownSentence');
  return {
    ...actual,
    knownTokens: (...a: unknown[]) => (mockCalls.knownTokens++, actual.knownTokens(...a)),
    isSentenceKnownIn: (...a: unknown[]) => (mockCalls.sentenceKnownIn++, actual.isSentenceKnownIn(...a)),
    isSentenceKnown: (...a: unknown[]) => (mockCalls.sentenceKnown++, actual.isSentenceKnown(...a)),
  };
});

import { render } from '@testing-library/react-native';

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { seedA1ExamState } from '@/lib/exam/devSeed';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { LearnerProvider, LearnerStore } from '@/lib/learner';
import { makeFlush } from '@/test-utils/flush';
import ExamScreen from '../exam';

jest.setTimeout(60000);
const flush = makeFlush(12);

describe('level exam: the load effect and its cost (FB647)', () => {
  it('builds the exam once per open, reaches the intro, builds the vocabulary set once', async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().setOnboarding('en', 'es');
    setPcicTarget('es', 'en');
    await seedA1ExamState(getDb(), 'es', '2026-10-01');

    const store = new LearnerStore();
    const refresh = jest.spyOn(store.actions, 'refresh');
    const screen = render(
      <LearnerProvider store={store}>
        <ExamScreen />
      </LearnerProvider>,
    );
    expect(screen.queryByTestId('exam-start')).toBeNull();
    await flush();
    await flush();

    expect(screen.getByTestId('exam-start')).toBeTruthy();
    expect(mockCalls.build).toBe(1);
    // the effect asks for the direction and the strict-accents setting once each, and does not run again
    expect(refresh).toHaveBeenCalledTimes(2);
    // call-count budget: one vocabulary set for the whole sentence pool, never one per sentence
    expect(mockCalls.knownTokens).toBe(1);
    expect(mockCalls.sentenceKnown).toBe(0);
    // a sentence is checked at most once per example of the level's items
    expect(mockCalls.sentenceKnownIn).toBeLessThanOrEqual(pcicItemsForLevel('A1').length);
  });
});
