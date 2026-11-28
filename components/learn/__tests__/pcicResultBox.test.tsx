// Q5 (2026-11-27): the result of a typed word-card answer is the AnswerFeedbackBox (badge + the right answer / diff),
// solid success border when right, dashed danger border when wrong; the grade buttons stay outside it and still grade.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import PcicRevealedAnswer from '../PcicRevealedAnswer';
import Colors from '@/constants/Colors';
import type { PcicItem } from '@/data/pcic';
import { t } from '@/lib/i18n';
import { grammarColorsFor } from '@/lib/grammarColors';
import type { Sm2Card } from '@/lib/sm2';
import type { ThemeKey } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  ...jest.requireActual('@/lib/ThemeContext'),
  useTheme: () => ({ theme: mockTheme }),
}));

jest.setTimeout(30000);

const item = {
  id: 'x-1',
  es: 'el carro / el coche',
  en: 'the car',
  exampleEs: 'Mi padre compró un carro nuevo.',
  exampleEn: 'My father bought a new car.',
  kind: 'word',
  section: 's',
  order: 1,
} as PcicItem;
const card: Sm2Card = {
  itemId: 'x-1', state: 'learning', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0,
  due: '', lastReview: null, introducedAt: null,
};

const renderCard = (nextGrade: 'again' | 'good', onGrade = jest.fn()) =>
  render(
    <PcicRevealedAnswer
      colors={Colors.light}
      s={t()}
      typedAnswer="el carr"
      grade={{ match: nextGrade === 'good' ? 'exact' : 'wrong', best: 'el carro', accentOnly: false } as never}
      nextGrade={nextGrade}
      current={card}
      currentItem={item}
      today="2026-10-01"
      target="es"
      onGrade={onGrade}
    />,
  );

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
] as const)('word card result box, %s', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it.each([true, false])('right=%s: the box holds the badge and the answer, the border carries the result', async (right) => {
    renderCard(right ? 'good' : 'again');
    await makeFlush(6)();
    const box = screen.getByTestId('pcic-result-box');
    expect(within(box).getByTestId('pcic-result-badge')).toBeTruthy();
    expect(within(box).getByTestId('pcic-correct-answer')).toBeTruthy();
    expect(within(box).getByText(right ? t().card.correct : t().card.wrong)).toBeTruthy();
    const colors = Colors[theme as keyof typeof Colors];
    const g = grammarColorsFor(theme as ThemeKey);
    const style = StyleSheet.flatten(box.props.style);
    expect(style.borderStyle).toBe(right ? 'solid' : 'dashed');
    expect(style.borderColor).toBe(right ? (g.extra?.success ?? colors.success) : (g.extra?.danger ?? colors.danger));
    // the grade buttons are not inside the result box
    expect(within(box).queryByTestId('pcic-grades')).toBeNull();
  });
});

describe('word card continuity', () => {
  beforeEach(() => {
    mockTheme = 'light';
  });

  it('both grade buttons stay and hand their grade to the caller', async () => {
    const onGrade = jest.fn();
    renderCard('again', onGrade);
    await makeFlush(6)();
    fireEvent.press(screen.getByTestId('pcic-grade-good'));
    expect(onGrade).toHaveBeenLastCalledWith('good');
    fireEvent.press(screen.getByTestId('pcic-grade-again'));
    expect(onGrade).toHaveBeenLastCalledWith('again');
  });

  it('the example, its gloss and the diff line stay on the card', async () => {
    renderCard('again');
    await makeFlush(6)();
    for (const id of ['pcic-diff-line', 'pcic-example', 'pcic-example-gloss', 'pcic-correct-speak']) {
      expect(screen.queryByTestId(id)).not.toBeNull();
    }
  });
});
