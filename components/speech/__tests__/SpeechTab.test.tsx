// The Speak tab (components/speech/*, lib/speech/stories.ts): list, intro, the story (typed and by voice), the end. The speech
// recognizer is the stand-in of jest.setup.js (its listeners are fired with __emit); the read-aloud is mocked like in the other
// Practice tests, so nothing plays. The clock is fake: a right answer brings the next line after motion.feedback.

jest.mock('@/lib/speech', () => ({ ...require('@/test-utils/mocks').speechMock(), stop: jest.fn() }));
// useFocusEffect whose focus can be taken away and given back (__blur / __focus): the screen stays mounted, as a tab does
jest.mock('expo-router', () => {
  const React = require('react');
  const effects = new Set<{ run: () => void | (() => void); stop?: void | (() => void) }>();
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const effect: { run: () => void | (() => void); stop?: void | (() => void) } = { run: callback };
        effects.add(effect);
        effect.stop = callback();
        return () => {
          effect.stop?.();
          effects.delete(effect);
        };
      }, []);
    },
    __blur: () =>
      effects.forEach((e) => {
        e.stop?.();
        e.stop = undefined;
      }),
    __focus: () =>
      effects.forEach((e) => {
        if (!e.stop) e.stop = e.run();
      }),
  };
});
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
jest.mock('@/lib/knownSentence', () => {
  const actual = jest.requireActual('@/lib/knownSentence');
  return { ...actual, knownTokens: jest.fn(actual.knownTokens) };
});

import { act, fireEvent, render, within } from '@testing-library/react-native';
import { DeviceEventEmitter, Dimensions, StyleSheet } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import SpeechTab from '@/components/speech/SpeechTab';
import { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { motion } from '@/constants/Theme';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
import { knownTokens } from '@/lib/knownSentence';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { MIN_UPPER, upperFooterMax } from '@/lib/speech/layout';
import { speak, stopSpeaking } from '@/lib/speech';
import {
  SPEECH_ANSWER_KEY,
  SPEECH_LEVEL_KEY,
  SPEECH_MODE,
  SPEECH_PROGRESS_KEY,
  STORIES,
  answerTurn,
  savedRun,
  startStory,
  unknownWords,
  type AnswerMode,
  type StoryRun,
} from '@/lib/speech/stories';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const { __emit } = require('expo-speech-recognition') as { __emit: (name: string, payload?: unknown) => void };
const { __blur, __focus } = require('expo-router') as { __blur: () => void; __focus: () => void };
const WINDOW = Dimensions.get('window');
const mockSpeak = speak as jest.Mock;
const mockStopSpeaking = stopSpeaking as jest.Mock;
const mockKnownTokens = knownTokens as jest.Mock;
const flush = makeFlush(20);

const story = STORIES[0];
const total = story.turns.length;
const sx = t().speechTab;
// a run on the given turn: every earlier turn answered right at the first try
const at = (turn: number, mode: AnswerMode = 'type', patch: Partial<StoryRun> = {}): StoryRun => {
  let run = startStory(story, mode);
  for (let i = 0; i < turn; i++) run = answerTurn(run, story, { right: true, text: `answer ${i}` });
  return { ...run, ...patch };
};
const saveRun = (run: StoryRun) => saveResumeValue(getDb(), SPEECH_MODE, savedRun(run));
const savedNow = async () => (await loadResumeValue(getDb(), SPEECH_MODE)) as StoryRun | null;
const rows = () => getDb().getGameProgress(SPEECH_PROGRESS_KEY);

const mount = async () => {
  const view = render(<ThemeProvider><SpeechTab /></ThemeProvider>);
  await flush();
  return view;
};
type View = Awaited<ReturnType<typeof mount>>;
const press = async (view: View, testID: string) => {
  fireEvent.press(view.getByTestId(testID));
  await flush();
};
// time passes, the timers fire
const advance = async (ms: number = motion.feedback) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};
const type = async (view: View, text: string) => {
  fireEvent.changeText(view.getByTestId('speech-type-input'), text);
  await press(view, 'speech-check');
};
const emit = async (name: string, payload?: unknown) => {
  await act(async () => __emit(name, payload));
  await flush();
};
const heardFinal = (transcript: string) => emit('result', { isFinal: true, results: [{ transcript, confidence: 1 }] });
const feedbackButton = (view: View) => view.getByLabelText(t().feedback.button);
const text = (view: View, testID: string) => view.getByTestId(testID).props.children;

