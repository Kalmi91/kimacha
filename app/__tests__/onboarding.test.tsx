// The onboarding gets a level step after the welcome.
// This screen runs at all only on a fresh install
// (app/_layout.tsx decides based on getOnboarding()), so the
// "only a fresh install sees it" condition is the root layout's responsibility, not this
// screen's; here we test the screen's OWN steps (language choice -> welcome ->
// level choice). Mock pattern: app/(tabs)/__tests__/pcicSpeak.test.tsx.
// The language choice step was added before "Get Started".

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args) },
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
    // After "Get Started" come the intro and the theme step, only then the level.
    fireEvent.press(getByText("Let's start"));
    fireEvent.press(getByText('Continue'));

    expect(getByText('Choose level')).toBeTruthy();
    expect(getByText('A1')).toBeTruthy();
    expect(getByText('Beginner')).toBeTruthy();
    expect(getByText('A2')).toBeTruthy();
    expect(getByText('B1')).toBeTruthy();
    // B2 can also be chosen (words-open b2.json, 150 items).
    expect(getByText('B2')).toBeTruthy();
    expect(getByText('Upper intermediate')).toBeTruthy();
  });

  it('en→es szint kiválasztása menti az onboardingot + a PCIC szintet, és a fülekre navigál', async () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('English'));
    fireEvent.press(getByText('Get Started'));
    fireEvent.press(getByText("Let's start"));
    fireEvent.press(getByText('Continue'));

    await act(async () => {
      fireEvent.press(getByText('Elementary'));
      await Promise.resolve();
    });

    expect(await getDb().getOnboarding()).toEqual({ source: 'en', target: 'es' });
    expect(await getDb().getPcicLevel()).toBe('A2');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  // below the level rows a quiet entry point to the placement test; the rows stay.
  it('a szint-lépésen a sorok alatt ott a szintfelmérő-belépő, és a felmérő képernyőjére visz', () => {
    const { getByText, getByTestId } = render(<OnboardingScreen />);
    fireEvent.press(getByText('English'));
    fireEvent.press(getByText('Get Started'));
    fireEvent.press(getByText("Let's start"));
    fireEvent.press(getByText('Continue'));

    expect(getByText('Elementary')).toBeTruthy();
    expect(getByText('Not sure? Take the 3 minute placement test')).toBeTruthy();
    fireEvent.press(getByTestId('placement-entry'));
    expect(mockPush).toHaveBeenCalledWith('/placement');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('"Español" -> es→en: spanyol üdvözlés, a szint-választó A1-et, A2-t és B1-et kínálja', () => {
    const { getByText, queryByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('Español'));

    expect(getByText('Empezar')).toBeTruthy();
    fireEvent.press(getByText('Empezar'));
    fireEvent.press(getByText('Empecemos'));
    fireEvent.press(getByText('Continuar'));

    expect(getByText('Elige el nivel')).toBeTruthy();
    expect(getByText('A1')).toBeTruthy();
    expect(getByText('Principiante')).toBeTruthy();
    expect(getByText('A2')).toBeTruthy();
    // B1 = en/b1.json, so it is offered in the es→en direction too.
    expect(getByText('B1')).toBeTruthy();
    // A1 = en a0+a1, A2 = en a2, the "no words yet" row does not appear.
    expect(queryByText('Todavía no hay palabras.')).toBeNull();
    // es→en B2 is empty, the "0 items = we do not offer it" filter skips it.
    expect(queryByText('B2')).toBeNull();
  });

  it('es→en A1 kiválasztása "es"/"en"-t ment, mindig A1 szinttel', async () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('Español'));
    fireEvent.press(getByText('Empezar'));
    fireEvent.press(getByText('Empecemos'));
    fireEvent.press(getByText('Continuar'));

    await act(async () => {
      fireEvent.press(getByText('A1'));
      await Promise.resolve();
    });

    expect(await getDb().getOnboarding()).toEqual({ source: 'es', target: 'en' });
    expect(await getDb().getPcicLevel()).toBe('A1');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
