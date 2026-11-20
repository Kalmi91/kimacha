// The four typed task kinds as the learner plays them (open cloze, error correction, word bank, article + plural),
// in both skins: the brutal one and the classic one. Every screen element has a testID; the result is right only if
// every typed part is right; the accent setting decides on the accents.

import { StyleSheet, TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { BankDrillItem, ClozeDrillItem, FixDrillItem, NounDrillItem } from '../grammar/TypedKinds';
import type { BankItem, ClozeItem, FixItem, NounItem } from '@/lib/grammar/lessonTypes';
import { speak } from '@/lib/speech';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

const L = (en: string) => ({ en, es: en });
const CLOZE: ClozeItem = {
  kind: 'opencloze',
  id: 'c1',
  text: 'Me llamo Ana. ___ de México y ___ 25 años. Mi casa ___ cerca del centro.',
  answers: ['soy', 'tengo', 'está'],
  tr: L('My name is Ana.'),
  why: L('ser for origin, tener for age, estar for place'),
};
const FIX: FixItem = { kind: 'fix', id: 'f1', es: 'Mi hermano es en Madrid.', wrongIndex: 2, answer: 'está', explain: L('place: estar'), tr: L('My brother is in Madrid.') };
const BANK: BankItem = {
  kind: 'bank',
  id: 'b1',
  bank: ['alto', 'rojo', 'simpático'],
  es: 'Las chicas son ___ .',
  word: 'alto',
  answer: 'altas',
  tr: L('The girls are tall.'),
  why: L('the adjective agrees with chicas'),
};
const NOUN: NounItem = { kind: 'noun', id: 'n1', base: 'la ciudad', ask: L('plural'), answer: 'las ciudades', why: L('la -> las, ciudad + es') };

const onDone = jest.fn();
beforeEach(() => onDone.mockClear());

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
])('typed kinds, %s skin', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('open cloze: one input per gap, no options, right only when every gap is right', () => {
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    expect(screen.getByTestId('cloze-item')).toBeTruthy();
    expect(screen.getAllByTestId(/^cloze-input-\d+$/)).toHaveLength(3);
    fireEvent.changeText(screen.getByTestId('cloze-input-0'), 'soy');
    fireEvent.changeText(screen.getByTestId('cloze-input-1'), 'tengo');
    fireEvent.press(screen.getByTestId('cloze-check')); // the third gap is empty: Check does nothing
    expect(screen.queryByTestId('cloze-wrong')).toBeNull();
    fireEvent.changeText(screen.getByTestId('cloze-input-2'), 'es');
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(screen.getByTestId('cloze-wrong')).toBeTruthy();
    expect(screen.getByTestId('cloze-why')).toHaveTextContent(CLOZE.why.en);
    expect(screen.getByTestId('cloze-input-0').props.editable).toBe(false);
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onDone).toHaveBeenCalledWith(false, undefined, expect.any(String));
  });

  it('open cloze: Enter moves to the next empty gap (keyboard stays), on the last one it checks', () => {
    const focus = jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(() => {});
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    focus.mockClear();
    expect(screen.getByTestId('cloze-input-0').props.returnKeyType).toBe('next');
    fireEvent.changeText(screen.getByTestId('cloze-input-0'), 'soy');
    fireEvent(screen.getByTestId('cloze-input-0'), 'submitEditing');
    expect(screen.queryByTestId('cloze-wrong')).toBeNull();
    expect(screen.queryByTestId('cloze-correct')).toBeNull();
    expect(focus).toHaveBeenCalledTimes(1);
    fireEvent.changeText(screen.getByTestId('cloze-input-1'), 'tengo');
    // the third gap is the only empty one left: from the second gap Enter goes there, from the third it checks
    expect(screen.getByTestId('cloze-input-1').props.returnKeyType).toBe('next');
    expect(screen.getByTestId('cloze-input-2').props.returnKeyType).toBe('done');
    fireEvent.changeText(screen.getByTestId('cloze-input-2'), 'está');
    expect(screen.getByTestId('cloze-input-2').props.returnKeyType).toBe('done');
    fireEvent(screen.getByTestId('cloze-input-2'), 'submitEditing');
    expect(screen.getByTestId('cloze-correct')).toBeTruthy();
    focus.mockRestore();
  });

  it('fix and word bank: the word chips are at least a tap target high', () => {
    render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    expect(StyleSheet.flatten(screen.getByTestId('fix-word-0').props.style)?.minHeight).toBeGreaterThanOrEqual(44);
    screen.unmount();
    render(<BankDrillItem item={BANK} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    expect(StyleSheet.flatten(screen.getByTestId('bank-word-0').props.style)?.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('open cloze: the filled sentence is not read aloud after Check (FB683), right or wrong', () => {
    (speak as jest.Mock).mockClear();
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    CLOZE.answers.forEach((a, i) => fireEvent.changeText(screen.getByTestId(`cloze-input-${i}`), i === 2 ? 'es' : a));
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(screen.getByTestId('cloze-wrong')).toBeTruthy();
    expect(speak).not.toHaveBeenCalled();
    screen.unmount();
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    CLOZE.answers.forEach((a, i) => fireEvent.changeText(screen.getByTestId(`cloze-input-${i}`), a));
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(screen.getByTestId('cloze-correct')).toBeTruthy();
    expect(speak).not.toHaveBeenCalled();
  });

  it('open cloze: all gaps right', () => {
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    CLOZE.answers.forEach((a, i) => fireEvent.changeText(screen.getByTestId(`cloze-input-${i}`), a));
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(screen.getByTestId('cloze-correct')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onDone).toHaveBeenCalledWith(true, undefined, expect.any(String));
  });

  it('open cloze: a missing accent is wrong on the strict setting, right on the lenient one', () => {
    const { unmount } = render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    ['soy', 'tengo', 'esta'].forEach((a, i) => fireEvent.changeText(screen.getByTestId(`cloze-input-${i}`), a));
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(screen.getByTestId('cloze-wrong')).toBeTruthy();
    unmount();
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents={false} onDone={onDone} />);
    ['soy', 'tengo', 'esta'].forEach((a, i) => fireEvent.changeText(screen.getByTestId(`cloze-input-${i}`), a));
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(screen.getByTestId('cloze-correct')).toBeTruthy();
  });

  it('fix: tap the wrong word, then type the fix', () => {
    render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    expect(screen.getByTestId('fix-item')).toBeTruthy();
    expect(screen.queryByTestId('fix-input')).toBeNull(); // nothing to type before the word is found
    fireEvent.press(screen.getByTestId('fix-word-2'));
    fireEvent.changeText(screen.getByTestId('fix-input'), 'está');
    fireEvent.press(screen.getByTestId('fix-check'));
    expect(screen.getByTestId('fix-correct')).toBeTruthy();
    expect(screen.getByTestId('fix-explain')).toHaveTextContent(FIX.explain.en);
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onDone).toHaveBeenCalledWith(true, undefined, expect.any(String));
  });

  it('fix: a wrong tap on the way makes the item wrong even with the right fix typed', () => {
    render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('fix-word-0'));
    fireEvent.press(screen.getByTestId('fix-word-2'));
    fireEvent.changeText(screen.getByTestId('fix-input'), 'está');
    fireEvent.press(screen.getByTestId('fix-check'));
    expect(screen.getByTestId('fix-wrong')).toBeTruthy();
  });

  it('fix: a wrong typed fix shows the comparison', () => {
    render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('fix-word-2'));
    fireEvent.changeText(screen.getByTestId('fix-input'), 'esta');
    fireEvent.press(screen.getByTestId('fix-check'));
    expect(screen.getByTestId('fix-wrong')).toBeTruthy();
    expect(screen.getByTestId('answer-compare-correct')).toBeTruthy();
  });

  it('word bank: the bank words are shown, the agreed form is typed', () => {
    render(<BankDrillItem item={BANK} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    expect(screen.getAllByTestId(/^bank-word-\d+$/)).toHaveLength(3);
    fireEvent.changeText(screen.getByTestId('bank-input'), 'alto');
    fireEvent.press(screen.getByTestId('bank-check'));
    expect(screen.getByTestId('bank-wrong')).toBeTruthy();
    expect(screen.getByTestId('bank-why')).toHaveTextContent(BANK.why.en);
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onDone).toHaveBeenCalledWith(false, undefined, expect.any(String));
  });

  it('word bank: the agreed form is right', () => {
    render(<BankDrillItem item={BANK} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('bank-input'), 'Altas');
    fireEvent.press(screen.getByTestId('bank-check'));
    expect(screen.getByTestId('bank-correct')).toBeTruthy();
  });

  it('article + plural: the given form is shown, the whole new form is typed', () => {
    render(<NounDrillItem item={NOUN} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    expect(screen.getByTestId('noun-base')).toHaveTextContent('la ciudad');
    fireEvent.changeText(screen.getByTestId('noun-input'), 'las ciudad');
    fireEvent.press(screen.getByTestId('noun-check'));
    expect(screen.getByTestId('noun-wrong')).toBeTruthy();
    expect(screen.getByTestId('noun-why')).toHaveTextContent(NOUN.why.en);
  });

  it('article + plural: right', () => {
    render(<NounDrillItem item={NOUN} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('noun-input'), 'las ciudades');
    fireEvent.press(screen.getByTestId('noun-check'));
    expect(screen.getByTestId('noun-correct')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onDone).toHaveBeenCalledWith(true, undefined, expect.any(String));
  });
});
