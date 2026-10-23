// The speaking task on screen (components/exam/mock/SpeakingTask.tsx), without the exam screen: the topic chooser, the task
// sheet with the photo credit, the preparation time (countdown, notes, skipping, the clock hold), the examiner's turns one
// by one (read aloud once when a turn opens, replay, going back), the answer keys the scoring reads, and a task that follows another.
// The speech is mocked (nothing sounds), the photo register is replaced by one known key.

import { useState } from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { authoredTasks } from '@/lib/exam/mock/authored';
import type { MockTask, MockTaskAnswer } from '@/lib/exam/mock/types';
import { speak, stop } from '@/lib/speech';
import { ThemeProvider } from '@/lib/ThemeContext';
import { speakingFile } from '@/test-utils/mockSpeakingFixture';
import MockTaskCard from '../MockTaskCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), speakSequence: jest.fn(), stop: jest.fn(), stopSpeaking: jest.fn() }));
jest.mock('@/data/examPhotos', () => ({
  examPhoto: (key: string) =>
    key === 'en-b1-1' ? { source: { uri: 'photo' }, width: 640, height: 427, author: 'A. Author', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Beach.jpg' } : undefined,
}));

const tasks = authoredTasks('en', 'B1', 'speaking', 0, 1, [speakingFile('en', 'B1')]);
const holiday = tasks[0]; // two choices, 90 s of preparation
const followUp = tasks[1]; // follows the first, no preparation

type Opts = { canSpeak?: boolean; inheritedChoice?: string; lastTask?: boolean; start?: MockTaskAnswer };

function Harness({ task, opts, onGive, onHold, onNext }: { task: MockTask; opts: Opts; onGive: (key: string, value: string | number | boolean | null) => void; onHold: (h: boolean) => void; onNext: () => void }) {
  const [answer, setAnswer] = useState<MockTaskAnswer>(opts.start ?? {});
  return (
    <ThemeProvider>
      <MockTaskCard
        task={task}
        answer={answer}
        target="en"
        canSpeak={opts.canSpeak ?? true}
        glossary={[]}
        inheritedChoice={opts.inheritedChoice}
        lastTask={opts.lastTask}
        onHoldClock={onHold}
        onNextTask={onNext}
        onAnswer={(key, value) => {
          onGive(key, value);
          setAnswer((a) => ({ ...a, [key]: value }));
        }}
      />
    </ThemeProvider>
  );
}

const show = (task: MockTask, opts: Opts = {}) => {
  const sink = { current: { ...(opts.start ?? {}) } as MockTaskAnswer };
  const onGive = (key: string, value: string | number | boolean | null) => {
    sink.current = { ...sink.current, [key]: value };
  };
  const onHold = jest.fn();
  const onNext = jest.fn();
  const view = render(<Harness task={task} opts={opts} onGive={onGive} onHold={onHold} onNext={onNext} />);
  const press = (id: string) => fireEvent.press(view.getByTestId(id));
  return { view, sink, onHold, onNext, press };
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  (speak as jest.Mock).mockClear();
  (stop as jest.Mock).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the topic chooser', () => {
  it('shows every choice with its title and the first sentence of its prompt; Continue waits for a pick and the pick is written as `choice`', () => {
    const { view, sink, press } = show(holiday);
    expect(view.getByTestId('mock-instruction').props.children).toMatch(/^PART 1\./);
    expect(view.getByText('A holiday')).toBeTruthy();
    expect(view.getByText('Talk about a holiday you remember.')).toBeTruthy();
    expect(view.getByText('A job')).toBeTruthy();
    expect(view.queryByTestId('mock-speaking-sheet')).toBeNull();
    expect(view.getByTestId('mock-speaking-primary').props.accessibilityState?.disabled).toBe(true);
    expect(view.getByText('Continue')).toBeTruthy();
    press('mock-speaking-primary');
    expect(view.queryByTestId('mock-speaking-sheet')).toBeNull();
    press('mock-speaking-choice-b');
    expect(sink.current.choice).toBe('b');
    expect(view.getByTestId('mock-speaking-choice-b').props.accessibilityState.selected).toBe(true);
    press('mock-speaking-primary');
    expect(view.getByTestId('mock-speaking-title').props.children).toBe('A job');
  });

  it('a task with one choice has no chooser', () => {
    const single = { ...holiday, choices: [holiday.kind === 'speaking' ? holiday.choices[1] : null] } as MockTask;
    const { view } = show(single);
    expect(view.queryByTestId('mock-speaking-choice-b')).toBeNull();
    expect(view.getByTestId('mock-speaking-title').props.children).toBe('A job');
  });
});

