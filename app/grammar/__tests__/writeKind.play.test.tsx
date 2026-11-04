// Sentence writing (`write`) played on the lesson screen the way a learner plays it: the button, a wrong and a right
// sentence, another word order, a dropped pronoun, the accent setting, the saved result, leaving and coming back.
// Silent: lib/speech is mocked, nothing reaches the speaker.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTopicId = 'por-para';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { isWriteItem, type GrammarItem } from '@/lib/games/content';
import { loadDrillResume, saveDrillResume } from '@/lib/drillResume';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { KIND_ORDER } from '@/lib/grammar/useGrammarTopic';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { localDateString } from '@/lib/usageStats';
import GrammarLessonScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);
const speech = require('@/lib/speech') as { speak: jest.Mock; stopSpeaking: jest.Mock };

const writeItemsOf = (topic: string) => (lessonFor('es', topic)!.items as GrammarItem[]).filter(isWriteItem);
const POR_PARA = writeItemsOf('por-para');
const SER_ESTAR = writeItemsOf('ser-estar');

const KINDS = ['choice', 'article', 'match', 'form', 'why', 'transform', 'spot', 'order', 'dictation', 'write'];

async function resetState(topic: string) {
  mockTopicId = topic;
  const db = getDb();
  await db.setOnboarding('en', 'es');
  (db as any).__setLevelForTest('A1');
  await db.setStrictAccents(false);
  await db.resetGameProgress(RESUME_GAME_ID);
  // clean slate: the web DB lives in memory between the tests
  for (const kind of KINDS) {
    for (const suffix of ['best', 'run', 'answered', 'correct']) {
      await db.setGameProgress(GRAMMAR_PROGRESS_KEY, `${topic}:${kind}:${suffix}`, 'cleared', null);
    }
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, `${topic}:${kind}`, 'cleared', null);
  }
}

// the task-kind buttons of the lesson page, in screen order (the word-deck and table-deck buttons are not task kinds)
const kindButtonIds = (): string[] =>
  screen
    .getAllByTestId(new RegExp(`^grammar-start-(${KINDS.join('|')})$`))
    .map((n) => n.props.testID as string);

async function openWriteRound() {
  render(<GrammarLessonScreen />);
  await flush(4);
  fireEvent.press(screen.getByTestId('grammar-start-write'));
  await flush(2);
}

async function typeAndCheck(text: string) {
  fireEvent.changeText(screen.getByTestId('write-input'), text);
  fireEvent.press(screen.getByTestId('write-check'));
  await flush(1);
}

async function next() {
  fireEvent.press(screen.getByTestId('grammar-next'));
  await flush(2);
}

beforeEach(() => speech.speak.mockClear());
afterEach(async () => {
  await getDb().setStrictAccents(false);
});

describe('write: the button', () => {
  beforeEach(() => resetState('por-para'));

  it('is on the lesson page, last, with the count', async () => {
    render(<GrammarLessonScreen />);
    await flush(4);
    expect(screen.getByTestId('grammar-start-write')).toHaveTextContent('Write the sentence (12)');
    const ids = kindButtonIds();
    expect(ids).toEqual(['grammar-start-choice', 'grammar-start-match', 'grammar-start-form', 'grammar-start-why', 'grammar-start-write']);
    expect(ids).toEqual(KIND_ORDER.filter((k) => ids.includes(`grammar-start-${k}`)).map((k) => `grammar-start-${k}`));
    expect(KIND_ORDER[KIND_ORDER.length - 1]).toBe('write');
  });

  it('is also on the ser-estar page, after the dictation', async () => {
    await resetState('ser-estar');
    render(<GrammarLessonScreen />);
    await flush(4);
    expect(kindButtonIds().slice(-2)).toEqual(['grammar-start-dictation', 'grammar-start-write']);
  });
});

