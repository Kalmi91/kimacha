// The Practice tab (beta): "missing word" in a sentence. Mock pattern: pcicSpeak.test.tsx (db, router,
// speech, safe area). recordPracticeResult is a call-through spy: the calls are asserted, and the real
// half-step logic still writes the card, so the SRS effect is checked on the stored card.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
jest.mock('@/lib/practice/halfStep', () => {
  const actual = jest.requireActual('@/lib/practice/halfStep');
  return { ...actual, recordPracticeResult: jest.fn(actual.recordPracticeResult) };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { __resetBetaForTest, setBeta } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { parsePracticeRound } from '@/lib/practice/practiceRound';
import { speak } from '@/lib/speech';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import PracticeScreen from '../practice';

jest.setTimeout(30000);

const mockRecord = recordPracticeResult as jest.Mock;
const mockSpeak = speak as jest.Mock;
const TODAY = localDateString();

// Real words-open cards: o33 ir "Voy con ella." (Voy), o47 hablar "Hablo con mi madre." (Hablo),
// o23 querer "Quiero una casa." (Quiero), o4 tú "Tú estás bien." (Tú).
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

const flush = async () => {
  for (let i = 0; i < 8; i++) {
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

const answer = async (view: View, text: string) => {
  fireEvent.changeText(view.getByTestId('practice-input'), text);
  fireEvent.press(view.getByTestId('practice-action'));
  await flush();
};
// A right answer moves on by itself after the short feedback.
const afterPause = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await flush();
};

beforeEach(async () => {
  jest.useFakeTimers();
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setStrictAccents(false);
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(TODAY, -100000);
  mockRecord.mockClear();
  mockSpeak.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage('en');
});

describe('Practice tab', () => {
  it('no learned word: the empty state, in English and Spanish', async () => {
    await getDb().upsertPcicCard(sm2NewCard('o33'));
    const view = await mount();
    expect(view.getByTestId('practice-empty')).toBeTruthy();
    expect(view.getByText('Learn some words first')).toBeTruthy();
    view.unmount();
    setLanguage('es');
    const es = await mount();
    expect(es.getByText('Aprende algunas palabras primero')).toBeTruthy();
    expect(es.getByText('Práctica')).toBeTruthy();
    es.unmount();
  });

  it('shows the blanked sentence, the translation, the meaning tip, the progress and the labelled input', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    await getDb().upsertPcicCard(learned('o47', '2000-01-02'));
    const view = await mount();
    expect(view.getByText('Practice')).toBeTruthy();
    expect(view.getByText('1/2')).toBeTruthy();
    expect(view.getByTestId('practice-gap').props.children).toBe('_____');
    expect(view.getByText('I go with her.')).toBeTruthy();
    expect(view.getByText('Hint: to go')).toBeTruthy();
    expect(view.getByLabelText('Type the missing word')).toBeTruthy();
    // the screen reader gets the sentence with "blank", never the answer
    expect(view.getByTestId('practice-sentence').props.accessibilityLabel).toBe('blank con ella.');
    expect(view.getByText('✓ Check')).toBeTruthy();
    view.unmount();
  });

  it('Spanish UI: the labels are Spanish', async () => {
    setLanguage('es');
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    expect(view.getByText('✓ Comprobar')).toBeTruthy();
    expect(view.getByPlaceholderText('Palabra que falta')).toBeTruthy();
    expect(view.getByText('Pista: to go')).toBeTruthy();
    view.unmount();
  });

  it('2 right answers on 2 words: recordPracticeResult(id, "correct") twice, each word gets one half', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    await getDb().upsertPcicCard(learned('o47', '2000-01-02'));
    const view = await mount();

    await answer(view, 'voy');
    expect(mockRecord).toHaveBeenLastCalledWith('o33', 'correct');
    expect(view.getByText('Correct!')).toBeTruthy();
    await afterPause();
    expect(view.getByText('2/2')).toBeTruthy();
    expect(view.getByText('I talk with my mother.')).toBeTruthy();

    await answer(view, 'Hablo');
    expect(mockRecord).toHaveBeenLastCalledWith('o47', 'correct');
    expect(mockRecord.mock.calls.map((c) => c[1])).toEqual(['correct', 'correct']);
    await afterPause();

    // the round is over: score and the again button
    expect(view.getByText('Round done')).toBeTruthy();
    expect(view.getByText('2 of 2 right')).toBeTruthy();
    // each word got only one half so far: no SRS move yet
    expect((await getDb().getPcicCard('o33'))).toMatchObject({ halfSteps: 1, interval: 4, due: '2000-01-01' });
    view.unmount();
  });

  it('2 rounds of right answers on the same word: the second half moves it one step (the next due date grows)', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    await answer(view, 'Voy');
    await afterPause();
    fireEvent.press(view.getByTestId('practice-again'));
    await flush();
    await answer(view, 'Voy');
    await afterPause();
    const card = (await getDb().getPcicCard('o33'))!;
    expect(card.halfSteps).toBe(0);
    expect(card.interval).toBeGreaterThan(4);
    expect(card.due > addDays(TODAY, 4)).toBe(true);
    view.unmount();
  });

  it('2 wrong typed answers: recordPracticeResult(id, "wrongTyped") twice; the correct form is shown with a Next button', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    await getDb().upsertPcicCard(learned('o47', '2000-01-02'));
    const view = await mount();

    await answer(view, 'vas');
    expect(mockRecord).toHaveBeenLastCalledWith('o33', 'wrongTyped');
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(view.getByText('Correct: Voy')).toBeTruthy();
    expect(view.getByTestId('practice-gap').props.children).toBe('Voy');
    // no auto-advance after a wrong answer: it waits for Next
    await afterPause();
    expect(view.getByText('1/2')).toBeTruthy();
    fireEvent.press(view.getByText('Next →'));
    await flush();
    expect(view.getByText('2/2')).toBeTruthy();

    await answer(view, 'hablas');
    expect(mockRecord.mock.calls.map((c) => c[1])).toEqual(['wrongTyped', 'wrongTyped']);
    view.unmount();
  });

  it('2 wrong typed answers in a row on one word (two rounds): one step back', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    await answer(view, 'vas');
    fireEvent.press(view.getByText('Next →'));
    await flush();
    fireEvent.press(view.getByTestId('practice-again'));
    await flush();
    await answer(view, 'vas');
    const card = (await getDb().getPcicCard('o33'))!;
    expect(card).toMatchObject({ wrongStreak: 0, halfSteps: 0, interval: 2 });
    expect(card.due).toBe(addDays(TODAY, 2));
    view.unmount();
  });

  it('the accent follows the Settings switch: off forgives it, on does not', async () => {
    await getDb().upsertPcicCard(learned('o4', '2000-01-01'));
    const off = await mount();
    await answer(off, 'tu');
    expect(mockRecord).toHaveBeenLastCalledWith('o4', 'correct');
    off.unmount();

    await getDb().setStrictAccents(true);
    await getDb().setPracticeRound(null); // the first mount's answered round would be resumed
    mockRecord.mockClear();
    const on = await mount();
    await answer(on, 'tu');
    expect(mockRecord).toHaveBeenLastCalledWith('o4', 'wrongTyped');
    expect(on.getByText('Correct: Tú')).toBeTruthy();
    on.unmount();
  });

  it('an empty answer is not checked', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    fireEvent.press(view.getByTestId('practice-action'));
    await flush();
    expect(mockRecord).not.toHaveBeenCalled();
    expect(view.queryByText('Wrong')).toBeNull();
    view.unmount();
  });

  it('reads the whole sentence aloud after the answer, in Spanish', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    await answer(view, 'Voy');
    expect(mockSpeak).toHaveBeenCalledWith('Voy con ella.', 'es-MX');
    view.unmount();
  });

  it('beta xpV2 off (default): a right answer is a half, but earns no XP', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    await answer(view, 'Voy');
    expect(mockRecord).toHaveBeenLastCalledWith('o33', 'correct');
    expect(await getDb().getDailyXpTenths(TODAY)).toBe(0);
    view.unmount();
  });

  it('beta xpV2 on: a right answer earns 1 XP, 0.2 XP once the word has 3+ repetitions', async () => {
    await setBeta('xpV2', true);
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    await getDb().upsertPcicCard(learned('o47', '2000-01-02', { reps: 3 }));
    const view = await mount();
    await answer(view, 'Voy');
    expect(await getDb().getDailyXpTenths(TODAY)).toBe(10);
    await afterPause();
    await answer(view, 'Hablo');
    expect(await getDb().getDailyXpTenths(TODAY)).toBe(12);
    view.unmount();
  });

  it('beta xpV2 on: a wrong answer earns nothing', async () => {
    await setBeta('xpV2', true);
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    await answer(view, 'xyz');
    expect(mockRecord).toHaveBeenLastCalledWith('o33', 'wrongTyped');
    expect(await getDb().getDailyXpTenths(TODAY)).toBe(0);
    view.unmount();
  });
});

