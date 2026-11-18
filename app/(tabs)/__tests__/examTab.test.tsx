// The Exam tab (after Grammar, E153): A1 opens first without a Beta sticker, the levels above A1 carry one, and the
// exam strip (percent, lock reason, done mark, buttons) lives here, not on the Grammar tab. The strip tests moved
// here from app/grammar/__tests__/courseRandom.test.tsx. Mock pattern: courseRandom.test.tsx.

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(async () => []) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/exam-tab',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { levelShownKey } from '@/lib/grammar/levelTest';
import { GRAMMAR_RANDOM_KEY, type EvidenceAnswer } from '@/lib/grammar/randomRound';
import { GRAMMAR_PROGRESS_KEY, hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { saveResumeValue } from '@/lib/resumeStore';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';
import ExamTab from '../exam-tab';

const flush = makeFlush(4);

const answers = (ok: number, total: number, kinds: ('choice' | 'form')[] = ['choice']): { answers: EvidenceAnswer[] } => ({
  answers: Array.from({ length: total }, (_, i) => ({ id: `q${i}`, kind: kinds[i % kinds.length], ok: i < ok, at: '2026-11-01' })),
});

const a1Written = () => syllabusForLevel('A1', 'es').filter((tp) => hasLesson('es', tp.id));

describe('Exam tab', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.resetPcicCards();
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
  });

  const open = async () => {
    const view = render(<ThemeProvider><ExamTab /></ThemeProvider>);
    await flush();
    return view;
  };

  it('opens on A1 with the A1 strip and no Beta sticker', async () => {
    const view = await open();
    expect(screen.getByTestId('exam-tab-level-A1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('grammar-exam-strip-A1')).toBeTruthy();
    expect(screen.queryByTestId('beta-sticker-exam-A1')).toBeNull();
    view.unmount();
  });

  it('a level above A1 shows its strip with a Beta sticker', async () => {
    const view = await open();
    const above = (['A2', 'B1', 'B2', 'C1'] as const).filter((l) => screen.queryByTestId(`exam-tab-level-${l}`));
    expect(above.length).toBeGreaterThan(0);
    for (const l of above) {
      fireEvent.press(screen.getByTestId(`exam-tab-level-${l}`));
      await flush();
      expect(screen.getByTestId(`beta-sticker-exam-${l}`)).toBeTruthy();
      expect(screen.getByTestId(`grammar-exam-strip-${l}`)).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('exam-tab-level-A1'));
    await flush();
    expect(screen.queryByTestId('beta-sticker-exam-A1')).toBeNull();
    view.unmount();
  });

  it('the strip loads the level exam status: a fresh install has the exam locked with its reason shown', async () => {
    const view = await open();
    expect(screen.getByTestId('grammar-exam-open-A1').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('grammar-exam-lock-A1')).toHaveTextContent(/Finish one grammar lesson of this level\./);
    view.unmount();
  });

  it('shows the level percent: the average of the topics test percent (one topic at 100% among the written A1 ones)', async () => {
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-regular', 'evidence', answers(4, 4));
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-irregular', 'evidence', answers(2, 2));
    const view = await open();
    const pct = Math.round((100 + 67) / a1Written().length);
    expect(pct).toBeGreaterThan(0);
    expect(screen.getByTestId('grammar-exam-strip-pct-A1')).toHaveTextContent(`${pct}% grammar ready`);
    view.unmount();
  });

  it('shows the stored standing, never less than the real percent (FB616)', async () => {
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-regular', 'evidence', answers(4, 4));
    await saveResumeValue(getDb(), levelShownKey('en→es', 'A1'), 41.3);
    const view = await open();
    expect(screen.getByTestId('grammar-exam-strip-pct-A1')).toHaveTextContent('41% grammar ready');
    view.unmount();
    await saveResumeValue(getDb(), levelShownKey('en→es', 'A1'), null);
  });

  it('a done mark once every topic of the level is ticked off; the level test button still opens the test', async () => {
    for (const tp of a1Written()) {
      await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, tp.id, 'evidence', answers(5, 5, ['choice', 'form']));
    }
    const view = await open();
    expect(screen.getByTestId('grammar-exam-strip-title-A1')).toHaveTextContent('✓ A1 exam');
    expect(screen.getByTestId('grammar-exam-strip-pct-A1')).toHaveTextContent('100% grammar ready');
    fireEvent.press(screen.getByTestId('grammar-level-test-A1'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/level-test?level=A1');
    view.unmount();
  });
});
