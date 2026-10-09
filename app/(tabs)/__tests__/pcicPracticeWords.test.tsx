// User feedback ("the game says there are 40 more words, why doesn't it serve them?"): the exam row of the level picker sheet
// shows how many words are missing ("N / M words learned, K to go"), but tapping "Practice words" gave
// no word at all once the daily budget was used up (on the active level the sheet just closed and the "done for today"
// screen stayed). Now it serves all the missing new words with one tap ("all at once"). Runs against the real words-open corpus. Mock pattern: pcicExamRow.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

import { act, fireEvent, render, within } from '@testing-library/react-native';

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { EXAM_PROGRESS_KEY } from '@/lib/exam/result';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { sm2NewCard, sm2Review } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import PcicScreen from '../index';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Tanulófül: a vizsga-sor "Practice words" gombja a hiányzó szavakból ad (FB499)', () => {
  const today = localDateString();

  // The daily budget (10) is used up: 10 A1 words introduced and learned (review) today, the queue is empty.
  beforeEach(async () => {
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicNewBonus(0, today);
    for (const item of pcicItemsForLevel('A1').slice(0, 10)) await getDb().upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', today));
    await getDb().setPcicLevel('A1');
  });

  it('keret kimerítve, az aktív A1 szinten: a koppintás után új szavak jönnek, nem a "kész mára" képernyő', async () => {
    const needed = Math.ceil(0.8 * pcicItemsForLevel('A1').length);
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('Done for today')).toBeTruthy();

    fireEvent.press(screen.getByText('A1 ▾'));
    await flush();
    expect(within(screen.getByTestId('exam-row-A1')).getByTestId('exam-row-words').props.children).toBe(
      `10 / ${needed} words learned, ${needed - 10} to go`,
    );

    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    expect(screen.queryByText('Done for today')).toBeNull();
    expect(screen.getByText(`new ${needed - 10}`)).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(needed - 10);
  });

  it('kevés hiányzó szó: pontosan annyit ad, amennyi hiányzik (3)', async () => {
    const ids = pcicItemsForLevel('A1').map((i) => i.id);
    const needed = Math.ceil(0.8 * ids.length);
    // 80% - 3 learned words (introduced on earlier days, due tomorrow), 10 introduced today (the budget is used up).
    for (const id of ids.slice(10, needed - 3)) {
      await getDb().upsertPcicCard({ ...sm2Review(sm2NewCard(id), 'good', today), introducedAt: '2026-10-01' });
    }
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByText('A1 ▾'));
    await flush();
    expect(within(screen.getByTestId('exam-row-A1')).getByTestId('exam-row-words').props.children).toBe(
      `${needed - 3} / ${needed} words learned, 3 to go`,
    );
    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    expect(screen.getByText('new 3')).toBeTruthy();
  });

  it('a lap vizsga-sora a menet közben tanult szavakat is számolja (nem a betöltéskori állapotot)', async () => {
    await getDb().resetPcicCards();
    const needed = Math.ceil(0.8 * pcicItemsForLevel('A1').length);
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByText("Don't learn this"));
    await flush();
    fireEvent.press(screen.getByText('A1 ▾'));
    await flush();
    expect(within(screen.getByTestId('exam-row-A1')).getByTestId('exam-row-words').props.children).toBe(
      `1 / ${needed} words learned, ${needed - 1} to go`,
    );
  });

  it('van még napi keret: a koppintás nem bővíti a keretet (a szint a szokásos napi adagot adja)', async () => {
    await getDb().resetPcicCards();
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('new 10')).toBeTruthy();
    fireEvent.press(screen.getByText('A1 ▾'));
    await flush();
    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    expect(screen.getByText('new 10')).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(0);
  });
});
