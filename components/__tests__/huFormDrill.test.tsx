// The form drill of the Hungarian course grades with the word cards' Hungarian rule: accents are
// phonemic (alma/almá, öt/őt) and never forgiven, case and closing punctuation are.
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { speechLang } from '@/lib/languages';
import { speak } from '@/lib/speech';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

const topic = (answer: string, accept?: string[]): LessonV2 => ({
  schema: 2,
  topic: 'hu-form',
  level: 'A1',
  title: { en: 't', es: 't' },
  body: [],
  speak: { en: 'e', es: 's' },
  items: [{ id: 'form-hu', kind: 'form', verb: 'alma', person: 'tárgyrag', answer, accept, table: 'x' }],
});

async function answerWith(typed: string, lesson: LessonV2) {
  const onFinish = jest.fn();
  render(<GrammarDrill topic={lesson} learnedLang="hu" contentLang="es" onFinish={onFinish} kinds={['form']} />);
  fireEvent.changeText(screen.getByTestId('formInput'), typed);
  fireEvent.press(screen.getByTestId('formCheck'));
  fireEvent.press(screen.getByTestId('grammar-next'));
  return onFinish;
}

describe('Hungarian form drill: strict accents', () => {
  beforeEach(() => (speak as jest.Mock).mockClear());

  it('a missing accent is wrong (almat for almát)', async () => {
    expect(await answerWith('almat', topic('almát'))).toHaveBeenCalledWith(0, 1);
  });

  it('ö and ő are different letters (őt is not öt)', async () => {
    expect(await answerWith('öt', topic('őt'))).toHaveBeenCalledWith(0, 1);
  });

  it('the exact form is right, and case and closing punctuation are forgiven', async () => {
    expect(await answerWith('almát', topic('almát'))).toHaveBeenCalledWith(1, 1);
  });

  it('upper case and a final full stop pass', async () => {
    expect(await answerWith('Almát.', topic('almát'))).toHaveBeenCalledWith(1, 1);
  });

  it('an accepted variant is right, and the accent rule holds for it too', async () => {
    expect(await answerWith('kenyeret', topic('kenyeret', ['kenyért']))).toHaveBeenCalledWith(1, 1);
    expect(await answerWith('kenyert', topic('kenyeret', ['kenyért']))).toHaveBeenCalledWith(0, 1);
  });

  it('the correct form is spoken with the Hungarian voice after Check', async () => {
    await answerWith('xxx', topic('almát'));
    expect(speak).toHaveBeenCalledWith('almát', speechLang('hu'));
    expect(speechLang('hu')).toBe('hu-HU');
  });
});
