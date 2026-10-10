// The onboarding gets a level step after the welcome.
// This screen runs at all only on a fresh install
// (app/_layout.tsx decides based on getOnboarding()), so the
// "only a fresh install sees it" condition is the root layout's responsibility, not this
// screen's; here we test the screen's OWN steps (language choice -> welcome ->
// level choice). Mock pattern: app/(tabs)/__tests__/pcicSpeak.test.tsx.
// The language choice step was added before "Get started".

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args) },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import OnboardingScreen from '../onboarding';

describe('OnboardingScreen: language and level step', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('starts with language choice, both buttons shown under a bilingual title', () => {
    const { getByText } = render(<OnboardingScreen />);

    expect(getByText('Which language do you speak? / ¿Qué idioma hablas?')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
    expect(getByText('Español')).toBeTruthy();
  });

  it('"English" -> en→es: greeting, then the level picker after "Get started"', () => {
    const { getByText, queryByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('English'));

    expect(queryByText('Choose level')).toBeNull();
    fireEvent.press(getByText('Get started'));
    // After "Get started" come the intro and the theme step, only then the level.
    fireEvent.press(getByText("Let's start"));
    fireEvent.press(getByText('Continue'));

    expect(getByText('Choose level')).toBeTruthy();
    expect(getByText('A1')).toBeTruthy();
    expect(getByText('Beginner')).toBeTruthy();
    expect(getByText('A2')).toBeTruthy();
    expect(getByText('B1')).toBeTruthy();
    // B2 and C1 can also be chosen (words-open b2.json, c1.json).
    expect(getByText('B2')).toBeTruthy();
    expect(getByText('Upper intermediate')).toBeTruthy();
    expect(getByText('C1')).toBeTruthy();
    expect(getByText('Advanced')).toBeTruthy();
  });

  it('choosing the en→es level saves the onboarding + the PCIC level, and navigates to the tabs', async () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('English'));
    fireEvent.press(getByText('Get started'));
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
  it('on the level step, under the rows there is the placement-test entry, and it leads to the placement screen', () => {
    const { getByText, getByTestId } = render(<OnboardingScreen />);
    fireEvent.press(getByText('English'));
    fireEvent.press(getByText('Get started'));
    fireEvent.press(getByText("Let's start"));
    fireEvent.press(getByText('Continue'));

    expect(getByText('Elementary')).toBeTruthy();
    expect(getByText('Not sure? Take the 3-minute placement test')).toBeTruthy();
    fireEvent.press(getByTestId('placement-entry'));
    expect(mockPush).toHaveBeenCalledWith('/placement');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('"Español" -> es→en: Spanish greeting, the level picker offers A1, A2 and B1', () => {
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
    // es→en B2 and C1 are empty, the "0 items = we do not offer it" filter skips them.
    expect(queryByText('B2')).toBeNull();
    expect(queryByText('C1')).toBeNull();
  });

  it('choosing es→en A1 saves "es"/"en", always with level A1', async () => {
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
