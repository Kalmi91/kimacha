// The Practice tab (beta): a text of five sentences with a due word each, five questions, then the words go to the
// Sentences tab. Mock pattern: pcicSpeak.test.tsx (db, router, speech, safe area). The real corpus is used: the
// learner knows the first 100 words of A1 and the presente, so the sentences of the due words below are known.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

import { act, fireEvent, render } from '@testing-library/react-native';

import { findPcicItem, pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { __resetBetaForTest, setBeta } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { setLanguage } from '@/lib/i18n';
import { parsePracticeRound } from '@/lib/practice/practiceRound';
import { readingWordFor, resolveSet, type ResolvedQuestion } from '@/lib/practice/reading';
import { speak } from '@/lib/speech';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import PracticeScreen from '../practice';

jest.setTimeout(60000);

const mockSpeak = speak as jest.Mock;
const TODAY = localDateString();

// The five due words, the longest overdue first, and their sentences (words-open sentence_es).
const DUE = ['o19', 'o37', 'o20', 'o38', 'o3'];
const SENTENCES = ['Estoy en casa.', 'Usted está bien.', 'Tiene una casa.', 'Mi madre está en casa.', 'Yo estoy bien.'];

const learned = (itemId: string, due: string, over: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due,
  lastReview: '2000-01-01',
  introducedAt: '2000-01-01',
  ...over,
});

// The first 100 words of A1 are learned (not due), five of them are due. `dueIds` can shorten the due list.
const learnWords = async (dueIds: string[] = DUE) => {
  setPcicTarget('es');
  for (const it of pcicItemsForLevel('A1').slice(0, 100)) {
    const at = dueIds.indexOf(it.id);
    await getDb().upsertPcicCard(learned(it.id, at === -1 ? '2099-01-01' : `2000-01-0${at + 1}`));
  }
};

// a small deterministic [0, 1) source: the questions are drawn with Math.random
const seeded = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};

const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const mount = async () => {
  const view = render(<ThemeProvider><PracticeScreen /></ThemeProvider>);
  await flush();
  return view;
};
type View = Awaited<ReturnType<typeof mount>>;

const press = async (view: View, testID: string) => {
  fireEvent.press(view.getByTestId(testID));
  await flush();
};
const next = async (view: View) => press(view, 'practice-action');

const saved = async () => parsePracticeRound(await getDb().getPracticeRound());
// the questions of the saved round, as the screen shows them
const questions = async (): Promise<ResolvedQuestion[]> => {
  const round = (await saved())!;
  const words = round.ids.map((id) => readingWordFor(findPcicItem(id)!, 'es')!);
  return resolveSet(words, round.qs, findPcicItem, 'es')!.resolved;
};
const optionCount = (q: ResolvedQuestion) => (q.kind === 'meaning' ? q.options.length : 2);
// Answers question n (1-based) right or wrong.
const answer = async (view: View, n: number, right = true) => {
  const q = (await questions())[n - 1];
  await press(view, `practice-option-${right ? q.correct : (q.correct + 1) % optionCount(q)}`);
};
// the text -> question 1
const toQuestions = async (view: View) => next(view);
// answers every question (right) and moves to the sentences step
const finishQuestions = async (view: View) => {
  for (let n = 1; n <= 5; n++) {
    await answer(view, n);
    await next(view);
  }
};

beforeEach(async () => {
  mockPush.mockClear();
  mockSpeak.mockClear();
  jest.spyOn(Math, 'random').mockImplementation(seeded(11));
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setStrictAccents(false);
  await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 1, total: 1 });
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(TODAY, -100000);
});
afterEach(() => {
  jest.restoreAllMocks();
  setLanguage('en');
});

