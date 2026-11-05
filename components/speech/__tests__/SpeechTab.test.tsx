// The Speak tab (components/speech/*, lib/speech/stories.ts): list, intro, preparation, the story (typed and by voice), the end. The speech
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
import { BackHandler, DeviceEventEmitter, Dimensions, Keyboard, ScrollView, StyleSheet } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import SpeechTab from '@/components/speech/SpeechTab';
import { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { motion } from '@/constants/Theme';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
import { knownTokens } from '@/lib/knownSentence';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { FOOTER_PAD, TOP_ROW, upperFooterMax } from '@/lib/speech/layout';
import { pairOf } from '@/lib/languagePair';
import { speak, stopSpeaking } from '@/lib/speech';
import {
  speechAnswerKey,
  SPEECH_ANSWER_KEY,
  SPEECH_LEVEL_KEY,
  SPEECH_MODE,
  SPEECH_PROGRESS_KEY,
  STORIES,
  answerTurn,
  bubbleOf,
  judgeAnswer,
  savedRun,
  splitBubble,
  startStory,
  turnById,
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
// the jest ScrollView keeps its methods on the class: one jest.fn for every scroller
const scrollToEnd = ScrollView.prototype.scrollToEnd as unknown as jest.Mock;
// the hardware Back: handlers are kept the way Android calls them (the last registered first, until one consumes the press)
const backHandlers: (() => boolean | null | undefined)[] = [];
const pressBack = async () => {
  let consumed = false;
  await act(async () => {
    for (const handler of [...backHandlers].reverse()) {
      if (handler()) {
        consumed = true;
        break;
      }
    }
  });
  await flush();
  return consumed;
};
const mockSpeak = speak as jest.Mock;
const mockStopSpeaking = stopSpeaking as jest.Mock;
const mockKnownTokens = knownTokens as jest.Mock;
const flush = makeFlush(20);
// where the way of answering is kept: per language pair
const ANSWER_KEY = speechAnswerKey(pairOf('es'));

const story = STORIES[0];
// the first branch everywhere: the talk, then the two questions about her
const WAY = ['name', 'from', 'age', 'family1', 'family2', 'work', 'study', 'speak', 'learn', 'learn2', 'bye', 'recall1', 'recall2'];
const total = WAY.length;
const WORK = WAY.indexOf('work');
const SPEAK = WAY.indexOf('speak');
const BYE = WAY.indexOf('bye');
// the answer to the last question of the story (about her), with and without the accent of its second group
const LAST = 'es de Oaxaca';
const sx = t().speechTab;
// a run on the given turn: every earlier turn answered right at the first try
const at = (turn: number, mode: AnswerMode = 'type', patch: Partial<StoryRun> = {}): StoryRun => {
  let run = startStory(story, mode);
  for (let i = 0; i < turn; i++) run = answerTurn(run, story, { branch: 0, text: `answer ${i}` });
  return { ...run, ...patch };
};
// the text of bubble n of a run that is on the n-th turn of the first way: her reaction to the answer before, then the line
const lineText = (n: number, lang: 'es' | 'en' = 'es') => splitBubble(story, at(n), n, lang).line;
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
// the intro's button leads to the preparation, its Start to the story
const startFromIntro = async (view: View) => {
  await press(view, 'speech-get-ready');
  await press(view, 'speech-start');
};
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
  scrollToEnd.mockClear();
  backHandlers.length = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler);
    return { remove: () => void backHandlers.splice(backHandlers.indexOf(handler), 1) };
  });
  mockKnownTokens.mockReset();
  mockKnownTokens.mockImplementation(jest.requireActual('@/lib/knownSentence').knownTokens);
  (ExpoSpeechRecognitionModule.start as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(true);
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await getDb().setStrictAccents(false);
  await getDb().resetGameProgress(SPEECH_PROGRESS_KEY);
  for (const key of [SPEECH_MODE, SPEECH_LEVEL_KEY, SPEECH_ANSWER_KEY, ANSWER_KEY]) await saveResumeValue(getDb(), key, null);
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage('en');
  Dimensions.set({ window: WINDOW });
  (BackHandler.addEventListener as jest.Mock).mockRestore();
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
    expect(await loadResumeValue(getDb(), ANSWER_KEY)).toBe('type');
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
    await startFromIntro(view);
    expect(view.getByTestId('speech-type-input')).toBeTruthy();
    expect(view.queryByTestId('speech-mic')).toBeNull();
    expect(view.queryByTestId('speech-mode-toggle')).toBeNull();
    expect((await savedNow())?.mode).toBe('type');
    view.unmount();
  });

  it('Start begins the run, saves it and reads the first line aloud', async () => {
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    await startFromIntro(view);
    expect(view.getByTestId('speech-line-0').props.children).toBe(lineText(0));
    expect(mockSpeak).toHaveBeenCalledWith(lineText(0), 'es-MX');
    expect(await savedNow()).toMatchObject({ id: story.id, mode: 'voice', path: WAY.slice(0, 1), done: false });
    expect(feedbackButton(view)).toBeTruthy();
    view.unmount();
  });
});

