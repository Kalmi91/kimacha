// The authored B1-C1 task kinds have no screen of their own yet: the card says so instead of crashing the exam.
// The old kinds keep their screens (covered by app/__tests__/mockExam.test.tsx).

import { render } from '@testing-library/react-native';

import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import type { MockTask } from '@/lib/exam/mock/types';
import { ThemeProvider } from '@/lib/ThemeContext';
import MockTaskCard from '../MockTaskCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), stop: jest.fn(), stopSpeaking: jest.fn() }));

const task: MockTask = {
  id: 'reading-1',
  skill: 'reading',
  kind: 'passage_mc',
  instruction: 'PART 1. Read the text.',
  text: 'A short text.',
  questions: [{ stem: 'Which one?', options: ['a', 'b', 'c'], correct: 0 }],
};

describe('MockTaskCard: authored kinds', () => {
  it('shows the instruction and a not-shown-yet note', () => {
    const view = render(
      <ThemeProvider>
        <MockTaskCard task={task} answer={{}} onAnswer={jest.fn()} target="en" canSpeak glossary={[]} />
      </ThemeProvider>,
    );
    expect(view.getByTestId('mock-instruction').props.children).toBe('PART 1. Read the text.');
    expect(view.getByTestId('mock-task-not-shown')).toBeTruthy();
    view.unmount();
  });

  it('the note exists in both interface languages', () => {
    expect(en.mockExam.taskNotShown).toBeTruthy();
    expect(es.mockExam.taskNotShown).toBeTruthy();
    expect(en.mockExam.passRuleScale(160)).toContain('160');
    expect(es.mockExam.passRuleScale(160)).toContain('160');
  });
});
