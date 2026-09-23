// PLAN-play 10. lépés: az onboarding üdvözlés után egy szint-lépést kap
// (Kálmán döntése, s1 anki-ui-terv.html). Ez a screen csak új telepítésnél
// fut le egyáltalán (app/_layout.tsx a getOnboarding() alapján dönt), tehát
// az "csak új telepítés látja" feltétel a root-layout felelőssége, nem ezé a
// screené; itt a screen SAJÁT két lépését (üdvözlés -> szint-választás)
// teszteljük. Mock-minta: app/(tabs)/__tests__/pcicSpeak.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import OnboardingScreen from '../onboarding';

describe('OnboardingScreen: szint-lépés (PLAN-play 10)', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('üdvözléssel indul, a szint-választó csak a "Get Started" után jelenik meg', () => {
    const { getByText, queryByText } = render(<OnboardingScreen />);

    expect(queryByText('Choose level')).toBeNull();
    fireEvent.press(getByText('Get Started'));

    expect(getByText('Choose level')).toBeTruthy();
    expect(getByText('A1')).toBeTruthy();
    expect(getByText('Beginner')).toBeTruthy();
    expect(getByText('B2')).toBeTruthy();
    expect(getByText('Upper intermediate')).toBeTruthy();
  });

  it('egy szint kiválasztása menti az onboardingot + a PCIC szintet, és a fülekre navigál', async () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('Get Started'));

    await act(async () => {
      fireEvent.press(getByText('Elementary'));
      await Promise.resolve();
    });

    expect(await getDb().getOnboarding()).toEqual({ source: 'en', target: 'es' });
    expect(await getDb().getPcicLevel()).toBe('A2');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
