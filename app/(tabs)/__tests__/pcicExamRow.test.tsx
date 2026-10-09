// a tanulófül szint-választó lapján
// az A1 sor alatt ott a vizsga-sor, az SM-2 adatból és a kész leckékből számolva; a koppintás
// a vizsgára (nyitva), a szavak gyakorlására vagy a nyelvtani leckékre visz. A valódi
// words-open korpusszal fut (nem mockolt data/pcic). Mock-minta: pcicLevelPicker.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
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
import { seedA1ExamState, seedExamState, a1SeedCards } from '@/lib/exam/devSeed';
import { EXAM_PROGRESS_KEY } from '@/lib/exam/result';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import PcicScreen from '../index';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// A lap bezárul, és csak a kilépő animáció után (SHEET_CLOSE_MS) lép tovább a navigáció.
const afterSheetClose = async () => {
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
  await flush();
};

// A1-B2 mindegyik szint alatt van vizsga-sor, ezért a szint-sorok feliratai szintenként keresendők.
const a1 = (screen: ReturnType<typeof render>) => within(screen.getByTestId('exam-row-A1'));

const openSheet = async () => {
  const screen = render(<PcicScreen />);
  await flush();
  fireEvent.press(screen.getByText('A1 ▾'));
  await flush();
  return screen;
};

describe('Tanulófül: A1 vizsga-sor a szint-választó lapon', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    mockPush.mockClear();
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
    await getDb().resetGameProgress(EXAM_PROGRESS_KEY);
    await getDb().setPcicLevel('A1');
  });
  afterEach(() => jest.useRealTimers());

  it('haladás nélkül zárva: 0 / a szint 80%-a szó, és koppintásra nem indul vizsga', async () => {
    const needed = Math.ceil(0.8 * pcicItemsForLevel('A1').length);
    const screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-words').props.children).toBe(`0 / ${needed} words learned, ${needed} to go`);
    expect(a1(screen).getByText(/Finish one A1 grammar lesson/)).toBeTruthy();

    // "Practice words": a lap bezárul (az A1 pakli marad), vizsga nem indul.
    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
    await afterSheetClose();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('80% alatt (eggyel) még zárva, 80%-on és egy kész leckével nyitva', async () => {
    const ids = pcicItemsForLevel('A1').map((i) => i.id);
    const needed = Math.ceil(0.8 * ids.length);
    for (const c of a1SeedCards(ids, '2026-10-01').slice(0, needed - 1)) await getDb().upsertPcicCard(c);
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 1, total: 1 });
    let screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-words').props.children).toBe(`${needed - 1} / ${needed} words learned, 1 to go`);
    screen.unmount();

    for (const c of a1SeedCards(ids, '2026-10-01').slice(0, needed)) await getDb().upsertPcicCard(c);
    screen = await openSheet();
    expect(a1(screen).queryByTestId('exam-row-words')).toBeNull();
    expect(a1(screen).getByTestId('exam-row-ready')).toBeTruthy();
  });

  it('nyitva a koppintás a vizsga képernyőre visz az A1 szinttel, és a lap bezárul', async () => {
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    const screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-ready').props.children).toEqual(['Ready', '']);

    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    // A lap ELŐBB bezárul, a navigáció csak utána jön (különben a lap a vizsga fölött marad).
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    await afterSheetClose();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/exam', params: { level: 'A1' } });
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
  });

  it('4. lépés: A1-B2 mindegyik szint alatt van vizsga-sor; a nyitott A2-B2 saját szintjével indul', async () => {
    await seedExamState(getDb(), 'es', '2026-10-01');
    const screen = await openSheet();
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      expect(within(screen.getByTestId(`exam-row-${level}`)).getByTestId('exam-row-ready')).toBeTruthy();
    }

    fireEvent.press(screen.getByTestId('exam-row-B2'));
    await flush();
    await afterSheetClose();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/exam', params: { level: 'B2' } });
  });

  it('4. lépés: zárt A2 sor mutatja, mennyi hiányzik, és a "Practice words" az A2 paklit nyitja', async () => {
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    const screen = await openSheet();
    expect(within(screen.getByTestId('exam-row-A2')).getByTestId('exam-row-words').props.children).toBe(
      `0 / ${Math.ceil(pcicItemsForLevel('A2').length * 0.8)} words learned, ${Math.ceil(pcicItemsForLevel('A2').length * 0.8)} to go`,
    );
    fireEvent.press(screen.getByTestId('exam-row-A2'));
    await flush();
    await afterSheetClose();
    expect(mockPush).not.toHaveBeenCalled();
    expect(await getDb().getPcicLevel()).toBe('A2');
  });

  it('a mentett eredmény (átment, legjobb pontszám) megjelenik a nyitott soron', async () => {
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    await getDb().saveExamResult('A1', 90, true, '2026-10-01');
    const screen = await openSheet();
    expect(a1(screen).getByTestId('exam-row-ready').props.children).toEqual(['Ready', ' · Passed · best 90%']);
  });

  it('ha csak a lecke hiányzik, a koppintás a nyelvtani leckékre visz', async () => {
    const ids = pcicItemsForLevel('A1').map((i) => i.id);
    for (const c of a1SeedCards(ids, '2026-10-01')) await getDb().upsertPcicCard(c);
    const screen = await openSheet();
    expect(a1(screen).queryByTestId('exam-row-words')).toBeNull();

    fireEvent.press(screen.getByTestId('exam-row-A1'));
    await flush();
    expect(screen.queryByTestId('exam-row-A1')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    await afterSheetClose();
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/course');
  });
});
