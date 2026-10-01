// NY19: az onboarding brutalista palettán (nyelv-gombok dobozként), classic
// palettán a mai gombok. Mock-minta: onboarding.test.tsx.

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
    // PLAN-temak 4C: bevezető + téma-lépés a szint előtt.
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