describe('Speak tab: the story, typed', () => {
  it('a right answer shows its bubble at once and the next line comes by itself and is read aloud', async () => {
    await saveRun(at(0));
    const view = await mount();
    expect(view.getByTestId('speech-narration').props.children).toBe(story.intro.en);
    expect(text(view, 'speech-ask')).toBe(sx.ask(story.speaker));
    await type(view, 'me llamo Ana');
    expect(text(view, 'speech-answer-0')).toBe('Me llamo Ana');
    expect(text(view, 'speech-answer-who-0')).toBe('You ✓');
    expect(view.queryByTestId('speech-line-1')).toBeNull();
    expect(view.queryByTestId('speech-result')).toBeNull();
    mockSpeak.mockClear();
    await advance();
    expect(text(view, 'speech-line-1')).toBe(lineText(1));
    expect(text(view, 'speech-ask')).toBe(sx.ask(story.speaker));
    expect(mockSpeak).toHaveBeenCalledWith(lineText(1), 'es-MX');
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 2), tries: 0, firstTry: 1 });
    // the typing field is empty for the next turn
    expect(view.getByTestId('speech-type-input').props.value).toBe('');
    view.unmount();
  });

  it('a name of several words is right; the free slot takes it', async () => {
    await saveRun(at(0));
    const view = await mount();
    await type(view, 'Hola, me llamo Juan Pablo');
    expect(text(view, 'speech-answer-0')).toBe('Hola, me llamo Juan Pablo');
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 2), firstTry: 1 });
    view.unmount();
  });

  it('a wrong answer shows what was written and the red word; the try is counted; the next turn does not come', async () => {
    await saveRun(at(WORK));
    const view = await mount();
    await type(view, 'hola');
    expect(view.getByTestId('speech-result')).toBeTruthy();
    expect(text(view, 'speech-heard')).toBe(sx.wrote('hola'));
    // the red words come from the closest answer over all the branches of the turn
    const { match } = judgeAnswer(turnById(story, 'work')!, 'hola', { lang: 'es' });
    expect(match.right).toBe(false);
    expect(view.getAllByTestId('speech-said-wrong').map((n) => n.props.children)).toEqual(match.words.filter((w) => !w.right).map((w) => w.word));
    expect(view.getAllByTestId('speech-said-right').map((n) => n.props.children)).toEqual(match.words.filter((w) => w.right).map((w) => w.word));
    expect(view.getByText(sx.missingWord)).toBeTruthy();
    expect(view.queryByTestId(`speech-answer-${WORK}`)).toBeNull();
    expect(view.queryByTestId('speech-skip')).toBeNull();
    expect(view.queryByTestId('speech-hint')).toBeNull();
    await advance(1000);
    expect(view.queryByTestId(`speech-line-${WORK + 1}`)).toBeNull();
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, WORK + 1), tries: 1 });
    // the right answer takes the box away
    await type(view, 'no trabajo');
    expect(view.queryByTestId('speech-result')).toBeNull();
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, WORK + 2), tries: 0, firstTry: WORK });
    view.unmount();
  });

  it('after two wrong answers the lines and Next appear; Next gives the turn up and the story follows the main branch', async () => {
    await saveRun(at(WORK));
    const view = await mount();
    await type(view, 'hola');
    await type(view, 'adiós');
    expect(text(view, 'speech-hint-line-0-0')).toBe('No trabajo.');
    await press(view, 'speech-skip');
    expect(text(view, `speech-answer-${WORK}`)).toBe('Trabajo en una oficina.');
    expect(text(view, `speech-answer-who-${WORK}`)).toBe('You (model)');
    expect(view.queryByTestId('speech-skip')).toBeNull();
    await advance();
    // a given-up turn has no reaction of hers: the bubble is the next line only
    expect(text(view, `speech-line-${WORK + 1}`)).toBe(turnById(story, 'like')!.es);
    const saved = (await savedNow()) as StoryRun;
    expect(saved).toMatchObject({ path: [...WAY.slice(0, WORK + 1), 'like'], tries: 0, firstTry: WORK });
    expect(saved.answers[WORK]).toMatchObject({ ok: false, branch: 3 });
    view.unmount();
  });

  it('Help shows the model at once, on this turn only', async () => {
    await saveRun(at(0));
    const view = await mount();
    expect(view.queryByTestId('speech-hint')).toBeNull();
    await press(view, 'speech-help');
    expect(text(view, 'speech-hint-line-0-0')).toBe('Me llamo ___.');
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
    expect(text(view, 'speech-translation-0')).toBe(lineText(0, 'en'));
    await press(view, 'speech-translate-0');
    expect(view.queryByTestId('speech-translation-0')).toBeNull();
    fireEvent.press(view.getByTestId('speech-listen-0'));
    expect(mockSpeak).toHaveBeenCalledWith(lineText(0), 'es-MX');
    view.unmount();
  });

  it('a number is any number', async () => {
    await saveRun(at(2));
    const view = await mount();
    await type(view, 'tengo 35 años');
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 4), firstTry: 3 });
    view.unmount();
  });

  it('the accents count only when the setting says so (typed)', async () => {
    await saveRun(at(total - 1));
    const loose = await mount();
    await type(loose, 'es de mexico');
    await advance();
    expect(text(loose, 'speech-done')).toBe('Done');
    loose.unmount();
    await getDb().setStrictAccents(true);
    await saveRun(at(total - 1));
    const strict = await mount();
    await type(strict, 'es de mexico');
    expect(await savedNow()).toMatchObject({ path: WAY, tries: 1 });
    expect(strict.getAllByTestId('speech-said-wrong').length).toBeGreaterThan(0);
    await type(strict, 'es de méxico');
    await advance();
    expect(text(strict, 'speech-done')).toBe('Done');
    strict.unmount();
  });

  it('the last answer leads to the end screen: score, the progress row, the saved run dropped', async () => {
    await saveRun(at(total - 1));
    const view = await mount();
    expect(text(view, 'speech-ask')).toBe(sx.ask(story.speaker));
    await type(view, LAST);
    expect(text(view, `speech-answer-${total - 1}`)).toBe('Es de Oaxaca');
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
    await type(view, LAST);
    await advance();
    expect(text(view, 'speech-score')).toBe(`2/${total}`);
    expect((await rows())[0].data).toMatchObject({ best: 6, total });
    mockSpeak.mockClear();
    await press(view, 'speech-again');
    expect(text(view, 'speech-line-0')).toBe(lineText(0));
    expect(view.queryByTestId('speech-line-1')).toBeNull();
    expect(mockSpeak).toHaveBeenCalledWith(lineText(0), 'es-MX');
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 1), firstTry: 0, answers: [], mode: 'type' });
    await press(view, 'speech-back');
    expect(view.getByTestId(`speech-story-continue-${story.id}`)).toBeTruthy();
    view.unmount();
  });

  it('Back to the stories from the end screen', async () => {
    await saveRun(at(total - 1));
    const view = await mount();
    await type(view, LAST);
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
    for (let n = 0; n <= 2; n++) expect(text(view, `speech-line-${n}`)).toBe(lineText(n));
    expect(view.queryByTestId('speech-line-3')).toBeNull();
    expect(text(view, 'speech-answer-0')).toBe('Answer 0');
    expect(text(view, 'speech-answer-1')).toBe('Answer 1');
    expect(view.queryByTestId('speech-answer-2')).toBeNull();
    expect(text(view, 'speech-ask')).toBe(sx.ask(story.speaker));
    expect(mockSpeak).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('speech-listen-2'));
    expect(mockSpeak).toHaveBeenCalledWith(lineText(2), 'es-MX');
    expect(feedbackButton(view)).toBeTruthy();
    view.unmount();
  });

  it('the back link keeps the run: the list says Continue and the card goes straight back into the story', async () => {
    await saveRun(at(3));
    const view = await mount();
    await press(view, 'speech-back');
    expect(view.getByTestId(`speech-story-continue-${story.id}`).props.children).toBe('Continue');
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 4) });
    await press(view, `speech-story-${story.id}`);
    expect(text(view, 'speech-line-3')).toBe(lineText(3));
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
    await heardFinal('soy de México');
    expect(text(view, 'speech-answer-1')).toBe('Soy de México');
    await advance();
    expect(text(view, 'speech-line-2')).toBe(lineText(2));
    view.unmount();
  });

  it('a wrong result shows "I heard" and the red word; the recognizer writes no accents, so strict accents do not apply', async () => {
    await getDb().setStrictAccents(true);
    await saveRun(at(total - 1, 'voice'));
    const view = await mount();
    await press(view, 'speech-mic');
    await heardFinal('hola');
    expect(text(view, 'speech-heard')).toBe(sx.heard('hola'));
    expect(view.getAllByTestId('speech-said-wrong').length).toBeGreaterThan(0);
    await press(view, 'speech-mic');
    await heardFinal('es de mexico');
    await advance();
    expect(text(view, 'speech-done')).toBe('Done');
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
    expect(await savedNow()).toMatchObject({ mode: 'type', path: WAY.slice(0, 2) });
    expect(await loadResumeValue(getDb(), ANSWER_KEY)).toBe('type');
    await heardFinal('soy de México');
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 2), tries: 0 });
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
    await heardFinal('soy de México');
    // nothing else closed it (a voice result does not): the turn change did
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    await advance();
    // the next turn is on screen; a stray result of the old listening is not accepted
    await heardFinal('tengo treinta años');
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 3), tries: 0 });
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
    expect(mockSpeak).toHaveBeenCalledWith(lineText(0), 'es-MX');
    // what the microphone heard of the read-aloud is not an answer, and costs no try
    await heardFinal(lineText(0));
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 2), tries: 0 });
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
    expect(text(view, 'speech-line-1')).toBe(lineText(1));
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
    await type(view, LAST);
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
    await startFromIntro(view);
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 1), firstTry: 0 });
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
      await type(view, LAST);
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
    expect(text(view, 'speech-line-2')).toBe(lineText(2));
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
    expect(text(view, 'speech-line-2')).toBe(lineText(2));
    view.unmount();
  });
});

