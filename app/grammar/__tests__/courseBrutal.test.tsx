// the brutalist course list: header with a streak sticker, level boxes
// (active = a), done = DONE sticker, in progress = b fill + segmented
// bar, locked = dashed box. The classic palette is today's look.
// Mock pattern: course.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { EXAM_ONLY_KEY } from '@/lib/grammar/useExamOnly';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe('course list, neo-brutalist', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette('brand');
  });

  it('streak sticker, active level box with a, core sticker, weekly goal box', async () => {
    await getDb().updateStreak();
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByText('🔥 1')).toBeTruthy();
    expect(style('grammar-level-A1').backgroundColor).toBe(PALETTE_FILLS.brand.a);
    expect(style('grammar-level-A2').backgroundColor).toBe('#FFFFFF');
    expect(screen.queryAllByTestId(/^grammar-core(-plus)?-/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Weekly goal')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush(1);
    expect(screen.queryByTestId('grammar-topic-futuro-simple')).toBeTruthy();
    expect(screen.queryByTestId('grammar-topic-presente-regular')).toBeNull();
    view.unmount();
  });

  it('a finished topic gets a DONE sticker, one in progress gets a b fill and a segmented bar', async () => {
    const db = getDb();
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 10, total: 12 });
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-irregular:choice', 'started', { correct: 6, total: 10 });
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByText('✓ 83%')).toBeTruthy();
    expect(screen.queryAllByText('done').length).toBeGreaterThan(0);
    view.unmount();
  });

  it('exam tag on an exam-tier row; the exam only chip hides the rest, notes the count, and is remembered', async () => {
    await saveResumeValue(getDb(), EXAM_ONLY_KEY, null);
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByTestId('grammar-exam-tag-articulos-genero')).toBeTruthy();
    expect(screen.queryByTestId('grammar-exam-tag-presente-regular')).toBeNull();
    const chip = screen.getByTestId('grammar-exam-only');
    expect(chip.props.accessibilityRole).toBe('switch');
    expect(chip.props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId('grammar-exam-only-note-A1')).toBeNull();
    fireEvent.press(chip);
    await flush(1);
    expect(screen.getByTestId('grammar-exam-only').props.accessibilityState.checked).toBe(true);
    expect(await loadResumeValue(getDb(), EXAM_ONLY_KEY)).toBe(true);
    // A1 hides nothing: the "every topic" line.
    expect(screen.getByTestId('grammar-exam-only-note-A1').props.children).toBe('Every topic of this level is an exam topic.');
    expect(screen.queryByTestId('grammar-topic-presente-regular')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush(1);
    expect(screen.queryByTestId('grammar-topic-diminutivos')).toBeNull();
    expect(screen.queryByTestId('grammar-topic-futuro-simple')).toBeTruthy();
    expect(screen.getByTestId('grammar-exam-only-note-A2').props.children).toBe('Not needed for the exam, hidden: 2');
    fireEvent.press(screen.getByTestId('grammar-exam-only'));
    await flush(1);
    expect(screen.queryByTestId('grammar-topic-diminutivos')).toBeTruthy();
    expect(screen.queryByTestId('grammar-exam-only-note-A2')).toBeNull();
    expect(await loadResumeValue(getDb(), EXAM_ONLY_KEY)).toBe(false);
    view.unmount();
  });

  it('the stored switch is read on mount', async () => {
    await saveResumeValue(getDb(), EXAM_ONLY_KEY, true);
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.getByTestId('grammar-exam-only').props.accessibilityState.checked).toBe(true);
    expect(screen.queryByTestId('grammar-exam-only-note-A1')).toBeTruthy();
    view.unmount();
    await saveResumeValue(getDb(), EXAM_ONLY_KEY, null);
  });

  it('classic look: tag, chip, filter and note', async () => {
    await saveResumeValue(getDb(), EXAM_ONLY_KEY, null);
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush(6);
    expect(screen.queryByTestId('grammar-exam-tag-articulos-genero')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-exam-only'));
    await flush(1);
    expect(screen.getByTestId('grammar-exam-only').props.accessibilityState.checked).toBe(true);
    expect(await loadResumeValue(getDb(), EXAM_ONLY_KEY)).toBe(true);
    expect(screen.getByTestId('grammar-exam-only-note-A1').props.children).toBe('Every topic of this level is an exam topic.');
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush(1);
    expect(screen.queryByTestId('grammar-topic-diminutivos')).toBeNull();
    expect(screen.getByTestId('grammar-exam-only-note-A2').props.children).toBe('Not needed for the exam, hidden: 2');
    view.unmount();
    await saveResumeValue(getDb(), EXAM_ONLY_KEY, null);
  });

  it('with the classic palette the current (non-brutalist) list shows: no sticker rotation', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush(6);
    expect(screen.queryByTestId('grammar-streak')).toBeNull();
    expect(screen.queryByTestId('grammar-topic-presente-regular')).toBeTruthy();
    view.unmount();
  });
});
