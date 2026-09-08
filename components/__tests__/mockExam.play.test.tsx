// Sitting the whole mock exam on screen: intro, four papers with their own
// clocks, no feedback while answering, then the score report and the pass rule.
// This is the exam counterpart of the game playthroughs in app/games/__tests__.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [{ language: 'es-MX', identifier: 'es-mx-1', quality: 'Default', name: 'es' }]),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { buildMockExam } from '@/lib/exam/buildMockExam';
import type { ExamTask } from '@/lib/exam/types';
import MockExamMode from '../exam/MockExamMode';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

/** Answer the task currently on screen correctly. */
function answerTask(task: ExamTask) {
  switch (task.kind) {
    case 'match':
    case 'listen_match':
      for (const prompt of task.prompts) {
        fireEvent.press(screen.getByTestId(`exam-match-${prompt.id}-${task.answer[prompt.id]}`));
      }
      break;
    case 'text_mc':
    case 'listen_mc':
    case 'listen_dialogue':
      task.questions.forEach((q, i) => {
        fireEvent.press(screen.getByTestId(`exam-option-q${i}-${q.correct}`));
      });
      break;
    case 'true_false':
      task.statements.forEach((st, i) => {
        fireEvent.press(screen.getByTestId(`exam-tf-${i}-${st.answer ? 'true' : 'false'}`));
      });
      break;
    case 'gap_mc':
      task.gaps.forEach((gap, i) => {
        fireEvent.press(screen.getByTestId(`exam-option-g${i}-${gap.correct}`));
      });
      break;
    case 'form_fill':
      for (const field of task.fields) {
        fireEvent.changeText(screen.getByTestId(`exam-field-${field.id}`), field.type === 'number' ? '42' : 'Kálmán');
      }
      break;
    case 'short_message':
      fireEvent.changeText(
        screen.getByTestId('exam-message'),
        `${task.points.map((p) => p.keywords[0]).join(' ')} ${'palabra '.repeat(task.minWords)}`
      );
      break;
    case 'speaking_prompt':
      fireEvent.press(screen.getByTestId('exam-self-2'));
      break;
    default:
      break;
  }
}

describe('mock exam, sat from start to certificate', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs the four DELE A1 papers and passes a perfect sheet', async () => {
    const onLevelUp = jest.fn();
    const exam = buildMockExam('es', 'hu', 'A1');
    const view = render(
      <MockExamMode level="A1" direction={['hu', 'es']} onLevelUp={onLevelUp} onExit={jest.fn()} />
    );
    await flush();

    // The intro names the exam it simulates and lists the papers.
    expect(screen.queryByText('DELE A1')).toBeTruthy();
    expect(screen.queryByText('Comprensión de lectura')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-begin'));
    await flush();

    for (const section of exam.sections) {
      // Each paper opens on its own intro with its own clock.
      expect(screen.queryByTestId('exam-start-section')).toBeTruthy();
      fireEvent.press(screen.getByTestId('exam-start-section'));
      await flush();

      for (const task of section.tasks) {
        answerTask(task);
        // Nothing on screen says whether it was right: an exam does not tell you.
        expect(screen.queryByText('Correct!')).toBeNull();
        expect(screen.queryByText('Not quite!')).toBeNull();
        fireEvent.press(screen.getByTestId('exam-next-task'));
        await flush();
      }
    }

    // Verdict, per-paper points, and the level-up the old exam also did.
    expect(screen.queryByText('PASS')).toBeTruthy();
    expect(screen.getByTestId('exam-points-reading').props.children.join('')).toBe('25/25');
    expect(screen.getByTestId('exam-points-listening').props.children.join('')).toBe('25/25');
    expect(onLevelUp).toHaveBeenCalledWith('A2');

    view.unmount();
  });

  it('the paper clock runs down and ends the paper when it hits zero', async () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const reading = exam.sections[0];
    const view = render(
      <MockExamMode level="A1" direction={['hu', 'es']} onLevelUp={jest.fn()} onExit={jest.fn()} />
    );
    await flush();
    fireEvent.press(screen.getByTestId('exam-begin'));
    await flush();
    fireEvent.press(screen.getByTestId('exam-start-section'));
    await flush();

    // 45 minutes for the DELE A1 reading paper.
    expect(String(screen.getByTestId('exam-clock').props.children.join(''))).toContain('45:00');

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(String(screen.getByTestId('exam-clock').props.children.join(''))).toContain('44:00');

    // Run the whole paper clock out: the paper ends and the next one is offered.
    await act(async () => {
      jest.advanceTimersByTime(reading.minutes * 60 * 1000);
      await Promise.resolve();
    });
    await flush();
    expect(screen.queryByTestId('exam-start-section')).toBeTruthy();

    view.unmount();
  });

  it('an empty sheet fails and the review lists the right answers', async () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const view = render(
      <MockExamMode level="A1" direction={['hu', 'es']} onLevelUp={jest.fn()} onExit={jest.fn()} />
    );
    await flush();
    fireEvent.press(screen.getByTestId('exam-begin'));
    await flush();

    for (const section of exam.sections) {
      fireEvent.press(screen.getByTestId('exam-start-section'));
      await flush();
      for (let i = 0; i < section.tasks.length; i++) {
        fireEvent.press(screen.getByTestId('exam-next-task'));
        await flush(1);
      }
      await flush(1);
    }

    expect(screen.queryByText('NOT YET')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-review'));
    await flush();
    expect(screen.queryAllByText(/^Correct: /).length).toBeGreaterThan(10);

    view.unmount();
  });
});