describe('Speak tab: the docked footer', () => {
  const scrollMax = (view: View) => StyleSheet.flatten(view.getByTestId('speech-footer-scroll').props.style).maxHeight as number;

  it('what was heard, the ask and the hint scroll; Check, Next and the links are fixed, the input is in the chat', async () => {
    Dimensions.set({ window: { width: 360, height: 640, scale: 1, fontScale: 1 } });
    await saveRun(at(3));
    const view = await mount();
    await type(view, 'hola');
    await type(view, 'hola');
    const scroll = view.getByTestId('speech-footer-scroll');
    const fixed = view.getByTestId('speech-footer-fixed');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    for (const id of ['speech-result', 'speech-ask', 'speech-hint']) expect(within(scroll).getByTestId(id)).toBeTruthy();
    // the field is in the chat (like Practice and the level test), not at the window's bottom edge where Android would pan the screen
    expect(within(fixed).queryByTestId('speech-type-input')).toBeNull();
    expect(within(scroll).queryByTestId('speech-type-input')).toBeNull();
    expect(view.getByTestId('speech-type-input')).toBeTruthy();
    for (const id of ['speech-check', 'speech-skip', 'speech-mode-toggle']) {
      expect(within(fixed).getByTestId(id)).toBeTruthy();
      expect(within(scroll).queryByTestId(id)).toBeNull();
    }
    expect(scrollMax(view)).toBe(upperFooterMax({ room: 640, windowH: 640, kbHeight: 0, topH: TOP_ROW, fixedH: DOCK_RESERVE, voice: false }));
    view.unmount();
  });

  it('an open keyboard gives the upper part less room (it may shrink to zero); Check stays in the fixed part', async () => {
    Dimensions.set({ window: { width: 360, height: 640, scale: 1, fontScale: 1 } });
    await saveRun(at(1));
    const view = await mount();
    const closed = scrollMax(view);
    await act(async () => {
      DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } });
    });
    const open = scrollMax(view);
    expect(open).toBeLessThan(closed);
    expect(open).toBeGreaterThanOrEqual(0);
    expect(open).toBe(upperFooterMax({ room: 640 - 300, windowH: 640, kbHeight: 300, topH: TOP_ROW, fixedH: DOCK_RESERVE, voice: false }));
    expect(within(view.getByTestId('speech-footer-fixed')).getByTestId('speech-check')).toBeTruthy();
    view.unmount();
  });

  it('by voice the mic is in the fixed part and the chat keeps room', async () => {
    Dimensions.set({ window: { width: 360, height: 640, scale: 1, fontScale: 1 } });
    await saveRun(at(1, 'voice'));
    const view = await mount();
    expect(within(view.getByTestId('speech-footer-fixed')).getByTestId('speech-mic')).toBeTruthy();
    expect(within(view.getByTestId('speech-footer-scroll')).queryByTestId('speech-mic')).toBeNull();
    expect(scrollMax(view)).toBe(upperFooterMax({ room: 640, windowH: 640, kbHeight: 0, topH: TOP_ROW, fixedH: DOCK_RESERVE, voice: true }));
    view.unmount();
  });
});