describe('the task sheet', () => {
  it('shows the prompt, the guiding points, the scrollable input, the photo with its credit line and the speaking time; a missing photo is skipped', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { view, press } = show(holiday);
    press('mock-speaking-choice-a');
    press('mock-speaking-primary');
    expect(view.getByTestId('mock-speaking-prompt').props.children).toBe('Talk about a holiday you remember. It can be a short trip.');
    expect(view.getByTestId('mock-speaking-bullet-0').props.children.join('')).toBe('• where you went');
    expect(view.getByTestId('mock-speaking-bullet-1')).toBeTruthy();
    expect(view.getByTestId('mock-speaking-input')).toBeTruthy();
    expect(view.getByTestId('mock-speaking-photo-en-b1-1')).toBeTruthy();
    expect(view.queryByTestId('mock-speaking-photo-en-b1-9')).toBeNull();
    expect(view.getByText('Photo: A. Author, CC BY 4.0, Wikimedia Commons')).toBeTruthy();
    expect(view.getByTestId('mock-speaking-talktime').props.children).toBe('Speak for about 2-3 minutes');
    fireEvent.press(view.getByTestId('mock-speaking-photo-credit-en-b1-1'));
    expect(open).toHaveBeenCalledWith('https://commons.wikimedia.org/wiki/File:Beach.jpg');
  });
});

describe('the preparation time', () => {
  const toSheet = () => {
    const r = show(holiday);
    r.press('mock-speaking-choice-a');
    r.press('mock-speaking-primary');
    return r;
  };

  it('counts down in mm:ss, holds the paper clock, keeps the notes in the answer (`notes`), and "I\'m ready" ends it at once', () => {
    const { view, sink, onHold, press } = toSheet();
    expect(view.getByTestId('mock-speaking-prep-left').props.children).toBe('Preparation time left: 1:30');
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenLastCalledWith(true);
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(view.getByTestId('mock-speaking-prep-left').props.children).toBe('Preparation time left: 1:00');
    fireEvent.changeText(view.getByTestId('mock-speaking-notes'), 'beach, family');
    expect(sink.current.notes).toBe('beach, family');
    expect(view.getByText("I'm ready, let's start")).toBeTruthy();
    press('mock-speaking-primary');
    expect(onHold).toHaveBeenLastCalledWith(false);
    expect(view.getByTestId('mock-speaking-turn-counter').props.children).toBe('Question 1 / 2');
    expect(view.queryByTestId('mock-speaking-prep-left')).toBeNull();
  });

  it('moves on by itself when the time is up', () => {
    const { view, onHold } = toSheet();
    act(() => {
      jest.advanceTimersByTime(90_000);
    });
    expect(view.getByTestId('mock-speaking-turn-counter').props.children).toBe('Question 1 / 2');
    expect(onHold).toHaveBeenLastCalledWith(false);
  });

  it('leaving the task during the preparation releases the clock', () => {
    const { view, onHold } = toSheet();
    expect(onHold).toHaveBeenLastCalledWith(true);
    view.unmount();
    expect(onHold).toHaveBeenLastCalledWith(false);
  });

  it('a task without preparation time shows the sheet with the start button only, and never touches the clock', () => {
    const { view, onHold, press } = show(followUp, { inheritedChoice: 'a' });
    expect(view.queryByTestId('mock-speaking-prep-left')).toBeNull();
    expect(view.queryByTestId('mock-speaking-notes')).toBeNull();
    press('mock-speaking-primary');
    expect(onHold).not.toHaveBeenCalled();
    expect(view.getByTestId('mock-speaking-turn-counter')).toBeTruthy();
  });
});