beforeEach(async () => {
  jest.useFakeTimers();
  mockSpeak.mockClear();
  mockStopSpeaking.mockClear();
  mockKnownTokens.mockReset();
  mockKnownTokens.mockImplementation(jest.requireActual('@/lib/knownSentence').knownTokens);
  (ExpoSpeechRecognitionModule.start as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(true);
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await getDb().setStrictAccents(false);
  await getDb().resetGameProgress(SPEECH_PROGRESS_KEY);
  for (const key of [SPEECH_MODE, SPEECH_LEVEL_KEY, SPEECH_ANSWER_KEY]) await saveResumeValue(getDb(), key, null);
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage('en');
  Dimensions.set({ window: WINDOW });
});

describe('Speak tab: the list', () => {
  it('the level row and the story of the level; an empty level says so; the level is kept', async () => {
    const view = await mount();
    expect(view.getByTestId('speech-screen')).toBeTruthy();
    expect(feedbackButton(view)).toBeTruthy();
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) expect(view.getByTestId(`speech-level-${level}`)).toBeTruthy();
    expect(view.getByText('Introductions')).toBeTruthy();
    expect(view.getByText('The new neighbor')).toBeTruthy();
    expect(view.queryByTestId('speech-empty-level')).toBeNull();
    await press(view, 'speech-level-B1');
    expect(view.getByTestId('speech-empty-level').props.children).toBe('No stories at this level yet.');
    expect(view.queryByTestId(`speech-story-${story.id}`)).toBeNull();
    expect(await loadResumeValue(getDb(), SPEECH_LEVEL_KEY)).toBe('B1');
    view.unmount();
    // the next visit opens on the chosen level
    const again = await mount();
    expect(again.getByTestId('speech-empty-level')).toBeTruthy();
    again.unmount();
  });

  it('Hungarian: the texts of the story are Hungarian', async () => {
    setLanguage('hu');
    await getDb().setOnboarding('hu', 'es');
    const view = await mount();
    expect(view.getByText('Bemutatkozás')).toBeTruthy();
    expect(view.getByText('Az új szomszéd')).toBeTruthy();
    view.unmount();
  });

  it('a direction without stories: one muted line and no level row', async () => {
    await getDb().setOnboarding('es', 'en');
    const view = await mount();
    expect(view.getByTestId('speech-empty-language').props.children).toBe('Stories for this language are coming.');
    expect(view.queryByTestId('speech-levels')).toBeNull();
    expect(feedbackButton(view)).toBeTruthy();
    view.unmount();
  });

  it('a finished story shows the tick and best/total', async () => {
    await getDb().setGameProgress(SPEECH_PROGRESS_KEY, story.id, 'done', { best: 4, total, at: '2026-11-03' });
    const view = await mount();
    expect(view.getByTestId(`speech-story-best-${story.id}`).props.children).toBe(`✓ 4/${total}`);
    expect(view.queryByTestId(`speech-story-continue-${story.id}`)).toBeNull();
    view.unmount();
  });
});

