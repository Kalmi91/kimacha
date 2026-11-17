// The A1 reading text is set apart from the answer options (FB649) and shows the authored question (FB648 / FB650).

import { render } from '@testing-library/react-native';

import type { MockReadMcTask } from '@/lib/exam/mock/types';
import { ThemeProvider } from '@/lib/ThemeContext';
import MockTaskCard from '../MockTaskCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), speakSequence: jest.fn(), stop: jest.fn(), stopSpeaking: jest.fn() }));

const task: MockReadMcTask = {
  id: 'reading-1',
  skill: 'reading',
  instruction: 'TAREA 1. Lea los textos y marque la opción correcta.',
  kind: 'read_mc',
  passages: [
    { text: 'Mi casa es pequeña. Tiene dos cuartos. Mi gato duerme en el sofá.', question: '¿Dónde duerme el gato?', options: ['En el sofá.', 'En el jardín.', 'En la cocina.'], correct: 0 },
    { text: 'Hoy hace calor.', options: ['It is hot today.', 'It is cold.', 'It rains.'], correct: 0 },
  ],
};

const show = () =>
  render(
    <ThemeProvider>
      <MockTaskCard task={task} answer={{}} target="es" canSpeak={false} glossary={[]} onAnswer={() => {}} />
    </ThemeProvider>,
  );

describe('MockTaskCard read_mc (A1 reading)', () => {
  it('the text sits in its own labelled box, apart from the option rows', () => {
    const { getAllByTestId, getByText } = show();
    expect(getAllByTestId('mock-text-box')).toHaveLength(2);
    expect(getByText('Mi casa es pequeña. Tiene dos cuartos. Mi gato duerme en el sofá.')).toBeTruthy();
    expect(getByText('Text 1')).toBeTruthy();
    expect(getByText('Text 2')).toBeTruthy();
  });

  it('an authored passage shows its own question, a generated one the generic "what does the text say"', () => {
    const { getByText } = show();
    expect(getByText('1. ¿Dónde duerme el gato?')).toBeTruthy();
    expect(getByText('2. What does the text say?')).toBeTruthy();
  });

  it('the help line matches the authored task, the generated one keeps the translation help', () => {
    const { getByText, queryByText } = show();
    expect(getByText('Read the text and answer the question.')).toBeTruthy();
    expect(queryByText('Read each short text and choose what it means.')).toBeNull();
  });
});