describe('Practice tab: feedback button', () => {
  it('the floating feedback button is on the tab (round, empty state and finished screen) and sends the tab id', async () => {
    await getDb().upsertPcicCard(sm2NewCard('o33'));
    const empty = await mount();
    expect(empty.getByText('💬')).toBeTruthy();
    empty.unmount();

    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const view = await mount();
    expect(view.getByLabelText('Feedback')).toBeTruthy();

    global.fetch = jest.fn().mockResolvedValue({ ok: true } as never);
    fireEvent.press(view.getByText('💬'));
    fireEvent.changeText(view.getByPlaceholderText('Share your thoughts...'), 'nice');
    await act(async () => {
      fireEvent.press(view.getByText('Send'));
    });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('currentCard')).toContain('practice-tab');
    expect(params.get('languagePair')).toBe('en-es');
    // @ts-expect-error test-only cleanup of a global set above
    delete global.fetch;

    await answer(view, 'Voy');
    await afterPause();
    expect(view.getByText('Round done')).toBeTruthy();
    expect(view.getByLabelText('Feedback')).toBeTruthy();
    view.unmount();
  });
});

describe('Practice tab: the word source', () => {
  it('due words first, then the ones learned in the last 7 days; a hand-known and an old not-due word stay out', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01', { known: true, introducedAt: addDays(TODAY, -2) })); // hand-known
    await getDb().upsertPcicCard(learned('o47', addDays(TODAY, 30), { introducedAt: addDays(TODAY, -8) })); // 8 days ago, not due
    await getDb().upsertPcicCard(learned('o23', addDays(TODAY, 30), { introducedAt: addDays(TODAY, -3) })); // 3 days ago, not due
    await getDb().upsertPcicCard(learned('o4', '2000-01-01')); // due
    const view = await mount();
    expect(view.getByText('1/2')).toBeTruthy();
    expect(view.getByText('You are fine.')).toBeTruthy(); // the due word first
    await answer(view, 'Tú');
    await afterPause();
    expect(view.getByText('I want a house.')).toBeTruthy(); // then the freshly learned one
    await answer(view, 'Quiero');
    expect(mockRecord.mock.calls.map((c) => c[0])).toEqual(['o4', 'o23']);
    view.unmount();
  });
});

