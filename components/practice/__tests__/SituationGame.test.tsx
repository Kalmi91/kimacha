// The Practice tab's Situations mode (components/practice/SituationGame.tsx, lib/practice/situations.ts). The speech recognizer is the
// stand-in of jest.setup.js (its listeners are fired with __emit); the read-aloud is mocked like in the other Practice tests.

jest.mock('@/lib/speech', () => ({ ...require('@/test-utils/mocks').speechMock(), stop: jest.fn() }));
jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

import { act, fireEvent, render, within } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import SituationGame from '@/components/practice/SituationGame';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
import {
  SITUATIONS,
  SITUATIONS_MODE,
  fillBank,
  savedSituation,
  startSituation,
  type SituationState,
  type SituationStep,
} from '@/lib/practice/situations';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { speak, stopSpeaking } from '@/lib/speech';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const { __emit } = require('expo-speech-recognition') as { __emit: (name: string, payload?: unknown) => void };
const mockSpeak = speak as jest.Mock;
const mockStopSpeaking = stopSpeaking as jest.Mock;
// the jest ScrollView keeps its methods on the class: one jest.fn for every scroller
const scrollToEnd = ScrollView.prototype.scrollToEnd as unknown as jest.Mock;
const flush = makeFlush(20);

const family = SITUATIONS[0];
const SEED = 11;
const EVERYTHING = new Set(family.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
// a run in the given step, with nothing left to learn in the Words step
const at = (step: SituationStep, patch: Partial<SituationState> = {}): SituationState => ({ ...startSituation(family, EVERYTHING, SEED), step, ...patch });
const saveRun = (run: SituationState) => saveResumeValue(getDb(), SITUATIONS_MODE, savedSituation(run));
const savedRun = async () => (await loadResumeValue(getDb(), SITUATIONS_MODE)) as SituationState | null;

const mount = async () => {
  const view = render(<ThemeProvider><SituationGame /></ThemeProvider>);
  await flush();
  return view;
};
type View = Awaited<ReturnType<typeof mount>>;
const press = async (view: View, testID: string) => {
  fireEvent.press(view.getByTestId(testID));
  await flush();
};
const type = async (view: View, text: string) => {
  fireEvent.changeText(view.getByTestId('situations-type-input'), text);
  await press(view, 'situations-check');
};
const emit = async (name: string, payload?: unknown) => {
  await act(async () => __emit(name, payload));
  await flush();
};
// the testIDs of the rendered tree in screen order (top to bottom)
const testIdsInOrder = (view: View) => {
  const out: string[] = [];
  const walk = (node: unknown) => {
    const n = node as { props?: { testID?: string }; children?: unknown[] } | string | null;
    if (!n || typeof n === 'string') return;
    if (n.props?.testID) out.push(n.props.testID);
    n.children?.forEach(walk);
  };
  const tree = view.toJSON();
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  return out;
};
const heardFinal = (transcript: string) => emit('result', { isFinal: true, results: [{ transcript, confidence: 1 }] });

beforeEach(async () => {
  mockSpeak.mockClear();
  mockStopSpeaking.mockClear();
  (ExpoSpeechRecognitionModule.start as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.abort as jest.Mock).mockClear();
  (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(true);
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await saveResumeValue(getDb(), SITUATIONS_MODE, null);
});
afterEach(() => setLanguage('en'));

describe('Situations: words, structures', () => {
  it('opens on the unknown words, one card each, then the structures, then Fill in; the feedback button is on every step', async () => {
    const view = await mount();
    expect(view.getByTestId('situations-screen')).toBeTruthy();
    expect(view.getByTestId('situations-card-word').props.children).toBe('tener');
    expect(view.getByText('to have')).toBeTruthy();
    expect(view.getByText('1/13')).toBeTruthy();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    fireEvent.press(view.getByTestId('situations-speak'));
    expect(mockSpeak).toHaveBeenCalledWith('tener', 'es-MX');
    for (let i = 0; i < 13; i++) await press(view, 'situations-next');
    expect(view.getByTestId('situations-card-pattern').props.children).toBe('Tengo + number + noun');
    expect(view.getByText('I have + number + noun: what you have.')).toBeTruthy();
    expect(view.getByText('1/3')).toBeTruthy();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    fireEvent.press(view.getByTestId('situations-speak'));
    expect(mockSpeak).toHaveBeenCalledWith('Tengo dos hermanos.', 'es-MX');
    expect(await savedRun()).toMatchObject({ step: 'patterns', index: 0 });
    for (let i = 0; i < 3; i++) await press(view, 'situations-next');
    expect(view.getByTestId('situations-line-0')).toBeTruthy();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    expect(await savedRun()).toMatchObject({ step: 'fill', index: 0 });
    view.unmount();
  });

  it('Hungarian: the meanings and the labels are Hungarian', async () => {
    setLanguage('hu');
    await getDb().setOnboarding('hu', 'es');
    const view = await mount();
    expect(view.getByText('van (valakinek)')).toBeTruthy();
    expect(view.getByText('Új szavak')).toBeTruthy();
    view.unmount();
    // the pattern is titled in the learner's language
    await saveRun(at('patterns', { index: 0 }));
    const patterns = await mount();
    expect(patterns.getByTestId('situations-card-pattern').props.children).toBe('Tengo + szám + főnév');
    expect(patterns.getByText('Tengo + szám + főnév: ami neked van (van két testvérem).')).toBeTruthy();
    patterns.unmount();
    // and the build step is called what the other build steps are called
    await saveRun(at('build'));
    const build = await mount();
    expect(build.getByText('Építsd fel a mondatot')).toBeTruthy();
    build.unmount();
  });

  it('no situation for another target language: the empty state', async () => {
    await getDb().setOnboarding('es', 'en');
    const view = await mount();
    expect(view.getByTestId('situations-empty')).toBeTruthy();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    view.unmount();
  });
});

describe('Situations: fill in', () => {
  it('a wrong word flashes red and is not placed; the right ones fill the gaps in order; Next only after the last one', async () => {
    await saveRun(at('fill'));
    const view = await mount();
    const bank = fillBank(family, SEED);
    const wrongAt = bank.findIndex((w) => w !== 'tengo');
    expect(view.getByText('1/3')).toBeTruthy();
    expect(view.getAllByText(/_____/).length).toBeGreaterThan(0);
    await press(view, `situations-word-${wrongAt}`);
    expect(view.getByText(`✗ ${bank[wrongAt]}`)).toBeTruthy();
    expect(view.queryByText(/Sí, tengo un hermano/)).toBeNull();
    expect(await savedRun()).toMatchObject({ index: 0, wrong: 1 });
    await press(view, `situations-word-${bank.indexOf('tengo')}`);
    expect(view.getByText(/Sí, tengo un hermano y una hermana\./)).toBeTruthy();
    expect(view.queryByTestId('situations-next')).toBeNull();
    await press(view, `situations-word-${bank.indexOf('viven')}`);
    await press(view, `situations-word-${bank.indexOf('años')}`);
    expect(view.getByText(/Mi hermano tiene treinta años\./)).toBeTruthy();
    expect(await savedRun()).toMatchObject({ index: 3, done: true, scores: { fill: 2 } });
    await press(view, 'situations-next');
    expect(view.getByText('Build the sentence')).toBeTruthy();
    expect(await savedRun()).toMatchObject({ step: 'build', index: 0 });
    view.unmount();
  });
});

describe('Situations: build', () => {
  it('a line built right counts, a wrong one does not; either way the next line comes', async () => {
    await saveRun(at('build'));
    const view = await mount();
    expect(view.getByText('Yes, I have a brother and a sister.')).toBeTruthy();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    for (const w of ['sí', 'tengo', 'un', 'hermano', 'y', 'una', 'hermana']) fireEvent.press(view.getByText(w));
    fireEvent.press(view.getByText('Check'));
    fireEvent.press(view.getByText('Next →'));
    await flush();
    expect(await savedRun()).toMatchObject({ step: 'build', index: 1, scores: { build: 1 } });
    expect(view.getByText('My parents live in Hungary.')).toBeTruthy();
    fireEvent.press(view.getByText('mis'));
    fireEvent.press(view.getByText('Check'));
    fireEvent.press(view.getByText('Next →'));
    await flush();
    expect(await savedRun()).toMatchObject({ step: 'build', index: 2, scores: { build: 1 } });
    expect(view.getByText('My brother is thirty years old.')).toBeTruthy();
    view.unmount();
  });
});

describe('Situations: say it', () => {
  it('typed: a wrong try shows the words red, the right one is green and brings Next; two wrong tries give up', async () => {
    await saveRun(at('say', { index: 0 }));
    const view = await mount();
    expect(view.getByTestId('situations-line-text').props.children).toBe('¿Tienes hermanos?');
    expect(view.getByText('Do you have any siblings?')).toBeTruthy();
    expect(view.getByTestId('situations-mic')).toBeTruthy();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    fireEvent.press(view.getByTestId('situations-listen'));
    expect(mockSpeak).toHaveBeenCalledWith('¿Tienes hermanos?', 'es-MX');
    expect(view.queryByTestId('situations-type-input')).toBeNull();
    await press(view, 'situations-type');
    await type(view, 'tienes amigos');
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(view.getAllByTestId('situations-said-right')).toHaveLength(1);
    expect(view.getAllByTestId('situations-said-wrong')).toHaveLength(1);
    expect(view.queryByTestId('situations-next')).toBeNull();
    await type(view, 'tienes hermanos');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(view.getAllByTestId('situations-said-right')).toHaveLength(2);
    expect(await savedRun()).toMatchObject({ step: 'say', index: 0, done: true, wrong: 1, scores: { say: 0 } });
    await press(view, 'situations-next');
    expect(view.getByTestId('situations-line-text').props.children).toBe('Sí, tengo un hermano y una hermana.');
    // the typing field stays open for the next line
    await type(view, 'no');
    await type(view, 'nada');
    expect(await savedRun()).toMatchObject({ index: 1, done: true, wrong: 2 });
    expect(view.getByTestId('situations-next')).toBeTruthy();
    view.unmount();
  });

  it('by voice: the mic asks for the recognizer in es-MX and the final result is checked', async () => {
    await saveRun(at('say', { index: 1 }));
    const view = await mount();
    await press(view, 'situations-mic');
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'es-MX', interimResults: false }));
    await emit('start');
    expect(view.getByText('Listening… tap to stop')).toBeTruthy();
    await heardFinal('sí tengo un hermano y una hermana');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(view.getByTestId('situations-next')).toBeTruthy();
    expect(await savedRun()).toMatchObject({ index: 1, done: true, scores: { say: 1 } });
    view.unmount();
  });

  it('nothing heard (no-speech, speech-timeout) or another hiccup: a hint to try again, typing is not forced', async () => {
    await saveRun(at('say', { index: 0 }));
    const view = await mount();
    await emit('error', { error: 'speech-timeout', message: 'nothing said' });
    expect(view.getByTestId('situations-mic-error').props.children).toBe('Nothing heard. Tap the mic again, or type it.');
    await emit('error', { error: 'no-speech', message: 'nothing said' });
    expect(view.getByTestId('situations-mic-error').props.children).toBe('Nothing heard. Tap the mic again, or type it.');
    await emit('error', { error: 'network', message: 'offline' });
    expect(view.getByTestId('situations-mic-error').props.children).toBe('The microphone did not work this time. Tap it again, or type it.');
    await emit('error', { error: 'busy', message: 'busy' });
    expect(view.getByTestId('situations-mic-error').props.children).toBe('The microphone did not work this time. Tap it again, or type it.');
    expect(view.queryByTestId('situations-type-input')).toBeNull();
    expect(view.getByTestId('situations-mic')).toBeTruthy();
    expect(view.getByTestId('situations-type')).toBeTruthy();
    // only a microphone that cannot be used switches to typing
    await emit('error', { error: 'audio-capture', message: 'no input' });
    expect(view.getByTestId('situations-type-input')).toBeTruthy();
    expect(view.getByTestId('situations-mic-error').props.children).toBe('The microphone is not available. Type it instead.');
    view.unmount();
    for (const error of ['service-not-allowed', 'language-not-supported']) {
      const other = await mount();
      await emit('error', { error, message: 'x' });
      expect(other.getByTestId('situations-type-input')).toBeTruthy();
      other.unmount();
    }
  });

  it('the read-aloud stops before the microphone opens; a result that is still on its way cannot land after the answer was typed; the error goes with the line', async () => {
    await saveRun(at('say', { index: 0 }));
    const view = await mount();
    mockStopSpeaking.mockClear();
    await press(view, 'situations-mic');
    const starts = (ExpoSpeechRecognitionModule.start as jest.Mock).mock.invocationCallOrder[0];
    expect(mockStopSpeaking).toHaveBeenCalled();
    expect(mockStopSpeaking.mock.invocationCallOrder[0]).toBeLessThan(starts);
    await emit('start');
    await press(view, 'situations-type');
    await type(view, 'tienes hermanos');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
    await heardFinal('hola que tal');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await savedRun()).toMatchObject({ index: 0, done: true, wrong: 0, scores: { say: 1 } });
    // an error of this line is not shown on the next one
    await emit('error', { error: 'not-allowed', message: 'denied' });
    await press(view, 'situations-next');
    expect(view.queryByTestId('situations-mic-error')).toBeNull();
    expect(await savedRun()).toMatchObject({ index: 1, done: false, wrong: 0 });
    view.unmount();
  });

  it('a result with a wrong number is wrong in Say it (the line has to be said as it is), and right with the number of the line', async () => {
    await saveRun(at('say', { index: 5 }));
    const view = await mount();
    await press(view, 'situations-type');
    await type(view, 'mi hermano tiene 2 años');
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(view.getAllByTestId('situations-said-wrong')).toHaveLength(1);
    await type(view, 'mi hermano tiene 30 años');
    expect(view.getByText('Correct!')).toBeTruthy();
    view.unmount();
  });

  it('a denied microphone or no speech service: typing is offered at once', async () => {
    await saveRun(at('say', { index: 0 }));
    const view = await mount();
    expect(view.queryByTestId('situations-type-input')).toBeNull();
    await emit('error', { error: 'not-allowed', message: 'denied' });
    expect(view.getByTestId('situations-type-input')).toBeTruthy();
    expect(view.getByTestId('situations-mic-error')).toBeTruthy();
    view.unmount();
    (ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock).mockReturnValue(false);
    const noService = await mount();
    expect(noService.queryByTestId('situations-mic')).toBeNull();
    expect(noService.queryByTestId('situations-type')).toBeNull();
    expect(noService.getByTestId('situations-type-input')).toBeTruthy();
    noService.unmount();
  });
});

