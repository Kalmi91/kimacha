// FB187: a két diktálós játék végigjátszása. A felolvasót kimockoljuk (a jest-ben
// nincs hang), és a teszt azt gyakorolja, ami eszközön a hangot követi: beírás →
// ellenőrzés → tovább, tíz körön át, a végén pontszámmal. A kérdéseket ugyanaz a
// generátor adja, mint a képernyőnek, rögzített maggal, tehát tudjuk a választ
// anélkül, hogy a képernyőről kellene leolvasni.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/games/number-dictation',
}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  // Egy spanyol hang: így a képernyő ugyanazon az ágon fut, mint telefonon,
  // és nem az írásos tartalék-sávot mutatja.
  getAvailableVoicesAsync: jest.fn(async () => [{ language: 'es-MX', identifier: 'es-mx-1' }]),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { setLanguage } from '@/lib/i18n';
import { buildDictationItem, canonicalAnswer } from '@/lib/games/dictation';
import { flushAsync } from '../../../testing/gameTestUtils';
import DateDictationScreen from '../date-dictation';
import NumberDictationScreen from '../number-dictation';

const SEED = 4242;

describe('dictation games', () => {
  beforeEach(async () => {
    setLanguage('hu');
    // A kör magja Math.random()-ból jön; rögzítve tudjuk, mit fog kérdezni.
    jest.spyOn(Math, 'random').mockReturnValue(SEED / 100000);
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.updateLevel('A1', 0, 0, 0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks ten Spanish numbers and scores every right answer', async () => {
    render(<NumberDictationScreen />);
    await flushAsync(4);

    for (let i = 0; i < 10; i++) {
      const item = buildDictationItem('number', SEED + i, 100);
      expect(screen.getByText(`${i + 1}/10`)).toBeTruthy();

      fireEvent.changeText(screen.getByPlaceholderText('Írd be, amit hallottál'), String((item as { value: number }).value));
      fireEvent.press(screen.getByText('Ellenőrzés'));
      await flushAsync(1);
      expect(screen.getByText('Megvan!')).toBeTruthy();
      fireEvent.press(screen.getByText('Tovább'));
      await flushAsync(1);
    }

    expect(screen.getByText('10 / 10 találat')).toBeTruthy();
  });

  it('accepts a digit-only answer for a spoken Spanish date', async () => {
    render(<DateDictationScreen />);
    await flushAsync(4);

    const item = buildDictationItem('date', SEED, 100) as { day: number; month: number; spoken: string };

    // Kálmán döntése: „mindegyiket fogadja el" — itt a legrövidebb alak megy be.
    fireEvent.changeText(screen.getByPlaceholderText('Írd be, amit hallottál'), `${item.day}.${item.month}`);
    fireEvent.press(screen.getByText('Ellenőrzés'));
    await flushAsync(1);
    expect(screen.getByText('Megvan!')).toBeTruthy();
  });

  it('shows both the digits and the spoken form after a miss', async () => {
    render(<DateDictationScreen />);
    await flushAsync(4);

    const item = buildDictationItem('date', SEED, 100);
    fireEvent.changeText(screen.getByPlaceholderText('Írd be, amit hallottál'), 'nem ez');
    fireEvent.press(screen.getByText('Ellenőrzés'));
    await flushAsync(1);

    expect(screen.getByText(canonicalAnswer(item))).toBeTruthy();
  });
});