describe('Speak tab: the small phone with the keyboard open', () => {
  const layout = (node: ReturnType<View['getByTestId']>, height: number) => {
    fireEvent(node, 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } });
  };

  it('610 dp window, header to 145, keyboard top at 276: the footer is measured, Next is a link, the input and Check fit between the header and the keyboard', async () => {
    Dimensions.set({ window: { width: 360, height: 610, scale: 1, fontScale: 1 } });
    await saveRun(at(3));
    const view = await mount();
    await type(view, 'hola');
    await type(view, 'hola');
    // keyboard closed: Next is the full-width button
    expect(view.getByTestId('speech-skip')).toBeTruthy();
    expect(view.queryByTestId('speech-skip-link')).toBeNull();
    // what the device measured: the frame is 465 dp (below the header), the keyboard is 334 dp, the fixed part 95 dp
    await act(async () => {
      layout(view.getByTestId('speech-screen'), 610 - 145);
      layout(view.getByTestId('speech-footer-fixed'), 95);
      DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 610 - 276 } });
    });
    const upper = scrollMax(view);
    expect(upper).toBe(upperFooterMax({ room: 610 - 145 - (610 - 276), windowH: 610, kbHeight: 610 - 276, topH: TOP_ROW, fixedH: 95, voice: false }));
    expect(upper).toBeGreaterThanOrEqual(0);
    expect(FOOTER_PAD + upper + 95).toBeLessThanOrEqual(276 - 145);
    // Next moved into the links row, in the place of Help (the hint is showing)
    const fixed = view.getByTestId('speech-footer-fixed');
    expect(within(fixed).getByTestId('speech-skip-link')).toBeTruthy();
    expect(view.queryByTestId('speech-skip')).toBeNull();
    expect(view.queryByTestId('speech-help')).toBeNull();
    expect(within(view.getByTestId('speech-footer-scroll')).getByTestId('speech-hint')).toBeTruthy();
    expect(view.getByTestId('speech-type-input')).toBeTruthy();
    expect(within(fixed).getByTestId('speech-check')).toBeTruthy();
    // the link gives the turn up like the button did
    await press(view, 'speech-skip-link');
    expect(text(view, 'speech-answer-who-3')).toBe('You (model)');
    // the keyboard closes: the button is back when it is needed again
    await act(async () => {
      DeviceEventEmitter.emit('keyboardDidHide', {});
    });
    await advance();
    await type(view, 'hola');
    await type(view, 'hola');
    expect(view.getByTestId('speech-skip')).toBeTruthy();
    expect(view.queryByTestId('speech-skip-link')).toBeNull();
    view.unmount();
  });

  const scrollMax = (view: View) => StyleSheet.flatten(view.getByTestId('speech-footer-scroll').props.style).maxHeight as number;
});

