// NY22: a neo-brutalista drill (2. képernyő): szegmentált progress, combo-matrica
// (csak memóriában, hibánál nullázódik, x2-től látszik), 2x2 válasz-rács, a
// helyes = a kitöltés + pipa, b kitöltésű visszajelző, "next →" gomb.
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import lessonJson from '@/data/games/grammar/es/presente-irregular.json';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { getDb } from '@/lib/database';
import { hashString } from '@/lib/shuffle';
import { ThemeProvider } from '@/lib/ThemeContext';

const lesson = lessonJson as unknown as LessonV2;

const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('GrammarDrill, neo-brutalista (NY22)', () => {
  const now = 1700000000000;
  beforeEach(async () => {
    await getDb().setGrammarPalette('brand');
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const roundItems = () =>
    buildGrammarRound(lesson, hashString(`${lesson.topic}:${now}`)).filter(isChoiceRoundItem);
  const pick = (idx: number) => fireEvent.press(screen.getAllByTestId('grammar-option')[idx]);

  it('a combo x2-től látszik, hibánál nullázódik; a helyes válasz a kitöltést és a pipát kapja', async () => {
    const items = roundItems();
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} />
      </ThemeProvider>
    );
    await flush();

    expect(screen.queryByTestId('grammar-drill-segments')).toBeTruthy();
    expect(screen.queryByTestId('grammar-combo')).toBeNull();

    pick(items[0].correctIndex);
    // helyes = a kitöltés + pipa, visszajelző + next gomb
    const options = screen.getAllByTestId('grammar-option');
    expect(StyleSheet.flatten(options[items[0].correctIndex].props.style).backgroundColor).toBe(PALETTE_FILLS.brand.a);
    expect(screen.queryByText('perfect!')).toBeTruthy();
    expect(screen.queryByText(' ✓')).toBeTruthy();
    expect(screen.queryByTestId('grammar-combo')).toBeNull();
    fireEvent.press(screen.getByTestId('grammar-next'));

    pick(items[1].correctIndex);
    expect(screen.queryByText('combo x2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));

    const wrong = (items[2].correctIndex + 1) % items[2].options.length;
    pick(wrong);
    expect(screen.queryByTestId('grammar-combo')).toBeNull();
    expect(screen.queryByText('Not quite!')).toBeTruthy();
    view.unmount();
  });

  it('classic palettával a mai drill jelenik meg (nincs szegmentált sáv)', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} />
      </ThemeProvider>
    );
    await flush();
    await flush();
    expect(screen.queryByTestId('grammar-drill-segments')).toBeNull();
    expect(screen.queryByTestId('grammar-drill-progress')).toBeTruthy();
    view.unmount();
  });
});
