// FB499 ("azt írja a játék, hogy van még 40 szó, miért nem dobja fel?"): a szint-választó lap vizsga-sora
// kiírja, mennyi szó hiányzik ("N / M words learned, K to go"), a "Practice words" koppintás viszont a
// napi keret kimerülése után nem adott egy szót sem (az aktív szintnél a lap csak bezárult, a "kész mára"
// képernyő maradt). Most az összes hiányzó új szót adja egy koppintásra ("mindet egyszerre", Kálmán
// 2026-10-05). A valódi words-open korpusszal fut. Mock-minta: pcicExamRow.test.tsx.

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // A napi keret (10) ki van merítve: ma 10 A1 szó bevezetve és tanult (review), a sor üres.
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
    // 80% - 3 tanult szó (a korábbi napokon bevezetve, holnapra esedékes), ma bevezetve 10 (a keret kimerült).
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
