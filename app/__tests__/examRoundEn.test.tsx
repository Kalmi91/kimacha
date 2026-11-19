// The English A1 exam round: the gap-text file is registered, so the exam strip of the Grammar tab shows the
// "exam round" button for an English learner. The strip and the file are the real ones.

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(async () => []) }));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stop: jest.fn(),
  stopSpeaking: jest.fn(),
  loadVoices: jest.fn().mockResolvedValue(undefined),
  hasVoiceFor: jest.fn(() => true),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ back: jest.fn(), push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: jest.fn(),
}));

import { render } from '@testing-library/react-native';

import ExamStrip from '@/components/grammar/ExamStrip';
import { getDb } from '@/lib/database';
import { examStatusFor } from '@/lib/exam/unlock';
import { examRoundAvailable, examRoundFile } from '@/lib/grammar/examRound';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);
const flush = makeFlush(10);

describe('the English A1 exam round', () => {
  it('has a file of 12 texts with 6 gaps of 3 options each', () => {
    expect(examRoundAvailable('en', 'A1')).toBe(true);
    const file = examRoundFile('en', 'A1');
    expect(file?.lang).toBe('en');
    expect(file?.level).toBe('A1');
    expect(file?.texts).toHaveLength(12);
    for (const t of file?.texts ?? []) {
      expect(t.gaps).toHaveLength(6);
      for (const g of t.gaps) expect(g.options).toHaveLength(3);
    }
  });

  it('shows the exam round button of the strip for learnedLang en', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    const cards = await db.getPcicCards();
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    const examStatus = examStatusFor('A1', 'en', cards, rows);
    const strip = render(
      <ThemeProvider>
        <ExamStrip level="A1" learnedLang="en" contentLang="es" evidence={new Map()} examStatus={examStatus} />
      </ThemeProvider>,
    );
    await flush();
    expect(strip.getByTestId('grammar-exam-round-A1')).toBeTruthy();
    strip.unmount();
  });
});