describe('Situations: questions', () => {
  it('the question is read aloud; a wrong answer shows the model and gives one more try; a number may be a digit', async () => {
    await saveRun(at('questions', { index: 0 }));
    const view = await mount();
    expect(mockSpeak).toHaveBeenCalledWith('¿Tienes hermanos?', 'es-MX');
    expect(view.getByTestId('situations-line-text').props.children).toBe('¿Tienes hermanos?');
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    await press(view, 'situations-type');
    await type(view, 'hola');
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(view.getByTestId('situations-model').props.children).toBe('A good answer: Sí, tengo un hermano y una hermana.');
    expect(view.queryByTestId('situations-next')).toBeNull();
    await type(view, 'sí tengo un hermano');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await savedRun()).toMatchObject({ step: 'questions', index: 0, done: true, scores: { questions: 0 } });
    await press(view, 'situations-next');
    expect(view.getByTestId('situations-line-text').props.children).toBe('¿Dónde viven tus papás?');
    expect(mockSpeak).toHaveBeenCalledWith('¿Dónde viven tus papás?', 'es-MX');
    await type(view, 'viven en México');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await savedRun()).toMatchObject({ index: 1, done: true, scores: { questions: 1 } });
    await press(view, 'situations-next');
    await type(view, 'tiene 5 años');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await savedRun()).toMatchObject({ index: 2, done: true, scores: { questions: 2 } });
    view.unmount();
  });
});

