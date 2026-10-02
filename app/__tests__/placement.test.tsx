// PLAN-vizsga C. szakasz (Kálmán, 2026-10-01, C1-C4): az adaptív szintfelmérő képernyője. A
// kérdés-építő itt egyszerű, ismert kérdéseket ad (a tartalmukat a lib/exam/__tests__ fedi), a
// lépcsőt és a mentést a valódi modulok végzik. Mock-minta: app/__tests__/exam.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
}));

// Páratlan helyen (a lépcsőn belül 1, 3) nyelvtani, különben szó-kérdés. A szó-kérdés azonosítója
// a sorszámból jön (o100, o102, ...), a jó válasz mindig a 0. opció.
jest.mock('@/lib/exam/placementQuestions', () => ({
  ...jest.requireActual('@/lib/exam/placementQuestions'),
  buildPlacementQuestion: (input: { level: string; position: number; used: Set<string> }) =>
    input.position % 2 === 1
      ? { kind: 'gap', level: input.level, topicId: 'presente-regular', itemId: `g${input.used.size}`, sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 }
      : { kind: 'word', level: input.level, itemId: `o${100 + input.used.size}`, word: 'la ventana', options: ['the window', 'the door', 'the wall', 'the roof'], correctIndex: 0 },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import PlacementScreen from '../placement';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

type Screen = ReturnType<typeof render>;

const press = async (screen: Screen, testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

/** Végigmegy a kérdéseken: a `right(n)` dönti el, hogy az n. kérdésre (0-tól) jó válasz megy-e. */
const play = async (screen: Screen, right: (n: number) => boolean) => {
  for (let n = 0; n < 40 && screen.queryByTestId('placement-dont-know'); n++) {
    await press(screen, right(n) ? 'placement-option-0' : 'placement-dont-know');
  }
};

const cardsById = async () => new Map((await getDb().getPcicCards()).map((c) => [c.itemId, c]));

describe('PlacementScreen (onboarding: még nincs mentett irány)', () => {
  it('"Start at" az onboardingban rögzíti az irányt és a szintet, és a fülekre lép (C1 a)', async () => {
    const screen = render(<PlacementScreen />);
    await flush();
    await play(screen, () => true);

    expect(screen.getByTestId('placement-result').props.children).toBe('Suggested start: B2');
    // C3 b: a 9 helyesen megválaszolt szó tudott lett (üres adatbázison az összes új graduál).
    expect(screen.getByTestId('placement-known').props.children).toBe('9 words you already know will not come back as new.');
    await press(screen, 'placement-start');

    expect(await getDb().getOnboarding()).toEqual({ source: 'en', target: 'es' });
    expect(await getDb().getPcicLevel()).toBe('B2');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('PlacementScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  it('A2-ről indul; kérdés-sorszám, négy szint-pont, szó-kérdés 4 válasszal + "I don\'t know" (C2 b)', async () => {
    const screen = render(<PlacementScreen />);
    await flush();

    expect(screen.getByTestId('placement-counter').props.children).toBe('Question 1');
    for (const level of ['A1', 'A2', 'B1', 'B2']) expect(screen.getByText(level)).toBeTruthy();
    expect(screen.getByTestId('placement-text').props.children).toBe('What does «la ventana» mean?');
    for (const i of [0, 1, 2, 3]) expect(screen.getByTestId(`placement-option-${i}`)).toBeTruthy();
    expect(screen.getByText("I don't know")).toBeTruthy();

    // A következő hely nyelvtan: lyukas mondat, a feladat felirata fölötte.
    await press(screen, 'placement-option-0');
    expect(screen.getByTestId('placement-counter').props.children).toBe('Question 2');
    expect(screen.getByText('Choose the word that fits')).toBeTruthy();
    expect(screen.getByTestId('placement-text').props.children).toBe('Yo ___ español.');
    // Nincs visszajelzés és nincs "Next": a következő kérdés azonnal jön.
    expect(screen.queryByTestId('exam-next')).toBeNull();
  });

  it('mind jó -> B2 15 kérdés után; a helyes szavak graduálnak, a nyelvtan-kérdés nem hoz kártyát (C3 b)', async () => {
    const screen = render(<PlacementScreen />);
    await flush();
    await play(screen, () => true);

    expect(screen.getByTestId('placement-result').props.children).toBe('Suggested start: B2');
    expect(screen.getByTestId('placement-breakdown').props.children).toBe('A2 5/5, B1 5/5, B2 5/5');

    // A 15 kérdésből a 0., 2., 4., 5., 7., 9., 10., 12., 14. szó-kérdés (o100 + sorszám).
    const cards = await cardsById();
    for (const n of [0, 2, 4, 5, 7, 9, 10, 12, 14]) {
      expect(cards.get(`o${100 + n}`)).toMatchObject({ state: 'review', interval: 1 });
    }
    expect(cards.size).toBeGreaterThanOrEqual(9);
  });

  it('mind rossz ("I don\'t know") -> A1 10 kérdés után; a szavak kártyái nem változnak', async () => {
    const before = await getDb().getPcicCards();
    const screen = render(<PlacementScreen />);
    await flush();
    await play(screen, () => false);

    expect(screen.getByTestId('placement-result').props.children).toBe('Suggested start: A1');
    expect(screen.getByTestId('placement-breakdown').props.children).toBe('A1 0/5, A2 0/5');
    expect(screen.queryByTestId('placement-known')).toBeNull();
    expect(await getDb().getPcicCards()).toEqual(before);
  });

  it('a javasolt szint felülírható: "Choose another level" a szint-sorokat mutatja, a koppintás menti és visszalép (C3)', async () => {
    const screen = render(<PlacementScreen />);
    await flush();
    await play(screen, () => true);

    expect(screen.queryByText('Elementary')).toBeNull();
    await press(screen, 'placement-choose');
    expect(screen.getByText('Beginner')).toBeTruthy();
    fireEvent.press(screen.getByText('Elementary'));
    await flush();

    expect(await getDb().getPcicLevel()).toBe('A2');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('"Start at" a mentett irányú felhasználónál a szintet menti és visszalép a tanulófülre', async () => {
    const screen = render(<PlacementScreen />);
    await flush();
    await play(screen, () => true);
    await press(screen, 'placement-start');

    expect(await getDb().getPcicLevel()).toBe('B2');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('"Take it again" új felmérést indít', async () => {
    const screen = render(<PlacementScreen />);
    await flush();
    await play(screen, () => false);
    await press(screen, 'placement-again');

    expect(screen.queryByTestId('placement-result')).toBeNull();
    expect(screen.getByTestId('placement-counter').props.children).toBe('Question 1');
  });

  it('kilépés (X) a megerősítés után visszalép, és semmi nem mentődik', async () => {
    const before = await getDb().getPcicCards();
    const levelBefore = await getDb().getPcicLevel();
    const screen = render(<PlacementScreen />);
    await flush();
    await press(screen, 'placement-option-0');
    await press(screen, 'placement-close');

    expect(screen.getByText('Leave the placement test')).toBeTruthy();
    await press(screen, 'placement-keep-going');
    expect(screen.getByTestId('placement-counter').props.children).toBe('Question 2');

    await press(screen, 'placement-close');
    await press(screen, 'placement-leave');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(await getDb().getPcicCards()).toEqual(before);
    expect(await getDb().getPcicLevel()).toBe(levelBefore);
  });
});