describe('Speak tab: the intro opens at the top', () => {
  it('the scroller is not sent to its end when the Start button appears', async () => {
    const view = await mount();
    scrollToEnd.mockClear();
    await press(view, `speech-story-${story.id}`);
    expect(view.getByTestId('speech-get-ready')).toBeTruthy();
    expect(scrollToEnd).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe('Speak tab: the hardware Back', () => {
  it('on the list it is left alone (the tab is left as before)', async () => {
    const view = await mount();
    expect(await pressBack()).toBe(false);
    expect(view.getByTestId('speech-levels')).toBeTruthy();
    view.unmount();
  });

  it('on the intro it goes back to the list and is consumed', async () => {
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    expect(view.getByTestId('speech-get-ready')).toBeTruthy();
    expect(await pressBack()).toBe(true);
    expect(view.getByTestId('speech-levels')).toBeTruthy();
    view.unmount();
  });

  it('in the story it keeps the run, like the back link: the list says Continue', async () => {
    await saveRun(at(2));
    const view = await mount();
    expect(text(view, 'speech-line-2')).toBe(lineText(2));
    expect(await pressBack()).toBe(true);
    expect(view.getByTestId(`speech-story-continue-${story.id}`)).toBeTruthy();
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, 3) });
    // and the list leaves it alone
    expect(await pressBack()).toBe(false);
    view.unmount();
  });

  it('on the end screen it goes to the list, like Back to the stories', async () => {
    await saveRun(at(total - 1));
    const view = await mount();
    await type(view, LAST);
    await advance();
    expect(view.getByTestId('speech-done')).toBeTruthy();
    expect(await pressBack()).toBe(true);
    expect(view.getByTestId(`speech-story-best-${story.id}`)).toBeTruthy();
    expect(view.queryByTestId(`speech-story-continue-${story.id}`)).toBeNull();
    view.unmount();
  });

  it('only while the tab is focused: a blurred tab has no handler, a refocused one has it again', async () => {
    await saveRun(at(1));
    const view = await mount();
    expect(backHandlers).toHaveLength(1);
    await act(async () => {
      __blur();
    });
    expect(backHandlers).toHaveLength(0);
    expect(await pressBack()).toBe(false);
    expect(text(view, 'speech-line-1')).toBe(lineText(1));
    await act(async () => {
      __focus();
    });
    await flush();
    expect(backHandlers).toHaveLength(1);
    view.unmount();
    expect(backHandlers).toHaveLength(0);
  });
});

describe('Speak tab: the preparation', () => {
  const toPrep = async (view: View) => {
    await press(view, `speech-story-${story.id}`);
    await press(view, 'speech-get-ready');
  };

  it('the intro button says Get ready; the preparation lists every question of the story in data order with what can be said, each line with its 🔊 and translation', async () => {
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    expect(view.getByTestId('speech-get-ready')).toBeTruthy();
    expect(within(view.getByTestId('speech-get-ready')).getByText(sx.getReady)).toBeTruthy();
    await press(view, 'speech-get-ready');
    expect(view.queryByTestId('speech-get-ready')).toBeNull();
    expect(feedbackButton(view)).toBeTruthy();
    story.turns.forEach((turn, i) => {
      if (turn.recall) return;
      expect(text(view, `speech-prep-line-${i}`)).toBe(turn.es);
      turn.branches.forEach((b, j) => b.say.forEach((line, k) => expect(text(view, `speech-prep-say-${i}-${j}-${k}`)).toBe(line.es)));
    });
    expect(view.getByText(story.turns[0].en)).toBeTruthy();
    expect(view.getAllByText(story.turns[0].branches[0].say[0].en).length).toBeGreaterThan(0);
    // the questions about her after the talk are a surprise: not listed
    expect(view.getAllByText(sx.prepAsks(story.speaker))).toHaveLength(story.turns.filter((x) => !x.recall).length);
    expect(view.queryAllByText(sx.recallWho)).toHaveLength(0);
    expect(view.queryByTestId(`speech-prep-line-${story.turns.findIndex((x) => x.recall)}`)).toBeNull();
    // the ask-backs are listed under their own label, not among the answers
    const age = story.turns.findIndex((x) => x.id === 'age');
    expect(text(view, `speech-prep-ask-${age}`)).toBe(sx.canAsk);
    // a question that only one answer leads to says which one
    const like = story.turns.findIndex((x) => x.id === 'like');
    expect(text(view, `speech-prep-from-${like}`)).toBe(sx.leadsFrom('Trabajo en una oficina.'));
    const study = story.turns.findIndex((x) => x.id === 'study');
    expect(text(view, `speech-prep-from-${study}`)).toBe(sx.leadsFrom('No trabajo.'));
    // a turn every way goes through says nothing, a name or a country neither
    for (const id of ['name', 'from', 'age', 'work', 'speak', 'bye']) expect(view.queryByTestId(`speech-prep-from-${story.turns.findIndex((x) => x.id === id)}`)).toBeNull();
    const bye = story.turns.findIndex((x) => x.id === 'bye');
    expect(view.queryByTestId(`speech-prep-from-${bye}`)).toBeNull();
    view.unmount();
  });

  it('🔊 reads a line (the blank left out); nothing is saved yet', async () => {
    const view = await mount();
    await toPrep(view);
    mockSpeak.mockClear();
    fireEvent.press(view.getByTestId('speech-prep-say-listen-0-0-0'));
    expect(mockSpeak).toHaveBeenLastCalledWith('Me llamo.', 'es-MX');
    fireEvent.press(view.getByTestId('speech-prep-listen-0'));
    expect(mockSpeak).toHaveBeenLastCalledWith(story.turns[0].es, 'es-MX');
    expect(await savedNow()).toBeNull();
    view.unmount();
  });

  it('Start begins the story; the back link and the hardware Back go to the intro, and from there to the list', async () => {
    const view = await mount();
    await toPrep(view);
    await press(view, 'speech-back');
    expect(view.getByTestId('speech-get-ready')).toBeTruthy();
    await press(view, 'speech-get-ready');
    expect(await pressBack()).toBe(true);
    expect(view.getByTestId('speech-get-ready')).toBeTruthy();
    expect(await pressBack()).toBe(true);
    expect(view.getByTestId('speech-levels')).toBeTruthy();
    view.unmount();
  });

  it('leaving the preparation stops the read-aloud', async () => {
    const view = await mount();
    await toPrep(view);
    mockStopSpeaking.mockClear();
    await press(view, 'speech-back');
    expect(mockStopSpeaking).toHaveBeenCalled();
    view.unmount();
  });

  it('a resumed run skips the preparation', async () => {
    await saveRun(at(2));
    const view = await mount();
    expect(view.getByTestId('speech-line-2')).toBeTruthy();
    expect(view.queryByTestId('speech-prep-line-0')).toBeNull();
    view.unmount();
  });
});

describe('Speak tab: the answer decides how the story goes on', () => {
  it('a right answer typed just before switching tab: the next line comes, but it is not read aloud in the other tab', async () => {
    await saveRun(at(0));
    const view = await mount();
    await type(view, 'me llamo Ana');
    await act(async () => {
      __blur();
    });
    await flush();
    mockSpeak.mockClear();
    await advance();
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(text(view, 'speech-line-1')).toBe(lineText(1));
    view.unmount();
  });

  const answerWork = async (said: string) => {
    await saveRun(at(WORK));
    const view = await mount();
    await type(view, said);
    await advance();
    return view;
  };

  it('"no trabajo" leads to a different next question than "trabajo en una oficina", and her reaction opens the bubble', async () => {
    const study = await answerWork('no trabajo');
    expect(text(study, `speech-line-${WORK + 1}`)).toBe(`No pasa nada. ${turnById(story, 'study')!.es}`);
    expect(await savedNow()).toMatchObject({ path: [...WAY.slice(0, WORK + 1), 'study'] });
    study.unmount();
    const like = await answerWork('trabajo en una oficina');
    expect(text(like, `speech-line-${WORK + 1}`)).toBe(`¡Qué bien! ${turnById(story, 'like')!.es}`);
    expect(await savedNow()).toMatchObject({ path: [...WAY.slice(0, WORK + 1), 'like'] });
    // the bubble and its translation are one text, the voice reads it as one
    expect(mockSpeak).toHaveBeenLastCalledWith(`¡Qué bien! ${turnById(story, 'like')!.es}`, 'es-MX');
    await press(like, `speech-translate-${WORK + 1}`);
    expect(text(like, `speech-translation-${WORK + 1}`)).toBe(`Great! ${turnById(story, 'like')!.en}`);
    like.unmount();
  });

  it('the header counter is answered + 1 over answered + the longest way ahead (6/14 on the work turn), and it follows the branch', async () => {
    await saveRun(at(WORK));
    const view = await mount();
    expect(view.getByLabelText(sx.progressLabel(6, 14))).toBeTruthy();
    await type(view, 'soy estudiante');
    await advance();
    // the student answer skips like and like2 of the longest way
    expect(view.getByLabelText(sx.progressLabel(7, 12))).toBeTruthy();
    view.unmount();
  });

  it('Help shows every line that can be said on the turn, each with 🔊 and its translation; 🔊 reads it', async () => {
    await saveRun(at(SPEAK));
    const view = await mount();
    expect(view.queryByTestId('speech-hint')).toBeNull();
    await press(view, 'speech-help');
    const speakTurn = turnById(story, 'speak')!;
    const lines = speakTurn.branches.flatMap((b) => b.say);
    expect(lines.length).toBeGreaterThan(3);
    speakTurn.branches.forEach((b, j) => b.say.forEach((line, k) => expect(text(view, `speech-hint-line-${j}-${k}`)).toBe(line.es)));
    expect(view.getByText(sx.canSay, { exact: false })).toBeTruthy();
    expect(view.getByText('I speak a little.')).toBeTruthy();
    mockSpeak.mockClear();
    fireEvent.press(view.getByTestId('speech-hint-listen-2-0'));
    expect(mockSpeak).toHaveBeenLastCalledWith('Sí, hablo español.', 'es-MX');
    view.unmount();
  });

  it('the broad answers of FB582 and FB583 move the story on', async () => {
    const after: Record<string, string> = { 'puedo hablar español': 'bye', sí: 'bye', no: 'learn', 'un poco': 'learn', 'no mucho': 'learn' };
    for (const [said, next] of Object.entries(after)) {
      await getDb().resetGameProgress(SPEECH_PROGRESS_KEY);
      await saveRun(at(SPEAK));
      const view = await mount();
      await type(view, said);
      expect({ said, path: ((await savedNow()) as StoryRun).path }).toEqual({ said, path: [...WAY.slice(0, SPEAK + 1), next] });
      view.unmount();
    }
    // saying goodbye leads to the questions about her
    for (const said of ['gracias', 'adiós', 'hasta luego', 'nos vemos']) {
      await saveRun(at(BYE));
      const view = await mount();
      await type(view, said);
      expect({ said, path: ((await savedNow()) as StoryRun).path }).toEqual({ said, path: [...WAY.slice(0, BYE + 1), 'recall1'] });
      view.unmount();
    }
  });
});

describe('Speak tab: scenes, asking back and the questions about her', () => {
  const AGE = WAY.indexOf('age');
  const FAMILY = WAY.indexOf('family1');
  const RECALL = WAY.indexOf('recall1');
  const BACK = 3;

  it('a scene line comes before her line, in the language of the interface', async () => {
    await saveRun(at(FAMILY));
    const view = await mount();
    expect(text(view, `speech-scene-${FAMILY}`)).toBe(turnById(story, 'family1')!.scene!.en);
    expect(view.queryByTestId(`speech-scene-${AGE}`)).toBeNull();
    view.unmount();
  });

  it('asking back: her answer comes as a pair of bubbles, the turn stays, no try is counted, the answer afterwards still scores, and it survives leaving', async () => {
    await saveRun(at(AGE));
    const view = await mount();
    mockSpeak.mockClear();
    const reply = turnById(story, 'age')!.branches[BACK].reply!;
    await type(view, '¿y tú?');
    expect(text(view, 'speech-back-0')).toBe('¿y tú?');
    expect(text(view, 'speech-back-reply-0')).toBe(reply.es);
    expect(mockSpeak).toHaveBeenLastCalledWith(reply.es, 'es-MX');
    await press(view, 'speech-back-translate-0');
    expect(view.getByText(reply.en)).toBeTruthy();
    expect(view.queryByTestId('speech-result')).toBeNull();
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, AGE + 1), tries: 0, firstTry: AGE, backs: [{ at: AGE, text: '¿y tú?', branch: BACK }] });
    // leaving and coming back: the pair is still there, and silent
    view.unmount();
    const again = await mount();
    expect(text(again, 'speech-back-reply-0')).toBe(reply.es);
    await type(again, 'tengo 35 años');
    await advance();
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, AGE + 2), tries: 0, firstTry: AGE + 1 });
    again.unmount();
  });

  it('a turn always ends: the third ask-back is a wrong try with the red words', async () => {
    await saveRun(at(AGE));
    const view = await mount();
    await type(view, 'y tú');
    await type(view, 'y tú');
    expect(view.queryByTestId('speech-result')).toBeNull();
    await type(view, 'y tú');
    expect(view.getByTestId('speech-result')).toBeTruthy();
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, AGE + 1), tries: 1 });
    view.unmount();
  });

  it('the questions about her: shown as a question of the app, after a scene, with no reaction of hers before them', async () => {
    await saveRun(at(RECALL));
    const view = await mount();
    expect(text(view, `speech-scene-${RECALL}`)).toBe(turnById(story, 'recall1')!.scene!.en);
    expect(text(view, `speech-line-${RECALL}`)).toBe(turnById(story, 'recall1')!.es);
    expect(view.getByText(sx.recallWho)).toBeTruthy();
    await type(view, 'es pintora');
    await advance();
    expect(await savedNow()).toMatchObject({ path: WAY.slice(0, RECALL + 2), firstTry: RECALL + 1 });
    view.unmount();
  });
});