describe('Situations: summary and resume', () => {
  it('the summary shows the score per part, drops the saved run, and Again starts the situation over', async () => {
    await saveRun(at('questions', { index: 2, done: true, scores: { fill: 3, build: 2, say: 5, questions: 1 } }));
    const view = await mount();
    await press(view, 'situations-next');
    expect(view.getByTestId('situations-summary')).toBeTruthy();
    expect(view.getByText('Situation done')).toBeTruthy();
    expect(view.getByText('Fill in the gaps: 3 / 3')).toBeTruthy();
    expect(view.getByText('Build the sentence: 2 / 3')).toBeTruthy();
    expect(view.getByText('Say it: 5 / 6')).toBeTruthy();
    expect(view.getByText('Answer the questions: 1 / 3')).toBeTruthy();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    expect(await savedRun()).toBeNull();
    await press(view, 'situations-again');
    expect(view.getByTestId('situations-card-word').props.children).toBe('tener');
    expect((await savedRun())?.scores).toEqual({ fill: 0, build: 0, say: 0, questions: 0 });
    view.unmount();
  });

  it('coming back continues where the learner was; a broken saved value starts a new run', async () => {
    await saveRun(at('say', { index: 3, wrong: 1, scores: { fill: 3, build: 3, say: 2, questions: 0 } }));
    let view = await mount();
    expect(view.getByText('4/6')).toBeTruthy();
    expect(view.getByTestId('situations-line-text').props.children).toBe('Mis papás viven en Hungría.');
    view.unmount();
    view = await mount();
    expect(view.getByText('4/6')).toBeTruthy();
    view.unmount();
    await saveResumeValue(getDb(), SITUATIONS_MODE, { v: 1, id: 'a1-familia', step: 'dance' });
    view = await mount();
    expect(view.getByTestId('situations-card-word').props.children).toBe('tener');
    view.unmount();
  });
});

