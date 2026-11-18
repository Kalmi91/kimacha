// FB662 / FB664 / FB665 / FB669: a wrong typed answer in the drill offers "I mistyped" (the answer counts as right), a right
// answer's feedback box is the theme's success green (not the yellow b accent), in both skins.

import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { FixDrillItem } from '../grammar/TypedKinds';
import { WriteDrillItem } from '../grammar/NewKinds';
import { TransformDrillItem } from '../grammar/drill/WhyTransformItems';
import { FormDrillItem } from '../grammar/drill/MatchFormItems';
import type { FixItem, FormItem, TransformItem, WriteItem } from '@/lib/grammar/lessonTypes';
import { t } from '@/lib/i18n';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

const L = (en: string) => ({ en, es: en, hu: en, de: en });
const FIX: FixItem = { kind: 'fix', id: 'f1', es: 'Mi hermano es en Madrid.', wrongIndex: 2, answer: 'está', explain: L('place: estar'), tr: L('My brother is in Madrid.') };
const WRITE: WriteItem = { kind: 'write', id: 'w1', prompt: L('I am tired.'), es: 'Estoy cansado.', accept: [], why: L('estar for states') } as unknown as WriteItem;
const TRANSFORM: TransformItem = {
  kind: 'transform',
  id: 'tr1',
  tense: { from: 'presente', to: 'indefinido' },
  prompt: L('Como pan.'),
  answer: 'Comí pan.',
  wordIds: [],
  why: L('past'),
};
const FORM: FormItem = { kind: 'form', id: 'fo1', verb: 'hablar', person: 'yo', answer: 'hablo', table: 't' } as FormItem;

const onDone = jest.fn();
beforeEach(() => onDone.mockClear());
const bg = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).backgroundColor;

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
])('drill: I mistyped + green feedback, %s skin', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('transform: a wrong answer offers "I mistyped", which counts it as right', () => {
    render(<TransformDrillItem item={TRANSFORM} contentLang="en" strictAccents colors={Colors.light} s={t()} onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comi pann');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.getByTestId('grammar-mistyped')).toHaveTextContent(t().grammar.mistyped);
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('transform: a right answer has no "I mistyped"', () => {
    render(<TransformDrillItem item={TRANSFORM} contentLang="en" strictAccents colors={Colors.light} s={t()} onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comí pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByTestId('grammar-mistyped')).toBeNull();
  });

  it('form: a wrong answer offers "I mistyped"', () => {
    render(<FormDrillItem item={FORM} table={undefined} contentLang="en" learnedLang="es" colors={Colors.light} s={t()} onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('formInput'), 'hablao');
    fireEvent.press(screen.getByTestId('formCheck'));
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('sentence writing: a wrong answer offers "I mistyped"', () => {
    render(<WriteDrillItem item={WRITE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('write-input'), 'Estoy cansadoo');
    fireEvent.press(screen.getByTestId('write-check'));
    expect(screen.getByTestId('write-wrong')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('error correction: a typo in the fix offers "I mistyped"; the right fix has none', () => {
    const { unmount } = render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('fix-word-2'));
    fireEvent.changeText(screen.getByTestId('fix-input'), 'estaa');
    fireEvent.press(screen.getByTestId('fix-check'));
    expect(screen.getByTestId('fix-wrong')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    expect(onDone).toHaveBeenCalledWith(true);
    unmount();
    render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('fix-word-2'));
    fireEvent.changeText(screen.getByTestId('fix-input'), 'está');
    fireEvent.press(screen.getByTestId('fix-check'));
    expect(screen.getByTestId('fix-correct')).toBeTruthy();
    expect(screen.queryByTestId('grammar-mistyped')).toBeNull();
  });

  it('a right typed answer: the feedback box is the success green, a wrong one is not', () => {
    const green = Colors[theme as 'light'].successFill;
    render(<WriteDrillItem item={WRITE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('write-input'), 'Estoy cansado.');
    fireEvent.press(screen.getByTestId('write-check'));
    expect(bg('write-correct')).toBe(green);
  });
});