describe('Speak tab: the order of reaction and scene, and Help with the ask-backs', () => {
  const AGE = WAY.indexOf('age');
  const FAMILY = WAY.indexOf('family1');
  const BACK = 3;

  it('a turn with a scene: her reaction to the answer is its own bubble, then the scene, then the question', async () => {
    await saveRun(at(FAMILY));
    const view = await mount();
    expect(text(view, `speech-reaction-${FAMILY}`)).toBe('Ah, muy bien.');
    expect(text(view, `speech-line-${FAMILY}`)).toBe(turnById(story, 'family1')!.es);
    // the reaction comes before the scene, the scene before the question
    const json = JSON.stringify(view.toJSON());
    expect(json.indexOf('speech-reaction-')).toBeLessThan(json.indexOf(`speech-scene-${FAMILY}`));
    expect(json.indexOf(`speech-scene-${FAMILY}`)).toBeLessThan(json.indexOf(`speech-line-${FAMILY}`));
    // a turn without a scene is one bubble
    expect(view.queryByTestId(`speech-reaction-${AGE}`)).toBeNull();
    expect(text(view, `speech-line-${AGE}`)).toBe(bubbleOf(story, at(AGE), AGE, 'es'));
    view.unmount();
  });

  it('Help lists the answers, then the ask-backs under their own label; Help closes the keyboard and stays open after an ask-back; the ask-backs are gone once used up', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await saveRun(at(AGE));
    const view = await mount();
    await press(view, 'speech-help');
    expect(dismiss).toHaveBeenCalled();
    const age = turnById(story, 'age')!;
    expect(text(view, 'speech-hint-ask-title')).toBe(sx.canAsk);
    expect(text(view, `speech-hint-line-${BACK}-0`)).toBe(age.branches[BACK].say[0].es);
    // the list stays open after an ask-back, and the label stays while the turn takes more
    await type(view, 'y tú');
    expect(view.getByTestId('speech-hint')).toBeTruthy();
    expect(view.getByTestId('speech-hint-ask-title')).toBeTruthy();
    await type(view, 'y tú');
    expect(view.getByTestId('speech-hint')).toBeTruthy();
    expect(view.queryByTestId('speech-hint-ask-title')).toBeNull();
    expect(view.queryByTestId(`speech-hint-line-${BACK}-0`)).toBeNull();
    expect(view.getByTestId('speech-hint-line-0-0')).toBeTruthy();
    dismiss.mockRestore();
    view.unmount();
  });
});

