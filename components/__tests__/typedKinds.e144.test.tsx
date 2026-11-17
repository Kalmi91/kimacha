import type { ReactElement } from 'react';
// E144 points 2, 3 and 5 on the four typed task kinds, in both skins: the accent hint goes away after the check, the
// next button carries the same label as the other practice screens, the open cloze runs as one flowing line.

import { render, screen, fireEvent } from '@testing-library/react-native';

import { BankDrillItem, ClozeDrillItem, FixDrillItem, NounDrillItem } from '../grammar/TypedKinds';
import { t } from '@/lib/i18n';
import type { BankItem, ClozeItem, FixItem, NounItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

const L = (en: string) => ({ en, es: en });
const CLOZE: ClozeItem = { kind: 'opencloze', id: 'c1', text: 'Me llamo Ana. ___ de México y ___ 25 años.', answers: ['soy', 'tengo'], tr: L('x'), why: L('y') };
const FIX: FixItem = { kind: 'fix', id: 'f1', es: 'Mi hermano es en Madrid.', wrongIndex: 2, answer: 'está', explain: L('e'), tr: L('t') };
const BANK: BankItem = { kind: 'bank', id: 'b1', bank: ['alto', 'rojo'], es: 'Las chicas son ___ .', word: 'alto', answer: 'altas', tr: L('t'), why: L('w') };
const NOUN: NounItem = { kind: 'noun', id: 'n1', base: 'la ciudad', ask: L('plural'), answer: 'las ciudades', why: L('w') };

const onDone = jest.fn();

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
])('typed kinds E144, %s skin', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('the accent hint is shown before the check and gone after it (noun, fix, bank, cloze)', () => {
    const cases: [() => ReactElement, string, string, string[]][] = [
      [() => <NounDrillItem item={NOUN} learnedLang="es" contentLang="en" strictAccents={false} onDone={onDone} />, 'noun-accent-hint', 'noun-check', ['las ciudades']],
      [() => <FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents={false} onDone={onDone} />, 'fix-accent-hint', 'fix-check', ['está']],
      [() => <BankDrillItem item={BANK} learnedLang="es" contentLang="en" strictAccents={false} onDone={onDone} />, 'bank-accent-hint', 'bank-check', ['altas']],
      [() => <ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents={false} onDone={onDone} />, 'cloze-accent-hint', 'cloze-check', ['soy', 'tengo']],
    ];
    for (const [el, hint, check, typed] of cases) {
      const { unmount } = render(el());
      if (check === 'fix-check') fireEvent.press(screen.getByTestId('fix-word-2'));
      expect(screen.getByTestId(hint)).toBeTruthy();
      const prefix = check.replace('-check', '');
      typed.forEach((v, i) => fireEvent.changeText(screen.getByTestId(prefix === 'cloze' ? `cloze-input-${i}` : `${prefix}-input`), v));
      fireEvent.press(screen.getByTestId(check));
      expect(screen.queryByTestId(hint)).toBeNull();
      unmount();
    }
  });

  it('the next button of the new kinds uses the label of the other practice screens', () => {
    render(<NounDrillItem item={NOUN} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('noun-input'), 'las ciudades');
    fireEvent.press(screen.getByTestId('noun-check'));
    expect(screen.getByTestId('grammar-next')).toHaveTextContent(t().grammar.nextArrow);
  });

  it('open cloze: words and gap fields are direct children of one flowing row, no per-gap wrapper', () => {
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    const row: any = screen.getByTestId('cloze-row');
    const kids = row.children as any[];
    const texts = (n: any): number => (typeof n === 'string' ? 0 : n.type === 'Text' ? 1 : (n.children ?? []).reduce((a: number, c: any) => a + texts(c), 0));
    // every direct child is one word or one gap field, never a group of words
    for (const k of kids) expect(texts(k)).toBeLessThanOrEqual(1);
    expect(screen.getAllByTestId(/^cloze-input-\d+$/)).toHaveLength(2);
  });
});
