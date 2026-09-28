// PLAN-play 10. lépés: az onboarding üdvözlés után egy szint-lépést kap
// (Kálmán döntése, s1 anki-ui-terv.html). Ez a screen csak új telepítésnél
// fut le egyáltalán (app/_layout.tsx a getOnboarding() alapján dönt), tehát
// az "csak új telepítés látja" feltétel a root-layout felelőssége, nem ezé a
// screené; itt a screen SAJÁT lépéseit (nyelv-választás -> üdvözlés ->
// szint-választás) teszteljük. Mock-minta: app/(tabs)/__tests__/pcicSpeak.test.tsx.
// PLAN-ketiranyu 4. lépés (2026-09-28): a nyelv-választás lépés a jóváhagyott
// vázlat 1-3. pontja szerint bekerült a "Get Started" elé.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import OnboardingScreen from '../onboarding';

describe('OnboardingScreen: nyelv- és szint-lépés (PLAN-ketiranyu 4. lépés)', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('nyelv-választással indul, mindkét gomb kétnyelvű cím alatt látszik', () => {
    const { getByText } = render(<OnboardingScreen />);

    expect(getByText('Which language do you speak? / ¿Qué idioma hablas?')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
    expect(getByText('Español')).toBeTruthy();
  });

  it('"English" -> en→es: üdvözlés, majd a szint-választó a "Get Started" után', () => {
    const { getByText, queryByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('English'));

    expect(queryByText('Choose level')).toBeNull();
    fireEvent.press(getByText('Get Started'));

    expect(getByText('Choose level')).toBeTruthy();
    expect(getByText('A1')).toBeTruthy();
    expect(getByText('Beginner')).toBeTruthy();
    expect(getByText('B2')).toBeTruthy();
    expect(getByText('Upper intermediate')).toBeTruthy();
  });

  it('en→es szint kiválasztása menti az onboardingot + a PCIC szintet, és a fülekre navigál', async () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('English'));
    fireEvent.press(getByText('Get Started'));

    await act(async () => {
      fireEvent.press(getByText('Elementary'));
      await Promise.resolve();
    });

    expect(await getDb().getOnboarding()).toEqual({ source: 'en', target: 'es' });
    expect(await getDb().getPcicLevel()).toBe('A2');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('"Español" -> es→en: spanyol üdvözlés, a szint-választó csak A1-et kínálja, 50 szóval', () => {
    const { getByText, queryByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('Español'));

    expect(getByText('Empezar')).toBeTruthy();
    fireEvent.press(getByText('Empezar'));

    expect(getByText('Elige el nivel')).toBeTruthy();
    expect(getByText('A1')).toBeTruthy();
    expect(getByText('Principiante')).toBeTruthy();
    expect(queryByText('A2')).toBeNull();
    // D-A/5. lépés kész: az A1-nek már van 50 szava, a "még nincs szó" sor nem jelenik meg.
    expect(queryByText('Todavía no hay palabras.')).toBeNull();
  });

  it('es→en A1 kiválasztása "es"/"en"-t ment, mindig A1 szinttel', async () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('Español'));
    fireEvent.press(getByText('Empezar'));

    await act(async () => {
      fireEvent.press(getByText('A1'));
      await Promise.resolve();
    });

    expect(await getDb().getOnboarding()).toEqual({ source: 'es', target: 'en' });
    expect(await getDb().getPcicLevel()).toBe('A1');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