describe('Situations: what is needed to answer is on screen without scrolling', () => {
  it('Fill in: the word bank is docked above the tab bar, not in the scroller, and goes with the last gap', async () => {
    await saveRun(at('fill'));
    const view = await mount();
    const bank = fillBank(family, SEED);
    const footer = view.getByTestId('game-footer');
    for (let n = 0; n < bank.length; n++) expect(within(footer).getByTestId(`situations-word-${n}`)).toBeTruthy();
    expect(within(footer).getByText('Tap the word that fits the first gap')).toBeTruthy();
    expect(within(view.getByTestId('situations-line-0')).queryByTestId('situations-word-0')).toBeNull();
    for (const w of ['tengo', 'viven', 'años']) await press(view, `situations-word-${bank.indexOf(w)}`);
    expect(view.queryByTestId('game-footer')).toBeNull();
    expect(view.getByTestId('situations-next')).toBeTruthy();
    view.unmount();
  });

  it('Build: the frame follows the end of the card whenever it grows, so Check and Next stay in view', async () => {
    await saveRun(at('build'));
    const view = await mount();
    const card = view.getByTestId('situations-build-card');
    const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height } } });
    scrollToEnd.mockClear();
    fireEvent(card, 'layout', layout(420));
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    fireEvent(card, 'layout', layout(420));
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    fireEvent(card, 'layout', layout(520));
    expect(scrollToEnd).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it('Say it: with typing on, the verdict and the field come right under the card, above the microphone', async () => {
    await saveRun(at('say', { index: 0 }));
    const view = await mount();
    await press(view, 'situations-type');
    await type(view, 'tienes amigos');
    const order = testIdsInOrder(view);
    const at_ = (id: string) => order.indexOf(id);
    expect(at_('situations-line-text')).toBeGreaterThan(-1);
    expect(at_('situations-line-text')).toBeLessThan(at_('situations-result'));
    expect(at_('situations-result')).toBeLessThan(at_('situations-type-input'));
    expect(at_('situations-type-input')).toBeLessThan(at_('situations-mic'));
    view.unmount();
  });

  it('Enter in the typing field runs the check once; an empty field does nothing', async () => {
    await saveRun(at('questions', { index: 0 }));
    const view = await mount();
    await press(view, 'situations-type');
    const input = view.getByTestId('situations-type-input');
    fireEvent(input, 'submitEditing');
    await flush();
    expect(view.queryByTestId('situations-result')).toBeNull();
    fireEvent.changeText(input, 'sí tengo un hermano');
    fireEvent(input, 'submitEditing');
    await flush();
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await savedRun()).toMatchObject({ step: 'questions', index: 0, done: true, wrong: 0, scores: { questions: 1 } });
    view.unmount();
  });
});
