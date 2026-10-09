// The onboarding on the brutalist palette (language buttons as boxes), today's buttons on the classic
// palette. Mock pattern: onboarding.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import OnboardingScreen from '../onboarding';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Onboarding, neo-brutalista (NY19)', () => {
  it('brand palettán a nyelv- és start-gomb BrutalBox, a lépések működnek', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><OnboardingScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('onboarding-lang-es')).toBeTruthy();
    fireEvent.press(view.getByTestId('onboarding-lang-en'));
    expect(view.queryByTestId('onboarding-start')).toBeTruthy();
    fireEvent.press(view.getByTestId('onboarding-start'));
    // intro + theme step before the level.
    fireEvent.press(view.getByTestId('onboarding-intro-start'));
    fireEvent.press(view.getByTestId('onboarding-theme-next'));
    expect(view.queryByText('Choose level')).toBeTruthy();
    view.unmount();
  });

  it('classic palettán a mai kinézet: nincs BrutalBox gomb', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><OnboardingScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('onboarding-lang-en')).toBeNull();
    expect(view.queryByText('English')).toBeTruthy();
    view.unmount();
  });
});