describe('Practice tab: the text', () => {
  it('shows the five sentences as one paragraph with the due word of each highlighted, the read-aloud and the Next button', async () => {
    await learnWords();
    const view = await mount();
    // the level counter on top (same as the Sentences tab); the screen has no title of its own, the tab navigator's header says "Practice".
    expect(view.getByTestId('level-counter').props.accessibilityLabel).toMatch(/^Level [A-C]\d: \d+ words, \d+ due$/);
    expect(view.queryByText('Practice')).toBeNull();
    expect(view.getByTestId('practice-text').props.children).toHaveLength(5);
    const flat = (node: unknown): string =>
      Array.isArray(node) ? node.map(flat).join('') : typeof node === 'string' ? node : node && typeof node === 'object' && 'props' in node ? flat((node as { props: { children?: unknown } }).props.children) : '';
    expect(flat(view.getByTestId('practice-text').props.children)).toBe(SENTENCES.join(' '));
    expect([0, 1, 2, 3, 4].map((i) => view.getByTestId(`practice-word-${i}`).props.children)).toEqual(['casa', 'Usted', 'una', 'madre', 'bien']);
    expect(view.getByText('Read aloud')).toBeTruthy();
    expect(view.getByText('Next →')).toBeTruthy();
    view.unmount();
  });

  it('reads the whole paragraph aloud, in Spanish', async () => {
    await learnWords();
    const view = await mount();
    await press(view, 'practice-speak');
    expect(mockSpeak).toHaveBeenCalledWith(SENTENCES.join(' '), 'es-MX');
    view.unmount();
  });

  it('Spanish UI: the labels are Spanish', async () => {
    setLanguage('es');
    await learnWords();
    const view = await mount();
    expect(view.getByText('Leer en voz alta')).toBeTruthy();
    expect(view.getByText('Siguiente →')).toBeTruthy();
    await toQuestions(view);
    expect(view.getByText('1/5')).toBeTruthy();
    expect(view.getByLabelText('Pregunta 1 de 5')).toBeTruthy();
    view.unmount();
  });

  it('a sentence with a word the learner does not know is skipped and the next word comes; a word known by hand stays out', async () => {
    await learnWords();
    // a C1 word's sentence has words outside the first 100; o5 is marked known by hand; both would be first in line
    await getDb().upsertPcicCard(learned(pcicItemsForLevel('C1')[0].id, '1999-01-01'));
    await getDb().upsertPcicCard(learned('o5', '1999-01-02', { known: true }));
    const view = await mount();
    expect((await saved())!.ids).toEqual(DUE);
    view.unmount();
  });

  it('too few words with a known sentence: the friendly empty state, in English and Spanish', async () => {
    await learnWords(DUE.slice(0, 2));
    const view = await mount();
    expect(view.getByTestId('practice-empty')).toBeTruthy();
    expect(view.getByText('Learn a few more words, then there will be something to read here')).toBeTruthy();
    expect(view.queryByText('Next →')).toBeNull();
    expect(await getDb().getPracticeRound()).toBeNull();
    view.unmount();
    setLanguage('es');
    const es = await mount();
    expect(es.getByText('Aprende unas palabras más y aquí habrá algo para leer')).toBeTruthy();
    expect(es.getByTestId('level-counter')).toBeTruthy();
    es.unmount();
  });

  it('nothing learned yet: the empty state', async () => {
    await getDb().upsertPcicCard(sm2NewCard('o33'));
    const view = await mount();
    expect(view.getByTestId('practice-empty')).toBeTruthy();
    view.unmount();
  });
});