describe('Speak tab: the intro', () => {
  it('the teaser, the intro text and the new words with a speaker each; the feedback button is there', async () => {
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    expect(feedbackButton(view)).toBeTruthy();
    expect(view.getByText('The new neighbor')).toBeTruthy();
    expect(text(view, 'speech-intro-text')).toBe(story.intro.en);
    const words = unknownWords(story, knownTokens('es', { learned: [] }) as Set<string>);
    expect(words.length).toBeGreaterThan(0);
    expect(view.getByTestId('speech-words').props.children).toBe('New words in this story');
    expect(view.getByText('neighbor (woman)')).toBeTruthy();
    expect(view.getByTestId(`speech-word-${words.length - 1}`)).toBeTruthy();
    expect(view.queryByTestId(`speech-word-${words.length}`)).toBeNull();
    fireEvent.press(view.getByTestId('speech-word-speak-0'));
    expect(mockSpeak).toHaveBeenCalledWith(words[0].es, 'es-MX');
    view.unmount();
  });

  it('no new word: no word box', async () => {
    mockKnownTokens.mockReturnValue(new Set(story.words.flatMap((w) => w.forms.map((f) => f.toLowerCase()))));
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    expect(view.getByTestId('speech-intro-text')).toBeTruthy();
    expect(view.queryByTestId('speech-words')).toBeNull();
    view.unmount();
  });

  it('by voice is chosen at first; the choice is kept, and the back link goes to the list', async () => {
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    expect(view.getByTestId('speech-mode-voice').props.accessibilityState).toMatchObject({ selected: true });
    await press(view, 'speech-mode-type');
    expect(view.getByTestId('speech-mode-type').props.accessibilityState).toMatchObject({ selected: true });
    expect(await loadResumeValue(getDb(), SPEECH_ANSWER_KEY)).toBe('type');
    await press(view, 'speech-back');
    expect(view.getByTestId(`speech-story-${story.id}`)).toBeTruthy();
    view.unmount();
    // the next visit starts with typing
    const again = await mount();
    await press(again, `speech-story-${story.id}`);
    expect(again.getByTestId('speech-mode-type').props.accessibilityState).toMatchObject({ selected: true });
    again.unmount();
  });

  it('no speech recognizer: the voice segment is off, typing is selected and the story starts in typing', async () => {
    (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(false);
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    expect(view.getByTestId('speech-mode-voice').props.accessibilityState).toMatchObject({ disabled: true, selected: false });
    expect(view.getByTestId('speech-mode-type').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByTestId('speech-no-mic').props.children).toBe(sx.noMic);
    await press(view, 'speech-start');
    expect(view.getByTestId('speech-type-input')).toBeTruthy();
    expect(view.queryByTestId('speech-mic')).toBeNull();
    expect(view.queryByTestId('speech-mode-toggle')).toBeNull();
    expect((await savedNow())?.mode).toBe('type');
    view.unmount();
  });

  it('Start begins the run, saves it and reads the first line aloud', async () => {
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    await press(view, 'speech-start');
    expect(view.getByTestId('speech-line-0').props.children).toBe(story.turns[0].es);
    expect(mockSpeak).toHaveBeenCalledWith(story.turns[0].es, 'es-MX');
    expect(await savedNow()).toMatchObject({ id: story.id, mode: 'voice', turn: 0, done: false });
    expect(feedbackButton(view)).toBeTruthy();
    view.unmount();
  });
});

describe('Speak tab: the story, typed', () => {
  it('a right answer shows its bubble at once and the next line comes by itself and is read aloud', async () => {
    await saveRun(at(0));
    const view = await mount();
    expect(view.getByTestId('speech-narration').props.children).toBe(story.intro.en);
    expect(text(view, 'speech-ask')).toBe('Say your name.');
    await type(view, 'me llamo Kálmán');
    expect(text(view, 'speech-answer-0')).toBe('Me llamo Kálmán');
    expect(text(view, 'speech-answer-who-0')).toBe('You ✓');
    expect(view.queryByTestId('speech-line-1')).toBeNull();
    expect(view.queryByTestId('speech-result')).toBeNull();
    mockSpeak.mockClear();
    await advance();
    expect(text(view, 'speech-line-1')).toBe(story.turns[1].es);
    expect(text(view, 'speech-ask')).toBe('Say where you are from.');
    expect(mockSpeak).toHaveBeenCalledWith(story.turns[1].es, 'es-MX');
    expect(await savedNow()).toMatchObject({ turn: 1, tries: 0, firstTry: 1 });
    // the typing field is empty for the next turn
    expect(view.getByTestId('speech-type-input').props.value).toBe('');
    view.unmount();
  });

  it('a name of several words is right; the free slot takes it', async () => {
    await saveRun(at(0));
    const view = await mount();
    await type(view, 'Hola, me llamo Juan Pablo');
    expect(text(view, 'speech-answer-0')).toBe('Hola, me llamo Juan Pablo');
    expect(await savedNow()).toMatchObject({ turn: 1, firstTry: 1 });
    view.unmount();
  });

  it('a wrong answer shows what was written and the red word; the try is counted; the next turn does not come', async () => {
    await saveRun(at(1));
    const view = await mount();
    await type(view, 'soy Hungría');
    expect(view.getByTestId('speech-result')).toBeTruthy();
    expect(text(view, 'speech-heard')).toBe(sx.wrote('soy Hungría'));
    const wrong = view.getAllByTestId('speech-said-wrong');
    expect(wrong).toHaveLength(1);
    expect(wrong[0].props.children).toBe('de');
    expect(view.getAllByTestId('speech-said-right').map((n) => n.props.children)).toEqual(['Soy', 'Hungría']);
    expect(view.getByText(sx.missingWord)).toBeTruthy();
    expect(view.queryByTestId('speech-answer-1')).toBeNull();
    expect(view.queryByTestId('speech-skip')).toBeNull();
    expect(view.queryByTestId('speech-hint')).toBeNull();
    await advance(1000);
    expect(view.queryByTestId('speech-line-2')).toBeNull();
    expect(await savedNow()).toMatchObject({ turn: 1, tries: 1 });
    // the right answer takes the box away
    await type(view, 'soy de Hungría');
    expect(view.queryByTestId('speech-result')).toBeNull();
    expect(await savedNow()).toMatchObject({ turn: 2, tries: 0, firstTry: 1 });
    view.unmount();
  });

  it('after two wrong answers the model and Next appear; Next gives the turn up and the story goes on', async () => {
    await saveRun(at(0));
    const view = await mount();
    await type(view, 'hola');
    await type(view, 'adiós');
    expect(text(view, 'speech-hint')).toBe('💡 Me llamo ___.');
    await press(view, 'speech-skip');
    expect(text(view, 'speech-answer-0')).toBe('Me llamo ___.');
    expect(text(view, 'speech-answer-who-0')).toBe('You (model)');
    expect(view.queryByTestId('speech-skip')).toBeNull();
    await advance();
    expect(text(view, 'speech-line-1')).toBe(story.turns[1].es);
    expect(await savedNow()).toMatchObject({ turn: 1, tries: 0, firstTry: 0, answers: [{ ok: false }] });
    view.unmount();
  });

  it('Help shows the model at once, on this turn only', async () => {
    await saveRun(at(0));
    const view = await mount();
    expect(view.queryByTestId('speech-hint')).toBeNull();
    await press(view, 'speech-help');
    expect(text(view, 'speech-hint')).toBe('💡 Me llamo ___.');
    expect(view.queryByTestId('speech-help')).toBeNull();
    await type(view, 'soy Ana');
    await advance();
    expect(view.queryByTestId('speech-hint')).toBeNull();
    expect(view.getByTestId('speech-help')).toBeTruthy();
    view.unmount();
  });

  it('the F button shows the translation in the learner\'s language and hides it again', async () => {
    await saveRun(at(0));
    const view = await mount();
    expect(view.queryByTestId('speech-translation-0')).toBeNull();
    await press(view, 'speech-translate-0');
    expect(text(view, 'speech-translation-0')).toBe(story.turns[0].en);
    await press(view, 'speech-translate-0');
    expect(view.queryByTestId('speech-translation-0')).toBeNull();
    fireEvent.press(view.getByTestId('speech-listen-0'));
    expect(mockSpeak).toHaveBeenCalledWith(story.turns[0].es, 'es-MX');
    view.unmount();
  });

  it('a number is any number; the accents count only when the setting says so (typed)', async () => {
    await saveRun(at(2));
    const view = await mount();
    await type(view, 'tengo 35 años');
    expect(await savedNow()).toMatchObject({ turn: 3, firstTry: 3 });
    view.unmount();
    await getDb().setStrictAccents(true);
    await saveRun(at(2));
    const strict = await mount();
    await type(strict, 'tengo treinta anos');
    expect(await savedNow()).toMatchObject({ turn: 2, tries: 1 });
    expect(strict.getAllByTestId('speech-said-wrong').map((n) => n.props.children)).toEqual(['años']);
    await type(strict, 'tengo treinta años');
    expect(await savedNow()).toMatchObject({ turn: 3 });
    strict.unmount();
  });

  it('the last answer leads to the end screen: score, the progress row, the saved run dropped', async () => {
    await saveRun(at(total - 1));
    const view = await mount();
    expect(text(view, 'speech-ask')).toBe('Say thank you and goodbye.');
    await type(view, 'gracias, adiós');
    expect(text(view, 'speech-answer-5')).toBe('Gracias, adiós');
    expect(view.queryByTestId('speech-done')).toBeNull();
    await advance();
    expect(text(view, 'speech-done')).toBe('Done');
    expect(text(view, 'speech-score')).toBe(`${total}/${total}`);
    expect(view.getByText(story.outro.en)).toBeTruthy();
    expect(feedbackButton(view)).toBeTruthy();
    expect(await rows()).toEqual([{ itemId: story.id, state: 'done', data: { best: total, total, at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } }]);
    expect(await savedNow()).toBeNull();
    view.unmount();
  });

  it('the progress row keeps the best score; Again starts a new run, Back to the stories shows the tick', async () => {
    await getDb().setGameProgress(SPEECH_PROGRESS_KEY, story.id, 'done', { best: 6, total, at: '2026-11-01' });
    await saveRun(at(total - 1, 'type', { firstTry: 1 }));
    const view = await mount();
    await type(view, 'gracias, adiós');
    await advance();
    expect(text(view, 'speech-score')).toBe(`2/${total}`);
    expect((await rows())[0].data).toMatchObject({ best: 6, total });
    mockSpeak.mockClear();
    await press(view, 'speech-again');
    expect(text(view, 'speech-line-0')).toBe(story.turns[0].es);
    expect(view.queryByTestId('speech-line-1')).toBeNull();
    expect(mockSpeak).toHaveBeenCalledWith(story.turns[0].es, 'es-MX');
    expect(await savedNow()).toMatchObject({ turn: 0, firstTry: 0, answers: [], mode: 'type' });
    await press(view, 'speech-back');
    expect(view.getByTestId(`speech-story-continue-${story.id}`)).toBeTruthy();
    view.unmount();
  });

  it('Back to the stories from the end screen', async () => {
    await saveRun(at(total - 1));
    const view = await mount();
    await type(view, 'gracias, hasta luego');
    await advance();
    await press(view, 'speech-to-list');
    expect(view.getByTestId(`speech-story-best-${story.id}`).props.children).toBe(`✓ ${total}/${total}`);
    expect(view.queryByTestId(`speech-story-continue-${story.id}`)).toBeNull();
    view.unmount();
  });
});

describe('Speak tab: leaving and coming back', () => {
  it('a resumed run opens on its turn, with the earlier lines and answers, and reads nothing aloud', async () => {
    await saveRun(at(2));
    const view = await mount();
    expect(view.queryByTestId('speech-levels')).toBeNull();
    for (let n = 0; n <= 2; n++) expect(text(view, `speech-line-${n}`)).toBe(story.turns[n].es);
    expect(view.queryByTestId('speech-line-3')).toBeNull();
    expect(text(view, 'speech-answer-0')).toBe('Answer 0');
    expect(text(view, 'speech-answer-1')).toBe('Answer 1');
    expect(view.queryByTestId('speech-answer-2')).toBeNull();
    expect(text(view, 'speech-ask')).toBe('Say how old you are.');
    expect(mockSpeak).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('speech-listen-2'));
    expect(mockSpeak).toHaveBeenCalledWith(story.turns[2].es, 'es-MX');
    expect(feedbackButton(view)).toBeTruthy();
    view.unmount();
  });

  it('the back link keeps the run: the list says Continue and the card goes straight back into the story', async () => {
    await saveRun(at(3));
    const view = await mount();
    await press(view, 'speech-back');
    expect(view.getByTestId(`speech-story-continue-${story.id}`).props.children).toBe('Continue');
    expect(await savedNow()).toMatchObject({ turn: 3 });
    await press(view, `speech-story-${story.id}`);
    expect(text(view, 'speech-line-3')).toBe(story.turns[3].es);
    expect(view.queryByTestId('speech-start')).toBeNull();
    view.unmount();
  });

  it('a run of a story that is gone is dropped: the list opens', async () => {
    await saveResumeValue(getDb(), SPEECH_MODE, { ...(savedRun(at(2)) as object), id: 'gone' });
    const view = await mount();
    expect(view.getByTestId('speech-levels')).toBeTruthy();
    view.unmount();
  });

  it('an app killed after the last answer: the end screen writes the progress when the tab opens', async () => {
    await saveRun(at(total, 'type'));
    const view = await mount();
    expect(text(view, 'speech-score')).toBe(`${total}/${total}`);
    expect((await rows())[0]).toMatchObject({ itemId: story.id, state: 'done' });
    expect(await savedNow()).toBeNull();
    view.unmount();
  });

  it('leaving the tab stops the read-aloud and the microphone', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await emit('start');
    (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
    mockStopSpeaking.mockClear();
    view.unmount();
    expect(mockStopSpeaking).toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
  });
});

