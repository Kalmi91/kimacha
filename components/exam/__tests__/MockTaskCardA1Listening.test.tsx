// The authored A1 listening (FB487) shows its own question per question and its own help line; the generated one keeps today's label.

import { render } from '@testing-library/react-native';

import type { MockListenTask } from '@/lib/exam/mock/types';
import { ThemeProvider } from '@/lib/ThemeContext';
import MockTaskCard from '../MockTaskCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), speakSequence: jest.fn(), stop: jest.fn(), stopSpeaking: jest.fn() }));

const base: MockListenTask = {
  id: 'listening-1',
  skill: 'listening',
  instruction: 'TAREA 1. Va a escuchar un texto corto.',
  kind: 'listen_mc',
  audio: ['Hola, Luis, soy Carmen.', 'Mañana voy al cine.'],
  questions: [
    { options: ['Al cine.', 'Al parque.'], correct: 0 },
    { options: ['Luis.', 'Carmen.'], correct: 1 },
  ],
};

const show = (task: MockListenTask) =>
  render(
    <ThemeProvider>
      <MockTaskCard task={task} answer={{}} target="es" canSpeak={false} glossary={[]} onAnswer={() => {}} />
    </ThemeProvider>,
  );

describe('MockTaskCard listen_mc / listen_dialogue (A1 listening)', () => {
  it('an authored task shows the prompt of each question and its own help line', () => {
    const { getByText, queryByText } = show({ ...base, prompts: ['¿Adónde va Carmen?', '¿Quién habla?'], lineOf: [1, 0] });
    expect(getByText('1. ¿Adónde va Carmen?')).toBeTruthy();
    expect(getByText('2. ¿Quién habla?')).toBeTruthy();
    expect(queryByText('1. What did you hear?')).toBeNull();
    expect(getByText('Listen to the text (twice) and answer the questions.')).toBeTruthy();
  });

  it('an authored dialogue has the conversation help line', () => {
    const { getByText } = show({ ...base, kind: 'listen_dialogue', prompts: ['¿Adónde va Carmen?', '¿Quién habla?'], lineOf: [1, 0] });
    expect(getByText('1. ¿Adónde va Carmen?')).toBeTruthy();
    expect(getByText('Listen to the conversation (twice) and answer the questions.')).toBeTruthy();
  });

  it('a generated task keeps today\'s labels and help', () => {
    const mc = show(base);
    expect(mc.getByText('1. What did you hear?')).toBeTruthy();
    expect(mc.getByText('Listen to the sentences (twice) and choose what you heard.')).toBeTruthy();
    const dialogue = show({ ...base, kind: 'listen_dialogue' });
    expect(dialogue.getByText('1. Line 1: what was said?')).toBeTruthy();
  });
});