describe('Practice tab: the questions', () => {
  it('five questions, progress n/5, each with its options; meaning questions offer 3 meanings, true/false True and False', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    const qs = await questions();
    expect(qs).toHaveLength(5);
    for (let n = 1; n <= 5; n++) {
      const q = qs[n - 1];
      expect(view.getByText(`${n}/5`)).toBeTruthy();
      expect(view.getByLabelText(`Question ${n} of 5`)).toBeTruthy();
      if (q.kind === 'meaning') {
        expect(view.getByText(`What does “${q.word}” mean in the text?`)).toBeTruthy();
        expect(q.options).toHaveLength(3);
        expect(new Set(q.options).size).toBe(3);
        q.options.forEach((o, i) => expect(view.getByTestId(`practice-option-${i}`).props.accessibilityLabel).toBe(o));
      } else {
        expect(view.getByText('True or false, based on the text:')).toBeTruthy();
        expect(view.getByTestId('practice-statement').props.children).toBe(q.statement);
        expect(view.getByText('True')).toBeTruthy();
        expect(view.getByText('False')).toBeTruthy();
      }
      expect(view.queryByText('Next →')).toBeNull(); // Next comes after the answer
      await answer(view, n);
      await next(view);
    }
    view.unmount();
  });

  it('both kinds come, and the true/false ones are a true and a false statement', async () => {
    await learnWords();
    const view = await mount();
    const qs = await questions();
    expect(qs.filter((q) => q.kind === 'meaning')).toHaveLength(3);
    const tf = qs.filter((q) => q.kind === 'truefalse');
    expect(tf).toHaveLength(2);
    expect(tf.filter((q) => q.kind === 'truefalse' && q.truth)).toHaveLength(1);
    view.unmount();
  });

  it('a right answer: the option is marked, "Correct!", the meaning in a line, Next', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    const q = (await questions())[0];
    await answer(view, 1);
    expect(view.getByText('Correct!')).toBeTruthy();
    if (q.kind === 'meaning') {
      expect(view.getByTestId('practice-explanation').props.children).toBe(`“${q.word}” means ${q.options[q.correct]}`);
      expect(view.getByTestId(`practice-option-${q.correct}`).props.accessibilityLabel).toBe(`${q.options[q.correct]}, Correct!`);
    }
    expect(view.getByText('Next →')).toBeTruthy();
    view.unmount();
  });

  it('a wrong answer: "Wrong", the right option is marked, and the answer cannot be changed', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    const q = (await questions())[0];
    await answer(view, 1, false);
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(view.queryByText('Correct!')).toBeNull();
    // a second tap on the right option changes nothing
    await press(view, `practice-option-${q.correct}`);
    expect(view.getByText('Wrong')).toBeTruthy();
    expect((await saved())!.picks[0]).toBe((q.correct + 1) % optionCount(q));
    view.unmount();
  });

  it('the true/false feedback says whether the sentence is in the text', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    const qs = await questions();
    for (let n = 1; n <= 5; n++) {
      const q = qs[n - 1];
      await answer(view, n);
      if (q.kind === 'truefalse') {
        expect(view.getByTestId('practice-explanation').props.children).toBe(q.truth ? 'This sentence is in the text.' : 'This sentence is not in the text.');
      }
      await next(view);
    }
    view.unmount();
  });

  it('the questions give no half and no XP, right or wrong', async () => {
    await setBeta('xpV2', true);
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    await answer(view, 1);
    await next(view);
    await answer(view, 2, false);
    expect(await getDb().getDailyXpTenths(TODAY)).toBe(0);
    for (const id of DUE) expect(await getDb().getPcicCard(id)).toMatchObject({ halfSteps: 0, wrongStreak: 0, due: expect.stringMatching(/^2000-01-0/) });
    view.unmount();
  });
});

