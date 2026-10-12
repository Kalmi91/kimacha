// The Stats tab's level card (components/stats/LevelCard.tsx, lib/progressLevel.ts): the current
// level A1-C1 and the progress toward the next one, in the UI language (EN / ES), with accessibility labels.
// Mock pattern: statsBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import type { ProgressLevel } from '@/lib/progressLevel';
import { ThemeProvider } from '@/lib/ThemeContext';
import LevelCard from '../stats/LevelCard';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const renderCard = async (progress: ProgressLevel) => {
  const view = render(
    <ThemeProvider>
      <LevelCard progress={progress} />
    </ThemeProvider>,
  );
  await flush();
  return view;
};

const A2_TO_B1: ProgressLevel = {
  level: 'A2',
  next: { level: 'B1', wordsKnown: 120, wordsTotal: 300, wordsNeeded: 240, grammarDone: 4, grammarTotal: 15 },
};

describe('LevelCard', () => {
  beforeEach(async () => {
    setLanguage('en');
    await getDb().setGrammarPalette('classic');
  });
  afterEach(() => setLanguage('en'));

  it('shows the current level and the progress toward the next one (words to the 80% goal, grammar topics)', async () => {
    const view = await renderCard(A2_TO_B1);
    expect(view.getByText('Your level')).toBeTruthy();
    expect(view.getByTestId('level-card-badge')).toBeTruthy();
    expect(view.getByText('A2')).toBeTruthy();
    expect(view.getByText('Level A2')).toBeTruthy();
    expect(view.getByText('To clear B1')).toBeTruthy();
    expect(view.getByText('Words learned: 120 / 240 (80% of 300)')).toBeTruthy();
    expect(view.getByText('Grammar topics done: 4 / 15')).toBeTruthy();
    expect(view.getByText("80% of the level's words learned and every grammar topic done.")).toBeTruthy();
    view.unmount();
  });

  it('the bars have the progress value as an accessible progressbar with the same label', async () => {
    const view = await renderCard(A2_TO_B1);
    const words = view.getByTestId('level-card-words');
    expect(words.props.accessibilityRole).toBe('progressbar');
    expect(words.props.accessibilityLabel).toBe('Words learned: 120 / 240 (80% of 300)');
    expect(words.props.accessibilityValue).toEqual({ min: 0, max: 240, now: 120 });
    const grammar = view.getByTestId('level-card-grammar');
    expect(grammar.props.accessibilityRole).toBe('progressbar');
    expect(grammar.props.accessibilityLabel).toBe('Grammar topics done: 4 / 15');
    expect(grammar.props.accessibilityValue).toEqual({ min: 0, max: 15, now: 4 });
    // the fill is the share of the goal: 120 / 240 = 50%, 4 / 15 = 27%
    expect(view.getByTestId('level-card-words-fill').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '50%' })]));
    expect(view.getByTestId('level-card-grammar-fill').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '27%' })]));
    view.unmount();
  });

  it('the fill stops at 100% when more words are learned than the goal needs', async () => {
    const over: ProgressLevel = {
      level: 'A1',
      next: { level: 'A2', wordsKnown: 300, wordsTotal: 300, wordsNeeded: 240, grammarDone: 14, grammarTotal: 15 },
    };
    const view = await renderCard(over);
    expect(view.getByTestId('level-card-words').props.accessibilityValue).toEqual({ min: 0, max: 240, now: 240 });
    expect(view.getByTestId('level-card-words-fill').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '100%' })]));
    view.unmount();
  });

  it('not even A1 cleared: badge 0 and "Heading for A1"', async () => {
    const view = await renderCard({
      level: null,
      next: { level: 'A1', wordsKnown: 0, wordsTotal: 100, wordsNeeded: 80, grammarDone: 0, grammarTotal: 10 },
    });
    expect(view.getByText('0')).toBeTruthy();
    expect(view.getByText('Heading for A1')).toBeTruthy();
    expect(view.getByText('To clear A1')).toBeTruthy();
    expect(view.getByText('Words learned: 0 / 80 (80% of 100)')).toBeTruthy();
    expect(view.queryByText(/Level /)).toBeNull();
    view.unmount();
  });

  it('C1 is the ceiling: no next-level progress, a closing line instead', async () => {
    const view = await renderCard({ level: 'C1', next: null });
    expect(view.getByText('Level C1')).toBeTruthy();
    expect(view.getByTestId('level-card-top')).toBeTruthy();
    expect(view.getByText('You have cleared the top level.')).toBeTruthy();
    expect(view.queryByTestId('level-card-words')).toBeNull();
    expect(view.queryByTestId('level-card-grammar')).toBeNull();
    view.unmount();
  });

  it('Spanish UI: labels and accessibility labels are in Spanish', async () => {
    setLanguage('es');
    const view = await renderCard(A2_TO_B1);
    expect(view.getByText('Tu nivel')).toBeTruthy();
    expect(view.getByText('Nivel A2')).toBeTruthy();
    expect(view.getByText('Para superar B1')).toBeTruthy();
    expect(view.getByText('Palabras aprendidas: 120 / 240 (80% de 300)')).toBeTruthy();
    expect(view.getByTestId('level-card-words').props.accessibilityLabel).toBe('Palabras aprendidas: 120 / 240 (80% de 300)');
    expect(view.getByTestId('level-card-grammar').props.accessibilityLabel).toBe('Temas de gramática hechos: 4 / 15');
    view.unmount();
  });

  it('on the brutalist palette the bars are segmented (SegmentBar) and the sticker carries the level', async () => {
    await getDb().setGrammarPalette('brand');
    const view = await renderCard(A2_TO_B1);
    expect(view.getByTestId('level-card')).toBeTruthy();
    expect(view.getByTestId('level-card-badge')).toBeTruthy();
    expect(view.getByTestId('level-card-words-bar')).toBeTruthy();
    expect(view.getByTestId('level-card-grammar-bar')).toBeTruthy();
    expect(view.queryByTestId('level-card-words-fill')).toBeNull();
    view.unmount();
  });
});