describe('Practice tab: the round survives leaving the tab and the app', () => {
  const three = async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    await getDb().upsertPcicCard(learned('o47', '2000-01-02'));
    await getDb().upsertPcicCard(learned('o23', '2000-01-03'));
  };
  const saved = async () => parsePracticeRound(await getDb().getPracticeRound());

  it('a started round is saved at once: the task order (card ids), index 0, no result yet', async () => {
    await three();
    const view = await mount();
    expect(await saved()).toEqual({ v: 1, date: TODAY, target: 'es', ids: ['o33', 'o47', 'o23'], index: 0, results: [null, null, null] });
    view.unmount();
  });

  it('halfway through and re-mounted: the same index and the same order, even if a fresh round would be ordered differently', async () => {
    await three();
    const first = await mount();
    await answer(first, 'Voy');
    await afterPause();
    expect(first.getByText('2/3')).toBeTruthy();
    first.unmount();

    // a fresh round would now start with o23 (the longest overdue)
    await getDb().upsertPcicCard(learned('o23', '1999-01-01'));
    const second = await mount();
    expect(second.getByText('2/3')).toBeTruthy();
    expect(second.getByText('I talk with my mother.')).toBeTruthy();
    expect(second.getByText('✓ Check')).toBeTruthy();
    await answer(second, 'Hablo');
    await afterPause();
    expect(second.getByText('I want a house.')).toBeTruthy();
    second.unmount();
  });

  it('the right count of the round is kept: the score at the end covers the answers before the break', async () => {
    await three();
    const first = await mount();
    await answer(first, 'Voy');
    await afterPause();
    await answer(first, 'zzz');
    fireEvent.press(first.getByText('Next →'));
    await flush();
    first.unmount();
    const second = await mount();
    expect(second.getByText('3/3')).toBeTruthy();
    await answer(second, 'Quiero');
    await afterPause();
    expect(second.getByText('2 of 3 right')).toBeTruthy();
    second.unmount();
  });

  it('a task answered right before the break is not asked again and gives no second half or XP', async () => {
    await setBeta('xpV2', true);
    await three();
    const first = await mount();
    await answer(first, 'Voy'); // leaves before the short pause ends
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(await getDb().getDailyXpTenths(TODAY)).toBe(10);
    first.unmount();

    const second = await mount();
    expect(second.getByText('2/3')).toBeTruthy();
    expect(second.getByText('I talk with my mother.')).toBeTruthy();
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(await getDb().getDailyXpTenths(TODAY)).toBe(10);
    expect((await getDb().getPcicCard('o33'))).toMatchObject({ halfSteps: 1 });
    second.unmount();
  });

  it('a task answered wrong before the break comes back in its answered state: no second wrong, Next moves on', async () => {
    await three();
    const first = await mount();
    await answer(first, 'vas');
    expect(mockRecord).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = await mount();
    expect(second.getByText('1/3')).toBeTruthy();
    expect(second.getByText('Correct: Voy')).toBeTruthy();
    expect(second.queryByText('✓ Check')).toBeNull();
    fireEvent.press(second.getByText('Next →'));
    await flush();
    expect(second.getByText('2/3')).toBeTruthy();
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect((await getDb().getPcicCard('o33'))).toMatchObject({ wrongStreak: 1 });
    second.unmount();
  });

  it('a new day starts a new round: the saved one is replaced', async () => {
    await three();
    const first = await mount();
    await answer(first, 'Voy');
    await afterPause();
    first.unmount();
    const old = (await saved())!;
    await getDb().setPracticeRound(JSON.stringify({ ...old, date: '2000-01-01' }));

    const second = await mount();
    expect(second.getByText('1/3')).toBeTruthy();
    expect(await saved()).toMatchObject({ date: TODAY, index: 0, results: [null, null, null] });
    second.unmount();
  });

  it('the round ends: the saved round is deleted, and coming back starts a new one', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const first = await mount();
    expect(await saved()).not.toBeNull();
    await answer(first, 'Voy');
    await afterPause();
    expect(first.getByText('Round done')).toBeTruthy();
    expect(await getDb().getPracticeRound()).toBeNull();
    first.unmount();

    const second = await mount();
    expect(second.getByText('1/1')).toBeTruthy();
    expect(await saved()).toMatchObject({ index: 0, results: [null] });
    second.unmount();
  });

  it('the app dies right after the last right answer: it comes back on the finished screen, and the saved round is gone', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const first = await mount();
    await answer(first, 'Voy');
    first.unmount();
    expect(await saved()).toMatchObject({ index: 0, results: ['right'] });

    const second = await mount();
    expect(second.getByText('Round done')).toBeTruthy();
    expect(second.getByText('1 of 1 right')).toBeTruthy();
    expect(await getDb().getPracticeRound()).toBeNull();
    second.unmount();
  });

  it('a broken saved value, another direction or a word that is gone: a new round', async () => {
    await getDb().upsertPcicCard(learned('o33', '2000-01-01'));
    const other = { v: 1, date: TODAY, target: 'en', ids: ['o33'], index: 0, results: [null] };
    const gone = { v: 1, date: TODAY, target: 'es', ids: ['o33', 'o9999'], index: 1, results: ['right', null] };
    for (const raw of ['{broken', JSON.stringify(other), JSON.stringify(gone)]) {
      await getDb().setPracticeRound(raw);
      const view = await mount();
      expect(view.getByText('1/1')).toBeTruthy();
      view.unmount();
    }
  });
});