describe('Speak tab: by voice', () => {
  it('the mic starts the recognizer in the target language after stopping the read-aloud; a result is judged and moves the story on', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    expect(view.queryByTestId('speech-type-input')).toBeNull();
    expect(view.getByText(sx.pressToSpeak)).toBeTruthy();
    mockStopSpeaking.mockClear();
    await press(view, 'speech-mic');
    expect(mockStopSpeaking).toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'es-MX', continuous: false }));
    await emit('start');
    expect(view.getByText(sx.listening)).toBeTruthy();
    await heardFinal('soy de Hungría');
    expect(text(view, 'speech-answer-1')).toBe('Soy de Hungría');
    await advance();
    expect(text(view, 'speech-line-2')).toBe(story.turns[2].es);
    view.unmount();
  });

  it('a wrong result shows "I heard" and the red word; the recognizer writes no accents, so strict accents do not apply', async () => {
    await getDb().setStrictAccents(true);
    await saveRun(at(2, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await heardFinal('treinta años');
    expect(text(view, 'speech-heard')).toBe(sx.heard('treinta años'));
    expect(view.getAllByTestId('speech-said-wrong').map((n) => n.props.children)).toEqual(['Tengo']);
    await press(view, 'speech-mic');
    await heardFinal('tengo treinta anos');
    expect(await savedNow()).toMatchObject({ turn: 3, firstTry: 2 });
    view.unmount();
  });

  it('nothing heard says so; a denied microphone switches to typing', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await emit('error', { error: 'no-speech' });
    expect(view.getByTestId('speech-mic-error').props.children).toBe(sx.micMiss);
    await press(view, 'speech-mic');
    await emit('error', { error: 'network' });
    expect(view.getByTestId('speech-mic-error').props.children).toBe(sx.micRetry);
    await press(view, 'speech-mic');
    await emit('error', { error: 'not-allowed' });
    expect(view.getByTestId('speech-mic-error').props.children).toBe(sx.micOff);
    expect(view.getByTestId('speech-type-input')).toBeTruthy();
    expect(view.queryByTestId('speech-mic')).toBeNull();
    view.unmount();
  });

  it('"Type instead" switches the run to typing and closes a running recognizer: its late result lands nowhere', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await emit('start');
    (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
    await press(view, 'speech-mode-toggle');
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    expect(view.getByTestId('speech-type-input')).toBeTruthy();
    expect(await savedNow()).toMatchObject({ mode: 'type', turn: 1 });
    expect(await loadResumeValue(getDb(), SPEECH_ANSWER_KEY)).toBe('type');
    await heardFinal('soy de Hungría');
    expect(await savedNow()).toMatchObject({ turn: 1, tries: 0 });
    // and back
    await press(view, 'speech-mode-toggle');
    expect(view.getByTestId('speech-mic')).toBeTruthy();
    expect((await savedNow())?.mode).toBe('voice');
    view.unmount();
  });

  it('a turn change closes the microphone: after a right answer the recognizer is aborted, and a stray result lands nowhere', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await emit('start');
    (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
    await heardFinal('soy de Hungría');
    // nothing else closed it (a voice result does not): the turn change did
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    await advance();
    // the next turn is on screen; a stray result of the old listening is not accepted
    await heardFinal('tengo treinta años');
    expect(await savedNow()).toMatchObject({ turn: 2, tries: 0 });
    expect(within(view.getByTestId('speech-screen')).queryByTestId('speech-answer-2')).toBeNull();
    view.unmount();
  });
});

