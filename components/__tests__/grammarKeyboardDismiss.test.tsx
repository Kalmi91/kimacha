// E160: after a wrong Check on a typed grammar task the keyboard closes, so the right answer, the
// explanation and the translation are not hidden behind it (word bank first, then every other typed kind).
// An unchecked press (empty input) must not close it.

import { Keyboard } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import { DictationDrillItem, WriteDrillItem } from '../grammar/NewKinds';
import { BankDrillItem, ClozeDrillItem, FixDrillItem, NounDrillItem } from '../grammar/TypedKinds';
import type { BankItem, ClozeItem, DictationItem, FixItem, LessonV2, NounItem, WriteItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const L = (en: string) => ({ en, es: en });
const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
beforeEach(() => dismiss.mockClear());

const onDone = jest.fn();
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const BANK: BankItem = {
  kind: 'bank',
  id: 'b1',
  bank: ['está', 'hay', 'son'],
  es: 'En mi calle ___ una farmacia.',
  word: 'hay',
  answer: 'hay',
  tr: L('There is a pharmacy on my street.'),
  why: L('hay: existence'),
};
const CLOZE: ClozeItem = { kind: 'opencloze', id: 'c1', text: 'Mi casa ___ cerca.', answers: ['está'], tr: L('My house is near.'), why: L('estar for place') };
const FIX: FixItem = { kind: 'fix', id: 'f1', es: 'Mi hermano es en Madrid.', wrongIndex: 2, answer: 'está', explain: L('place: estar'), tr: L('My brother is in Madrid.') };
const NOUN: NounItem = { kind: 'noun', id: 'n1', base: 'la ciudad', ask: L('plural'), answer: 'las ciudades', why: L('la -> las') };
const DICT: DictationItem = { kind: 'dictation', id: 'd1', es: 'Tengo un perro.', tr: L('I have a dog.') };
const WRITE: WriteItem = { kind: 'write', id: 'w1', prompt: L('I have a dog.'), es: 'Tengo un perro.', why: L('tener') } as WriteItem;

describe('keyboard closes after a wrong Check', () => {
  it('word bank: wrong answer closes the keyboard, the feedback is shown; an empty Check does not', () => {
    render(<BankDrillItem item={BANK} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('bank-check'));
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('bank-input'), 'está');
    fireEvent.press(screen.getByTestId('bank-check'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('bank-wrong')).toBeTruthy();
    expect(screen.getByTestId('bank-why')).toHaveTextContent('hay: existence');
  });

  it('open cloze', () => {
    render(<ClozeDrillItem item={CLOZE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('cloze-input-0'), 'es');
    fireEvent.press(screen.getByTestId('cloze-check'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cloze-wrong')).toBeTruthy();
  });

  it('error correction', () => {
    render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('fix-word-2'));
    fireEvent.changeText(screen.getByTestId('fix-input'), 'esta');
    fireEvent.press(screen.getByTestId('fix-check'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('fix-wrong')).toBeTruthy();
  });

  it('article + plural', () => {
    render(<NounDrillItem item={NOUN} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('noun-input'), 'las ciudad');
    fireEvent.press(screen.getByTestId('noun-check'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('noun-wrong')).toBeTruthy();
  });

  it('dictation', () => {
    render(<DictationDrillItem item={DICT} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.changeText(screen.getByTestId('dictation-input'), 'Tengo un gato.');
    fireEvent.press(screen.getByTestId('dictation-check'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('sentence writing', () => {
    render(<WriteDrillItem item={WRITE} learnedLang="es" contentLang="en" strictAccents onDone={onDone} />);
    fireEvent.press(screen.getByTestId('write-check'));
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('write-input'), 'Tengo un gato.');
    fireEvent.press(screen.getByTestId('write-check'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('transform', async () => {
    const lesson: LessonV2 = {
      schema: 2,
      topic: 'kb-transform',
      level: 'A2',
      title: { en: 't', es: 't' },
      body: [],
      speak: { en: 'e', es: 's' },
      items: [
        {
          kind: 'transform',
          id: 'tr-01',
          tense: { from: 'presente', to: 'indefinido' },
          prompt: { en: 'I eat bread.', es: 'Como pan.' },
          answer: 'Comí pan.',
          wordIds: ['1'],
          why: { en: 'why', es: 'porque' },
        },
      ],
    };
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['transform']} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'como cosas raras');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('form', () => {
    const lesson: LessonV2 = {
      schema: 2,
      topic: 'kb-form',
      level: 'A1',
      title: { en: 't', es: 't' },
      body: [
        {
          kind: 'table',
          id: 'ser-presente',
          title: { en: 'ser', es: 'ser' },
          header: [
            { en: 'Person', es: 'Persona' },
            { en: 'ser', es: 'ser' },
          ],
          rows: [['nosotros', 'somos']],
        },
      ],
      speak: { en: 'e', es: 's' },
      items: [{ id: 'form-01', kind: 'form', verb: 'ser', person: 'nosotros', answer: 'somos', table: 'ser-presente' }],
    };
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice', 'match', 'form']} />);
    fireEvent.changeText(screen.getByTestId('formInput'), 'son');
    fireEvent.press(screen.getByTestId('formCheck'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