describe('the examiner turns', () => {
  const toTurns = (opts: Opts = {}) => {
    const r = show(holiday, opts);
    r.press('mock-speaking-choice-a');
    r.press('mock-speaking-primary');
    r.press('mock-speaking-primary');
    return r;
  };

  it('shows the question and reads it aloud once when the turn opens; the replay button reads it again', () => {
    const { view, press } = toTurns();
    expect(view.getByTestId('mock-speaking-ask').props.children).toBe('Where did you go last summer?');
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith('Where did you go last summer?', 'en-US');
    press('mock-speaking-replay');
    expect(speak).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalled();
  });

  it('writes the answer into the task answer on every change, under the turn id, and counts the words against the minimum', () => {
    const { view, sink } = toTurns();
    expect(view.getByTestId('mock-speaking-words').props.children).toBe('0 words, aim for at least 8');
    fireEvent.changeText(view.getByTestId('mock-speaking-answer'), 'I went to the beach');
    expect(sink.current.t1).toBe('I went to the beach');
    expect(view.getByTestId('mock-speaking-words').props.children).toBe('5 words, aim for at least 8');
    fireEvent.changeText(view.getByTestId('mock-speaking-answer'), 'I went to the beach with my family');
    expect(sink.current.t1).toBe('I went to the beach with my family');
    expect(view.getByTestId('mock-speaking-hint').props.children).toBe("Speak with your keyboard's microphone, or type.");
  });

  it('the answer field keeps the keyboard microphone: no input restrictions of the written answers', () => {
    const { view } = toTurns();
    const field = view.getByTestId('mock-speaking-answer');
    expect(field.props.multiline).toBe(true);
    expect(field.props.autoCorrect).toBeUndefined();
    expect(field.props.spellCheck).toBeUndefined();
    expect(field.props.autoComplete).toBeUndefined();
  });

  it('goes turn by turn: the label follows the step, going back keeps the earlier answer, the last turn calls the paper next-task action', () => {
    const { view, sink, onNext, press } = toTurns();
    fireEvent.changeText(view.getByTestId('mock-speaking-answer'), 'first answer');
    expect(view.getByText('Next question')).toBeTruthy();
    expect(view.queryByTestId('mock-speaking-prev')).toBeNull();
    press('mock-speaking-primary');
    expect(view.getByTestId('mock-speaking-turn-counter').props.children).toBe('Question 2 / 2');
    expect(view.getByTestId('mock-speaking-ask').props.children).toBe('Did you like it?');
    expect(speak).toHaveBeenLastCalledWith('Did you like it?', 'en-US');
    expect(view.getByText('Next task')).toBeTruthy();
    fireEvent.changeText(view.getByTestId('mock-speaking-answer'), 'second answer');
    press('mock-speaking-prev');
    expect(view.getByTestId('mock-speaking-answer').props.value).toBe('first answer');
    press('mock-speaking-primary');
    expect(view.getByTestId('mock-speaking-answer').props.value).toBe('second answer');
    expect(onNext).not.toHaveBeenCalled();
    press('mock-speaking-primary');
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(sink.current).toMatchObject({ choice: 'a', t1: 'first answer', t2: 'second answer' });
  });

  it('on the last task of the paper the last button says "Finish paper"', () => {
    const { view } = toTurns({ lastTask: true });
    fireEvent.press(view.getByTestId('mock-speaking-primary'));
    expect(view.getByText('Finish paper')).toBeTruthy();
  });

  it('the task sheet and the notes are one tap away, collapsed by default', () => {
    const { view, press } = toTurns();
    expect(view.queryByTestId('mock-speaking-sheet')).toBeNull();
    press('mock-speaking-sheet-toggle');
    expect(view.getByTestId('mock-speaking-prompt')).toBeTruthy();
    expect(view.getByTestId('mock-speaking-photo-en-b1-1')).toBeTruthy();
    expect(view.getByTestId('mock-speaking-notes')).toBeTruthy();
    press('mock-speaking-sheet-toggle');
    expect(view.queryByTestId('mock-speaking-sheet')).toBeNull();
  });

  it('without a voice for the language the question stays on the screen, nothing is spoken and there is no replay button', () => {
    const { view } = toTurns({ canSpeak: false });
    expect(speak).not.toHaveBeenCalled();
    expect(view.queryByTestId('mock-speaking-replay')).toBeNull();
    expect(view.getByTestId('mock-speaking-no-voice')).toBeTruthy();
    expect(view.getByTestId('mock-speaking-ask').props.children).toBe('Where did you go last summer?');
  });

  it('stops the speech when the task goes away', () => {
    const { view } = toTurns();
    (stop as jest.Mock).mockClear();
    view.unmount();
    expect(stop).toHaveBeenCalled();
  });
});

describe('a task that follows another', () => {
  it('has no chooser: it takes the followed task\'s choice and writes it into its own answer as `choice`', () => {
    const { view, sink } = show(followUp, { inheritedChoice: 'b' });
    expect(view.queryByTestId('mock-speaking-choice-a')).toBeNull();
    expect(view.getByTestId('mock-speaking-title').props.children).toBe('More about the job');
    expect(sink.current.choice).toBe('b');
  });

  it('with nothing to inherit it falls back to the first choice, like the scoring', () => {
    const { view, sink } = show(followUp);
    expect(view.getByTestId('mock-speaking-title').props.children).toBe('More about the holiday');
    expect(sink.current.choice).toBe('a');
  });
});

describe('a rebuilt card (the leave dialog was opened and closed)', () => {
  it('resumes at the first unanswered turn when there are answers, at the sheet when there are only a choice', () => {
    const a = show(holiday, { start: { choice: 'a', t1: 'I went to the beach' } });
    expect(a.view.getByTestId('mock-speaking-turn-counter').props.children).toBe('Question 2 / 2');
    expect(a.view.getByTestId('mock-speaking-answer').props.value).toBe('');
    a.view.unmount();
    const b = show(holiday, { start: { choice: 'a' } });
    expect(b.view.getByTestId('mock-speaking-sheet')).toBeTruthy();
    b.view.unmount();
    const c = show(holiday);
    expect(c.view.getByTestId('mock-speaking-choice-a')).toBeTruthy();
  });
});