describe('Practice tab: the sentences step', () => {
  it('after the 5 questions: "Questions done" and the button that opens the Sentences tab with the five card ids', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    await finishQuestions(view);
    expect(view.getByText('Questions done')).toBeTruthy();
    expect(view.queryByText('1/5')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    await press(view, 'practice-sentences');
    expect(view.getByText('Practice these words in sentences')).toBeTruthy();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/sentences', params: { focus: 'o19,o37,o20,o38,o3' } });
    view.unmount();
  });

  it('Spanish UI: the labels of the step are Spanish', async () => {
    setLanguage('es');
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    await finishQuestions(view);
    expect(view.getByText('Preguntas terminadas')).toBeTruthy();
    expect(view.getByText('Practica estas palabras en frases')).toBeTruthy();
    expect(view.getByText('Otra lectura')).toBeTruthy();
    view.unmount();
  });

  it('"New reading" starts a new round at the text', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    await finishQuestions(view);
    await press(view, 'practice-again');
    expect(view.getByText('Read aloud')).toBeTruthy();
    expect(await saved()).toMatchObject({ step: 0, picks: [null, null, null, null, null] });
    view.unmount();
  });

  it('"New reading" and a new day use other due words than the round they replace (FB511)', async () => {
    // forty words are due (not only five), the oldest first; reading a text gives no progress, so the cards stay
    setPcicTarget('es');
    for (const [n, it] of pcicItemsForLevel('A1').slice(0, 100).entries()) {
      const due = `2000-${String(1 + Math.floor(n / 28)).padStart(2, '0')}-${String(1 + (n % 28)).padStart(2, '0')}`;
      await getDb().upsertPcicCard(learned(it.id, n < 40 ? due : '2099-01-01'));
    }
    const view = await mount();
    const first = (await saved())!.ids;
    await toQuestions(view);
    await finishQuestions(view);
    await press(view, 'practice-again');
    const second = (await saved())!.ids;
    expect(second).toHaveLength(5);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
    view.unmount();

    // the next day: the saved round is of an earlier day, the new text still avoids its words
    await getDb().setPracticeRound(JSON.stringify({ ...(await saved())!, date: '2000-01-01' }));
    const nextDay = await mount();
    const third = (await saved())!;
    expect(third.date).toBe(TODAY);
    expect(third.ids.filter((id) => second.includes(id))).toEqual([]);
    nextDay.unmount();
  });
});

describe('Practice tab: the round survives leaving the tab and the app', () => {
  it('a started round is saved at once: the words, the questions, the text step, nothing answered', async () => {
    await learnWords();
    const view = await mount();
    const round = (await saved())!;
    expect(round).toMatchObject({ v: 2, date: TODAY, target: 'es', ids: DUE, step: 0, picks: [null, null, null, null, null] });
    expect(round.qs).toHaveLength(5);
    view.unmount();
  });

  it('every step is saved: question n, the answer, the sentences step', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    expect(await saved()).toMatchObject({ step: 1, picks: [null, null, null, null, null] });
    const q = (await questions())[0];
    await answer(view, 1, false);
    expect(await saved()).toMatchObject({ step: 1, picks: [(q.correct + 1) % optionCount(q), null, null, null, null] });
    await next(view);
    expect(await saved()).toMatchObject({ step: 2 });
    view.unmount();
  });

  it('on the text and re-mounted: the same text, even if a fresh round would pick different words', async () => {
    await learnWords();
    const first = await mount();
    const before = (await saved())!;
    first.unmount();
    // a fresh round would now start with o33, the longest overdue
    await getDb().upsertPcicCard(learned('o33', '1999-01-01'));
    const second = await mount();
    expect((await saved())!).toEqual(before);
    expect(second.getByTestId('practice-word-0').props.children).toBe('casa');
    second.unmount();
  });

  it('on question 3 and re-mounted: the same question, the earlier answers kept', async () => {
    await learnWords();
    const first = await mount();
    await toQuestions(first);
    await answer(first, 1);
    await next(first);
    await answer(first, 2, false);
    await next(first);
    const q3 = (await questions())[2];
    first.unmount();

    const second = await mount();
    expect(second.getByText('3/5')).toBeTruthy();
    if (q3.kind === 'meaning') expect(second.getByText(`What does “${q3.word}” mean in the text?`)).toBeTruthy();
    else expect(second.getByTestId('practice-statement').props.children).toBe(q3.statement);
    expect(second.queryByText('Next →')).toBeNull();
    const q1 = (await questions())[0];
    expect((await saved())!.picks.slice(0, 2)).toEqual([q1.correct, expect.any(Number)]);
    second.unmount();
  });

  it('a question answered before the break comes back answered (feedback and Next), and Next moves on', async () => {
    await learnWords();
    const first = await mount();
    await toQuestions(first);
    await answer(first, 1, false);
    first.unmount();

    const second = await mount();
    expect(second.getByText('1/5')).toBeTruthy();
    expect(second.getByText('Wrong')).toBeTruthy();
    expect(second.getByText('Next →')).toBeTruthy();
    await next(second);
    expect(second.getByText('2/5')).toBeTruthy();
    second.unmount();
  });

  it('on the sentences step and re-mounted: the step and its button come back', async () => {
    await learnWords();
    const first = await mount();
    await toQuestions(first);
    await finishQuestions(first);
    first.unmount();

    const second = await mount();
    expect(second.getByText('Questions done')).toBeTruthy();
    await press(second, 'practice-sentences');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/sentences', params: { focus: DUE.join(',') } });
    second.unmount();
  });

  it('a new day starts a new round: the saved one is replaced', async () => {
    await learnWords();
    const first = await mount();
    await toQuestions(first);
    first.unmount();
    const old = (await saved())!;
    await getDb().setPracticeRound(JSON.stringify({ ...old, date: '2000-01-01' }));

    const second = await mount();
    expect(second.getByText('Read aloud')).toBeTruthy();
    expect(await saved()).toMatchObject({ date: TODAY, step: 0 });
    second.unmount();
  });

  it('an old missing-word round (v1), a broken value, another direction or a word that is gone: a new round, no error', async () => {
    await learnWords();
    const v1 = { v: 1, date: TODAY, target: 'es', ids: ['o19'], index: 1, results: ['right'] };
    const other = { v: 2, date: TODAY, target: 'en', ids: DUE, qs: [{ kind: 'truefalse', sourceId: 'o19' }], step: 0, picks: [null] };
    const gone = { v: 2, date: TODAY, target: 'es', ids: ['o19', 'o9999'], qs: [{ kind: 'truefalse', sourceId: 'o19' }], step: 0, picks: [null] };
    for (const raw of [JSON.stringify(v1), '{broken', JSON.stringify(other), JSON.stringify(gone)]) {
      await getDb().setPracticeRound(raw);
      const view = await mount();
      expect(view.getByText('Read aloud')).toBeTruthy();
      expect((await saved())!.ids).toEqual(DUE);
      view.unmount();
    }
  });
});