describe('Speak tab: the strings', () => {
  it.each(['en', 'es', 'hu', 'de'] as const)('%s: the strings of the Speak tab are all filled in', (lang) => {
    setLanguage(lang);
    const strings = t().speechTab;
    for (const [key, value] of Object.entries(strings)) {
      const shown = typeof value === 'function' ? (value as (...a: never[]) => string)(...([1, 6, 'x'] as never[])) : value;
      expect([key, String(shown).trim() === '']).toEqual([key, false]);
    }
    expect(t().tabs.speak.trim()).not.toBe('');
  });
});

describe('Speak tab: the microphone and the screen', () => {
  it('the 🔊 on a bubble closes the microphone first: the phone does not hear itself', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await emit('start');
    (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
    fireEvent.press(view.getByTestId('speech-listen-0'));
    await flush();
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledWith(story.turns[0].es, 'es-MX');
    // what the microphone heard of the read-aloud is not an answer, and costs no try
    await heardFinal(story.turns[0].es);
    expect(await savedNow()).toMatchObject({ turn: 1, tries: 0 });
    view.unmount();
  });

  it('losing focus (the tab stays mounted) stops the read-aloud and the microphone; getting it back keeps the screen', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await emit('start');
    (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
    mockStopSpeaking.mockClear();
    await act(async () => {
      __blur();
    });
    expect(mockStopSpeaking).toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    expect(view.getByTestId('speech-screen')).toBeTruthy();
    await act(async () => {
      __focus();
    });
    await flush();
    expect(text(view, 'speech-line-1')).toBe(story.turns[1].es);
    view.unmount();
  });

  it('after a denied microphone the link says "Say it instead": voice can be tried again in the same run', async () => {
    await saveRun(at(1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await emit('error', { error: 'not-allowed' });
    expect(view.getByTestId('speech-type-input')).toBeTruthy();
    expect(view.getByText(sx.sayInstead)).toBeTruthy();
    await press(view, 'speech-mode-toggle');
    expect(view.getByTestId('speech-mic')).toBeTruthy();
    expect(view.queryByTestId('speech-type-input')).toBeNull();
    (ExpoSpeechRecognitionModule.start as jest.Mock).mockClear();
    await press(view, 'speech-mic');
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled();
    view.unmount();
  });
});

describe('Speak tab: the end of the story', () => {
  it('Back right after the last answer loses nothing: the score is written at once, the list shows the tick, the story can be started again', async () => {
    await saveRun(at(total - 1));
    const view = await mount();
    await type(view, 'gracias, adiós');
    // before motion.feedback is over: the end screen has not been reached
    await press(view, 'speech-back');
    expect(await rows()).toEqual([{ itemId: story.id, state: 'done', data: { best: total, total, at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } }]);
    expect(await savedNow()).toBeNull();
    expect(view.getByTestId(`speech-story-best-${story.id}`).props.children).toBe(`✓ ${total}/${total}`);
    expect(view.queryByTestId(`speech-story-continue-${story.id}`)).toBeNull();
    await advance(1000);
    expect(view.queryByTestId('speech-done')).toBeNull();
    // started again: a fresh run, the score stays
    await press(view, `speech-story-${story.id}`);
    await press(view, 'speech-start');
    expect(await savedNow()).toMatchObject({ turn: 0, firstTry: 0 });
    expect((await rows())[0].data).toMatchObject({ best: total });
    view.unmount();
  });

  it('a database that throws on the progress row still brings the end screen', async () => {
    await saveRun(at(total - 1));
    const original = getDb().setGameProgress.bind(getDb());
    // only the progress row fails (the resume store writes through the same table)
    const write = jest.spyOn(getDb(), 'setGameProgress').mockImplementation((game, ...rest) => (game === SPEECH_PROGRESS_KEY ? Promise.reject(new Error('disk full')) : original(game, ...rest)));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const view = await mount();
      await type(view, 'gracias, adiós');
      await advance();
      expect(text(view, 'speech-done')).toBe('Done');
      expect(text(view, 'speech-score')).toBe(`${total}/${total}`);
      expect(warn).toHaveBeenCalled();
      expect(await savedNow()).toBeNull();
      view.unmount();
    } finally {
      write.mockRestore();
      warn.mockRestore();
    }
  });
});

describe('Speak tab: the language pair', () => {
  it('another pair of the same target reloads the run, the level and the progress; coming back restores the first', async () => {
    await saveRun(at(2));
    await saveResumeValue(getDb(), SPEECH_LEVEL_KEY, 'A1');
    await getDb().setGameProgress(SPEECH_PROGRESS_KEY, story.id, 'done', { best: 5, total, at: '2026-11-03' });
    const view = await mount();
    expect(text(view, 'speech-line-2')).toBe(story.turns[2].es);
    // hu -> es: nothing was saved there
    await getDb().setOnboarding('hu', 'es');
    await act(async () => {
      __blur();
    });
    await act(async () => {
      __focus();
    });
    await flush();
    expect(view.getByTestId('speech-levels')).toBeTruthy();
    expect(view.getByText('Bemutatkozás')).toBeTruthy();
    expect(view.queryByTestId(`speech-story-continue-${story.id}`)).toBeNull();
    expect(view.queryByTestId(`speech-story-best-${story.id}`)).toBeNull();
    // back to en -> es: its run is there again
    await getDb().setOnboarding('en', 'es');
    await act(async () => {
      __blur();
    });
    await act(async () => {
      __focus();
    });
    await flush();
    expect(text(view, 'speech-line-2')).toBe(story.turns[2].es);
    view.unmount();
  });
});

describe('Speak tab: the docked footer', () => {
  const scrollMax = (view: View) => StyleSheet.flatten(view.getByTestId('speech-footer-scroll').props.style).maxHeight as number;

  it('what was heard, the ask and the hint scroll; the input, Check, Next and the links are fixed', async () => {
    Dimensions.set({ window: { width: 360, height: 640, scale: 1, fontScale: 1 } });
    await saveRun(at(1));
    const view = await mount();
    await type(view, 'soy Hungría');
    await type(view, 'soy Hungría');
    const scroll = view.getByTestId('speech-footer-scroll');
    const fixed = view.getByTestId('speech-footer-fixed');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    for (const id of ['speech-result', 'speech-ask', 'speech-hint']) expect(within(scroll).getByTestId(id)).toBeTruthy();
    for (const id of ['speech-type-input', 'speech-check', 'speech-skip', 'speech-mode-toggle']) {
      expect(within(fixed).getByTestId(id)).toBeTruthy();
      expect(within(scroll).queryByTestId(id)).toBeNull();
    }
    expect(scrollMax(view)).toBe(upperFooterMax({ windowH: 640, lift: 0, kbHeight: 0, fixedH: DOCK_RESERVE, voice: false }));
    view.unmount();
  });

  it('an open keyboard gives the upper part less room, never less than the minimum; the input stays in the fixed part', async () => {
    Dimensions.set({ window: { width: 360, height: 640, scale: 1, fontScale: 1 } });
    await saveRun(at(1));
    const view = await mount();
    const closed = scrollMax(view);
    await act(async () => {
      DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } });
    });
    const open = scrollMax(view);
    expect(open).toBeLessThan(closed);
    expect(open).toBeGreaterThanOrEqual(MIN_UPPER);
    expect(open).toBe(upperFooterMax({ windowH: 640, lift: 300, kbHeight: 300, fixedH: DOCK_RESERVE, voice: false }));
    expect(within(view.getByTestId('speech-footer-fixed')).getByTestId('speech-type-input')).toBeTruthy();
    view.unmount();
  });

  it('by voice the mic is in the fixed part and the chat keeps room', async () => {
    Dimensions.set({ window: { width: 360, height: 640, scale: 1, fontScale: 1 } });
    await saveRun(at(1, 'voice'));
    const view = await mount();
    expect(within(view.getByTestId('speech-footer-fixed')).getByTestId('speech-mic')).toBeTruthy();
    expect(within(view.getByTestId('speech-footer-scroll')).queryByTestId('speech-mic')).toBeNull();
    expect(scrollMax(view)).toBe(upperFooterMax({ windowH: 640, lift: 0, kbHeight: 0, fixedH: DOCK_RESERVE, voice: true }));
    view.unmount();
  });
});