describe('write: playing the por-para round', () => {
  beforeEach(() => resetState('por-para'));

  it('shows the English sentence, the hint and the input; Check on an empty field does nothing', async () => {
    await openWriteRound();
    expect(screen.getByTestId('write-prompt')).toHaveTextContent(POR_PARA[0].prompt.en);
    expect(screen.getByText('Write the whole sentence in Spanish')).toBeTruthy();
    const input = screen.getByTestId('write-input');
    expect(input.props.multiline).toBe(true);
    expect(input.props.submitBehavior).toBe('blurAndSubmit');
    expect(input.props.placeholder).toBe('Type in Spanish');

    fireEvent.press(screen.getByTestId('write-check'));
    fireEvent.changeText(input, '   ');
    fireEvent.press(screen.getByTestId('write-check'));
    await flush(1);
    expect(screen.queryByTestId('write-correct')).toBeNull();
    expect(screen.queryByTestId('write-wrong')).toBeNull();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('a wrong sentence shows the comparison and the why, speaks the right one, and Next moves on', async () => {
    await openWriteRound();
    await typeAndCheck('Estudio español por viajar a México.');

    expect(screen.getByTestId('write-wrong')).toBeTruthy();
    expect(screen.getByTestId('answer-compare-typed')).toBeTruthy();
    expect(screen.getByTestId('answer-compare-correct')).toBeTruthy();
    expect(screen.getByTestId('write-why')).toHaveTextContent(POR_PARA[0].why.en);
    expect(screen.queryByTestId('write-check')).toBeNull();
    expect(speech.speak).toHaveBeenCalledWith(POR_PARA[0].es, 'es-MX');
    // locked after the answer
    expect(screen.getByTestId('write-input').props.editable).toBe(false);

    await next();
    expect(screen.getByTestId('grammar-drill-progress')).toHaveTextContent('2 / 12');
    expect(screen.getByTestId('write-prompt')).toHaveTextContent(POR_PARA[1].prompt.en);
    expect(screen.getByTestId('write-input').props.value).toBe('');
  });

  it('the right sentence: the Correct box with the why, no comparison', async () => {
    await openWriteRound();
    await typeAndCheck(POR_PARA[0].es);
    expect(screen.getByTestId('write-correct')).toHaveTextContent(/^Correct/);
    expect(screen.getByTestId('write-sentence')).toHaveTextContent(POR_PARA[0].es);
    expect(screen.getByTestId('write-why')).toHaveTextContent(POR_PARA[0].why.en);
    expect(screen.queryByTestId('answer-compare-typed')).toBeNull();
    expect(speech.speak).toHaveBeenCalledWith(POR_PARA[0].es, 'es-MX');
  });

  it('is lenient with case and punctuation', async () => {
    await openWriteRound();
    await typeAndCheck('estudio español para viajar a méxico');
    expect(screen.getByTestId('write-correct')).toBeTruthy();
  });

  it('another natural word order from `accept` is right', async () => {
    const item = POR_PARA.find((w) => w.id === 'pp-03-w')!;
    expect(item.accept).toContain('Hoy no trabajo por la lluvia.');
    await openWriteRound();
    // walk to pp-03 (the 3rd item) with two quick right answers
    await typeAndCheck(POR_PARA[0].es);
    await next();
    await typeAndCheck(POR_PARA[1].es);
    await next();
    expect(screen.getByTestId('write-prompt')).toHaveTextContent(item.prompt.en);
    await typeAndCheck('Hoy no trabajo por la lluvia.');
    expect(screen.getByTestId('write-correct')).toBeTruthy();
  });

  it('a made-up word order that is not in `accept` is wrong', async () => {
    await openWriteRound();
    await typeAndCheck('Viajar a México para estudio español.');
    expect(screen.getByTestId('write-wrong')).toBeTruthy();
  });

  it('missing accents count as right, however many, unless Settings asks for strict accents', async () => {
    const db = getDb();
    await db.setStrictAccents(false);
    const loose = render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-write'));
    await flush(2);
    expect(screen.getByTestId('write-accent-hint')).toBeTruthy();
    await typeAndCheck('Estudio espanol para viajar a Mexico.');
    expect(screen.getByTestId('write-correct')).toBeTruthy();
    loose.unmount();
    await flush(2);

    await resetState('por-para');
    await db.setStrictAccents(true);
    render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-write'));
    await flush(2);
    await typeAndCheck('Estudio español para viajar a Mexico.');
    expect(screen.getByTestId('write-wrong')).toBeTruthy();
  });

  it('leaving the task silences the read-aloud', async () => {
    render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-write'));
    await flush(2);
    speech.stopSpeaking.mockClear();
    await typeAndCheck(POR_PARA[0].es);
    await next(); // the 1st item unmounts
    expect(speech.stopSpeaking).toHaveBeenCalled();
  });
});

describe('write: a sentence without the subject pronoun (ser-estar)', () => {
  beforeEach(() => resetState('ser-estar'));

  it('"Yo soy estudiante." is also right as "soy estudiante"', async () => {
    expect(SER_ESTAR[0].es).toBe('Yo soy estudiante.');
    await openWriteRound();
    await typeAndCheck('soy estudiante');
    expect(screen.getByTestId('write-correct')).toBeTruthy();
  });
});

describe('write: the saved result and the way back', () => {
  beforeEach(() => resetState('por-para'));

  it('a finished round saves its best result and shows it on the button, without touching the lesson %', async () => {
    await openWriteRound();
    for (let i = 0; i < POR_PARA.length; i++) {
      // the 2nd sentence is typed wrong on purpose
      await typeAndCheck(i === 1 ? 'xxx' : POR_PARA[i].es);
      await next();
    }
    expect(screen.getByText('11 / 12')).toBeTruthy();

    const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    expect(rows.find((r) => r.itemId === 'por-para:write:best')?.data).toEqual({ correct: 11, total: 12 });

    fireEvent.press(screen.getByText('Read the rule again'));
    await flush(2);
    expect(screen.getByTestId('grammar-kind-percent-write')).toHaveTextContent('So far: 92% correct');
    // the lesson % is the average of the scored kinds only: the write result is not in it
    expect(screen.queryByTestId('grammar-lesson-percent')).toBeNull();
  });

  it('leaving in the middle saves the round; the next start continues from the same sentence', async () => {
    await openWriteRound();
    await typeAndCheck(POR_PARA[0].es);
    await next();
    await typeAndCheck('xxx');
    await next();
    expect(screen.getByTestId('grammar-drill-progress')).toHaveTextContent('3 / 12');

    fireEvent.press(screen.getByText('←'));
    await flush(2);
    expect(screen.getByTestId('grammar-kind-percent-write')).toHaveTextContent('2/12 · 8%');

    fireEvent.press(screen.getByTestId('grammar-start-write'));
    await flush(2);
    expect(screen.getByTestId('grammar-drill-progress')).toHaveTextContent('3 / 12');
    expect(screen.getByTestId('write-prompt')).toHaveTextContent(POR_PARA[2].prompt.en);
  });

  it('closing the app in the task: the lesson opens in the write round again, and leaving clears the save', async () => {
    const today = localDateString();
    await saveDrillResume(getDb(), { topicId: 'por-para', kind: 'write', day: today });
    const view = render(<GrammarLessonScreen />);
    await flush(6);
    expect(screen.queryByTestId('grammar-start-write')).toBeNull();
    expect(screen.getByTestId('write-input')).toBeTruthy();
    expect(await loadDrillResume(getDb())).toEqual({ topicId: 'por-para', kind: 'write', day: today });

    view.unmount();
    await flush(6);
    expect(await loadDrillResume(getDb())).toBeNull();
  });
});