describe('Speak tab: the last chosen way of answering', () => {
  it('typing, chosen once, is the way of every story of the pair: the next story is offered and started in typing, also after a restart', async () => {
    const view = await mount();
    await press(view, `speech-story-${story.id}`);
    await press(view, 'speech-mode-type');
    await startFromIntro(view);
    expect(await savedNow()).toMatchObject({ mode: 'type' });
    expect(await loadResumeValue(getDb(), ANSWER_KEY)).toBe('type');
    await press(view, 'speech-back');
    // another story of the list: typing is already chosen, and the run starts in typing
    const other = STORIES[1];
    await press(view, `speech-story-${other.id}`);
    expect(view.getByTestId('speech-mode-type').props.accessibilityState).toMatchObject({ selected: true });
    await startFromIntro(view);
    expect(await savedNow()).toMatchObject({ id: other.id, mode: 'type' });
    view.unmount();
    // an old value without the pair is still honored, a new one wins
    await saveResumeValue(getDb(), ANSWER_KEY, null);
    await saveResumeValue(getDb(), SPEECH_ANSWER_KEY, 'type');
    await saveResumeValue(getDb(), SPEECH_MODE, null);
    const again = await mount();
    await press(again, `speech-story-${story.id}`);
    expect(again.getByTestId('speech-mode-type').props.accessibilityState).toMatchObject({ selected: true });
    again.unmount();
  });
});
