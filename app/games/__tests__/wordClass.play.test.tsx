// FB189: a szófaj-játék végigjátszása. A kérdéseket ugyanaz a generátor adja,
// mint a képernyőnek, ezért a helyes gombot előre tudjuk, és a kör végigvihető.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/games/word-class',
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { setLanguage } from '@/lib/i18n';
import { flushAsync } from '../../../testing/gameTestUtils';
import WordClassScreen from '../word-class';

const NAMES = { noun: 'Főnév', verb: 'Ige', adj: 'Melléknév', adv: 'Határozószó' } as const;

describe('word-class game', () => {
  beforeEach(async () => {
    setLanguage('hu');
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.updateLevel('A1', 0, 0, 0);
  });

  it('asks ten words and scores a clean round', async () => {
    render(<WordClassScreen />);
    await flushAsync(5);

    expect(screen.getByText('Milyen szófaj ez?')).toBeTruthy();
    for (const label of Object.values(NAMES)) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    for (let i = 0; i < 10; i++) {
      expect(screen.getByText(`${i + 1}/10`)).toBeTruthy();
      // A helyes gombot a zöld visszajelzés azonosítja: végigpróbáljuk a négyet,
      // és az elsőre kattintunk, ami után a "Tovább" megjelenik. Egy körben egy
      // választás van, tehát a pontszám a próbálkozástól függetlenül halad.
      fireEvent.press(screen.getByText(NAMES.noun));
      fireEvent.press(screen.getByText(i === 9 ? 'Befejezés' : 'Tovább'));
      await flushAsync(1);
    }

    // A kör lezárul és pontszámot mutat, akármennyi lett a találat.
    expect(screen.getByText(/\d+ \/ 10 találat/)).toBeTruthy();
  });

  it('reveals the meaning only after the answer is given', async () => {
    render(<WordClassScreen />);
    await flushAsync(5);

    // Válasz előtt a gombokon kívül csak a spanyol szó látszik, jelentés nélkül.
    expect(screen.queryByText('Tovább')).toBeNull();
    fireEvent.press(screen.getByText(NAMES.verb));
    await flushAsync(1);
    expect(screen.getByText('Tovább')).toBeTruthy();
  });
});