describe('Practice tab: feedback button', () => {
  it('the floating feedback button is on the text, a question, the sentences step and the empty state, with the screen id', async () => {
    const empty = await mount();
    expect(empty.getByText('💬')).toBeTruthy();
    empty.unmount();

    await learnWords();
    const view = await mount();
    const send = async (expected: string) => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as never);
      fireEvent.press(view.getByText('💬'));
      fireEvent.changeText(view.getByPlaceholderText('Share your thoughts...'), 'nice');
      await act(async () => {
        fireEvent.press(view.getByText('Send'));
      });
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('currentCard')).toContain(expected);
      expect(params.get('languagePair')).toBe('en-es');
      // @ts-expect-error test-only cleanup of a global set above
      delete global.fetch;
    };
    expect(view.getByLabelText('Feedback')).toBeTruthy();
    await send('practice-reading');

    await toQuestions(view);
    expect(view.getByLabelText('Feedback')).toBeTruthy();
    await send('practice:q1');

    await answer(view, 1);
    await next(view);
    await send('practice:q2');
    for (let n = 2; n <= 5; n++) {
      await answer(view, n);
      await next(view);
    }
    expect(view.getByText('Questions done')).toBeTruthy();
    expect(view.getByLabelText('Feedback')).toBeTruthy();
    view.unmount();
  });
});

describe('Practice tab: the daily streak', () => {
  const YESTERDAY = addDays(TODAY, -1);
  beforeEach(() => (getDb() as any).__setStreakForTest({ current_count: 4, last_date: YESTERDAY, longest_count: 4 }));

  it('the first answered question counts the day (reading the text does not); a second round the same day adds nothing', async () => {
    await learnWords();
    const view = await mount();
    await toQuestions(view);
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
    await answer(view, 1);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: TODAY, longest_count: 5 });
    await next(view);
    for (let n = 2; n <= 5; n++) {
      await answer(view, n);
      await next(view);
    }
    await press(view, 'practice-again');
    await toQuestions(view);
    await answer(view, 1);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: TODAY, longest_count: 5 });
    view.unmount();
  });
});
