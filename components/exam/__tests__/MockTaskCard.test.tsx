// The authored B1-C1 task kinds on screen: each kind renders from the engine's fixtures (lib/exam/mock/__tests__/fixtures),
// takes an answer, and the answer lands under the key the scoring reads (lib/exam/mock/types.ts, "answer key of the learner").
// The older kinds keep their screens (covered by app/__tests__/mockExam.test.tsx).

import { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { authoredTasks } from '@/lib/exam/mock/authored';
import type { MockTarget, MockTask, MockTaskAnswer } from '@/lib/exam/mock/types';
import { speakSequence, stop } from '@/lib/speech';
import { ThemeProvider } from '@/lib/ThemeContext';
import { fixturePapers } from '@/test-utils/mockExamFixtures';
import MockTaskCard from '../MockTaskCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), speakSequence: jest.fn(), stop: jest.fn(), stopSpeaking: jest.fn() }));

type Level = 'B1' | 'B2' | 'C1';

const taskAt = (target: MockTarget, level: Level, paper: string, index: number): MockTask =>
  authoredTasks(target, level, paper, 0, 1, fixturePapers(target, level))[index];

// A card with the answer state the screen keeps; `sink.current` (see show) is what the learner has given so far.
function Harness({ task, target, canSpeak, onGive }: { task: MockTask; target: MockTarget; canSpeak: boolean; onGive: (key: string, value: string | number | boolean | null) => void }) {
  const [answer, setAnswer] = useState<MockTaskAnswer>({});
  return (
    <ThemeProvider>
      <MockTaskCard
        task={task}
        answer={answer}
        target={target}
        canSpeak={canSpeak}
        glossary={[]}
        onAnswer={(key, value) => {
          onGive(key, value);
          setAnswer((a) => ({ ...a, [key]: value }));
        }}
      />
    </ThemeProvider>
  );
}

const show = (task: MockTask, target: MockTarget = 'en', canSpeak = true) => {
  const sink = { current: {} as MockTaskAnswer };
  const onGive = (key: string, value: string | number | boolean | null) => {
    sink.current = { ...sink.current, [key]: value };
  };
  const view = render(<Harness task={task} target={target} canSpeak={canSpeak} onGive={onGive} />);
  return { view, sink };
};

const withAudio = <T extends MockTask>(task: T, audio: { speaker?: 'm' | 'f' | 'n'; text: string }[]): T => ({ ...task, audio });

beforeEach(() => {
  (speakSequence as jest.Mock).mockClear();
  (stop as jest.Mock).mockClear();
});

describe('passage_mc', () => {
  it('a text: the passage box, numbered questions, the option lands under the question index', () => {
    const { view, sink } = show(taskAt('es', 'B1', 'reading', 1), 'es');
    expect(view.getByTestId('mock-instruction').props.children).toMatch(/^TAREA 2\./);
    expect(view.getByTestId('mock-passage')).toBeTruthy();
    expect(view.queryByTestId('mock-play')).toBeNull();
    expect(view.getByText('1. Pregunta 1')).toBeTruthy();
    fireEvent.press(view.getByTestId('mock-option-q0-2'));
    fireEvent.press(view.getByTestId('mock-option-q1-0'));
    expect(sink.current).toEqual({ '0': 2, '1': 0 });
  });

  it('a recording: speakers get their own pitch, the plays count down, a double tap uses one listen, the speech stops on leaving', () => {
    const task = withAudio(taskAt('es', 'C1', 'listening', 2), [{ speaker: 'm', text: 'uno' }, { speaker: 'f', text: 'dos' }, { text: 'tres' }]);
    const { view } = show(task, 'es');
    expect(view.queryByTestId('mock-passage')).toBeNull();
    expect(view.getByTestId('mock-plays-left').props.children).toBe('Plays left: 2');
    fireEvent.press(view.getByTestId('mock-play'));
    fireEvent.press(view.getByTestId('mock-play'));
    expect(speakSequence).toHaveBeenCalledTimes(1);
    const [segments, onEnd] = (speakSequence as jest.Mock).mock.calls[0];
    expect(segments.map((s: { text: string; pitch: number }) => [s.text, s.pitch])).toEqual([['uno', 0.85], ['dos', 1.15], ['tres', 1]]);
    expect(view.getByTestId('mock-plays-left').props.children).toBe('Plays left: 1');
    act(() => onEnd());
    fireEvent.press(view.getByTestId('mock-play'));
    expect(speakSequence).toHaveBeenCalledTimes(2);
    expect(view.getByTestId('mock-plays-left').props.children).toBe('Plays left: 0');
    act(() => (speakSequence as jest.Mock).mock.calls[1][1]());
    fireEvent.press(view.getByTestId('mock-play'));
    expect(speakSequence).toHaveBeenCalledTimes(2); // out of plays
    view.unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('a recording that is cut off from outside (app in the background) gives the button back', () => {
    const { view } = show(withAudio(taskAt('es', 'C1', 'listening', 2), [{ text: 'uno' }]), 'es');
    fireEvent.press(view.getByTestId('mock-play'));
    act(() => (speakSequence as jest.Mock).mock.calls[0][2]());
    fireEvent.press(view.getByTestId('mock-play'));
    expect(speakSequence).toHaveBeenCalledTimes(2);
  });

  it('the plays of the task (`plays`) are honoured', () => {
    const task = { ...withAudio(taskAt('es', 'C1', 'listening', 2), [{ text: 'uno' }]), plays: 1 } as MockTask;
    const { view } = show(task, 'es');
    expect(view.getByTestId('mock-plays-left').props.children).toBe('Plays left: 1');
    fireEvent.press(view.getByTestId('mock-play'));
    act(() => (speakSequence as jest.Mock).mock.calls[0][1]());
    fireEvent.press(view.getByTestId('mock-play'));
    expect(speakSequence).toHaveBeenCalledTimes(1); // the only play is used up
    expect(view.getByTestId('mock-plays-left').props.children).toBe('Plays left: 0');
  });

  it('no voice on the device: the transcript is offered instead of the player, A / B for two speakers', () => {
    const task = withAudio(taskAt('es', 'C1', 'listening', 2), [{ speaker: 'm', text: 'uno' }, { speaker: 'f', text: 'dos' }]);
    const { view } = show(task, 'es', false);
    expect(view.queryByTestId('mock-play')).toBeNull();
    fireEvent.press(view.getByTestId('mock-transcript-toggle'));
    expect(view.getByTestId('mock-transcript').props.children).toBe('A: uno\nB: dos');
  });
});

describe('clips_mc', () => {
  it('texts: the questions are numbered across the clips and the answer key counts across them too', () => {
    const { view, sink } = show(taskAt('en', 'B1', 'reading', 0));
    expect(view.getByText('1. Question 1')).toBeTruthy();
    expect(view.getByText('2. Question 2')).toBeTruthy();
    fireEvent.press(view.getByTestId('mock-option-q1-1'));
    expect(sink.current).toEqual({ '1': 1 });
  });

  it('recordings: a player per clip, the plays are counted per clip', () => {
    const { view } = show(taskAt('es', 'C1', 'listening', 1), 'es');
    fireEvent.press(view.getByTestId('mock-play-0'));
    fireEvent.press(view.getByTestId('mock-play-1')); // mute while clip 1 plays
    expect(speakSequence).toHaveBeenCalledTimes(1);
    act(() => (speakSequence as jest.Mock).mock.calls[0][1]());
    fireEvent.press(view.getByTestId('mock-play-1'));
    expect(speakSequence).toHaveBeenCalledTimes(2);
    expect(view.getByTestId('mock-plays-left-0').props.children).toBe('Plays left: 1');
    expect(view.getByTestId('mock-plays-left-1').props.children).toBe('Plays left: 1');
    expect(view.getByTestId('mock-plays-left-2').props.children).toBe('Plays left: 2');
  });
});

describe('match_pool', () => {
  it('unique: a letter used at another prompt moves to the prompt just tapped; tapping it again clears it', () => {
    const { view, sink } = show(taskAt('es', 'B1', 'reading', 0), 'es');
    fireEvent.press(view.getByTestId('mock-match-p1-a'));
    fireEvent.press(view.getByTestId('mock-match-p2-a'));
    expect(sink.current).toMatchObject({ p1: null, p2: 'a' });
    fireEvent.press(view.getByTestId('mock-match-p2-a'));
    expect(sink.current.p2).toBeNull();
  });

  it('not unique: the same letter can stand at several prompts', () => {
    const { view, sink } = show(taskAt('es', 'B1', 'reading', 2), 'es');
    fireEvent.press(view.getByTestId('mock-match-p1-a'));
    fireEvent.press(view.getByTestId('mock-match-p2-a'));
    expect(sink.current).toMatchObject({ p1: 'a', p2: 'a' });
  });

  it('the options are cards with a letter, and a long text folds and unfolds', () => {
    const { view } = show(taskAt('es', 'B1', 'reading', 0), 'es');
    expect(view.getByTestId('mock-card-a').props.children).toBe('A');
    expect(view.getByTestId('mock-card-b').props.children).toBe('B');
    const folded = view.getAllByText('Show more').length;
    expect(folded).toBeGreaterThan(0);
    fireEvent.press(view.getByTestId('mock-card-toggle-a'));
    expect(view.getByText('Show less')).toBeTruthy();
    expect(view.getAllByText('Show more')).toHaveLength(folded - 1);
  });

  it('prompts with a recording: a player per prompt', () => {
    const { view } = show(taskAt('en', 'C1', 'listening', 3));
    expect(view.getByText('Recording 1')).toBeTruthy();
    fireEvent.press(view.getByTestId('mock-play-p2'));
    expect(speakSequence).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('mock-plays-left-p2').props.children).toBe('Plays left: 1');
    expect(view.getByTestId('mock-plays-left-p1').props.children).toBe('Plays left: 2');
  });
});

describe('gapped_text', () => {
  it('a numbered chip at every gap; a fragment fits one gap only, so picking it again moves it', () => {
    const { view, sink } = show(taskAt('es', 'B1', 'reading', 3), 'es');
    expect(view.getByTestId('mock-gapchip-1').props.children).toBe(' [1] ');
    fireEvent.press(view.getByTestId('mock-fragment-1-f2'));
    expect(view.getByTestId('mock-gapchip-1').props.children).toBe(' [1: B] ');
    fireEvent.press(view.getByTestId('mock-fragment-2-f2'));
    expect(sink.current).toMatchObject({ '1': null, '2': 'f2' });
    expect(view.getByTestId('mock-gapchip-1').props.children).toBe(' [1] ');
    expect(view.getByTestId('mock-gapchip-2').props.children).toBe(' [2: B] ');
  });
});

describe('cloze', () => {
  it('multiple choice: the option row per gap, the chosen word stands in the text', () => {
    const { view, sink } = show(taskAt('es', 'B1', 'reading', 4), 'es');
    fireEvent.press(view.getByTestId('mock-option-c0-1'));
    expect(sink.current).toEqual({ '0': 1 });
    expect(view.getByTestId('mock-gapchip-1').props.children).toBe(' [1: grande1] ');
  });

  it('open gaps: an input per gap, the typed word stands in the text', () => {
    const { view, sink } = show(taskAt('en', 'B1', 'reading', 5));
    fireEvent.changeText(view.getByTestId('mock-cloze-0'), 'house0');
    expect(sink.current).toEqual({ '0': 'house0' });
    expect(view.getByTestId('mock-gapchip-1').props.children).toBe(' [1: house0] ');
  });

  it('the word to transform stands beside its input in capitals', () => {
    const task = taskAt('en', 'B2', 'readinguse', 2);
    const stem = (task as { gaps: { stem?: string }[] }).gaps[0].stem;
    expect(stem).toBeTruthy();
    const { view } = show(task);
    expect(view.getByTestId('mock-cloze-stem-0').props.children).toBe(stem!.toUpperCase());
  });

  it('with a recording the player stands on top of the gapped text', () => {
    const { view } = show(taskAt('en', 'C1', 'listening', 1));
    expect(view.getByTestId('mock-play')).toBeTruthy();
    expect(view.getByTestId('mock-gapchip-1')).toBeTruthy();
  });
});

describe('pick_statements', () => {
  it('at most `pick` statements can be marked; the counter shows "3 / 6"; a marked one can be taken back', () => {
    const task = taskAt('es', 'C1', 'listening', 0);
    const pick = (task as { pick: number }).pick;
    const { view, sink } = show(task, 'es');
    expect(view.getByTestId('mock-pick-count').props.children).toBe(`0 / ${pick}`);
    for (let i = 0; i <= pick; i++) fireEvent.press(view.getByTestId(`mock-statement-${i}`));
    expect(view.getByTestId('mock-pick-count').props.children).toBe(`${pick} / ${pick}`);
    expect(sink.current[String(pick)]).toBeUndefined(); // the one over the limit was not marked
    fireEvent.press(view.getByTestId('mock-statement-0'));
    expect(sink.current['0']).toBeNull();
    expect(view.getByTestId('mock-pick-count').props.children).toBe(`${pick - 1} / ${pick}`);
    expect(view.getByTestId('mock-play')).toBeTruthy();
  });
});

describe('transform', () => {
  it('the first sentence, the word to use highlighted in capitals, the typed words under the item index', () => {
    const task = taskAt('en', 'B2', 'readinguse', 3);
    const item = (task as { items: { key: string }[] }).items[0];
    const { view, sink } = show(task);
    expect(view.getByTestId('mock-transform-word-0').props.children).toBe(item.key.toUpperCase());
    expect(view.getByText('1. First sentence 1.')).toBeTruthy();
    fireEvent.changeText(view.getByTestId('mock-transform-0'), 'word1 key1');
    expect(sink.current).toEqual({ '0': 'word1 key1' });
  });
});

describe('essay', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'palabra').join(' ');

  it('one choice (compulsory) with a recording: no chooser, the player, the field with the live count', () => {
    const { view, sink } = show(taskAt('es', 'B2', 'writing', 0), 'es');
    expect(view.queryByTestId('mock-essay-choice-a')).toBeNull();
    expect(view.getByTestId('mock-play')).toBeTruthy();
    fireEvent.changeText(view.getByTestId('mock-essay-text'), 'hola amigo');
    expect(sink.current).toEqual({ text: 'hola amigo' });
    expect(view.getByTestId('mock-essay-words').props.children).toMatch(/^2 \/ \d+-\d+ words$/);
  });

  it('several choices: one is active, switching keeps what was typed for each; the band sign follows the count', () => {
    const task = taskAt('es', 'B2', 'writing', 1);
    const choices = (task as { choices: { id: string; minWords: number; maxWords: number; input?: string }[] }).choices;
    const [a, b] = choices;
    const { view, sink } = show(task, 'es');
    expect(view.getByTestId('mock-essay-input')).toBeTruthy();
    expect(view.getByTestId('mock-essay-band-below')).toBeTruthy();
    fireEvent.changeText(view.getByTestId('mock-essay-text'), words(a.minWords));
    expect(view.getByTestId('mock-essay-band-in')).toBeTruthy();
    expect(view.getByTestId('mock-essay-words').props.children).toBe(`${a.minWords} / ${a.minWords}-${a.maxWords} words`);
    fireEvent.changeText(view.getByTestId('mock-essay-text'), words(a.maxWords + 1));
    expect(view.getByTestId('mock-essay-band-above')).toBeTruthy();
    fireEvent.press(view.getByTestId(`mock-essay-choice-${b.id}`));
    expect(sink.current).toMatchObject({ choice: b.id, text: '' });
    fireEvent.changeText(view.getByTestId('mock-essay-text'), 'otra');
    fireEvent.press(view.getByTestId(`mock-essay-choice-${a.id}`));
    expect(sink.current).toMatchObject({ choice: a.id, text: words(a.maxWords + 1) });
    fireEvent.press(view.getByTestId(`mock-essay-choice-${b.id}`));
    expect(sink.current).toMatchObject({ choice: b.id, text: 'otra' });
  });
});
