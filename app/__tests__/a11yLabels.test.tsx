// Accessibility: the icon-only back arrow of the sub-screens and the onboarding controls
// carry a role and a localized label (EN + ES). Mock pattern: themes.test.tsx, onboarding.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack }),
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: jest.fn() },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import { ONBOARDING_SKINS } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import CreditsScreen from '../credits';
import OnboardingScreen from '../onboarding';
import ThemeMixScreen from '../theme-mix';
import ThemesScreen from '../themes';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('a11y: back arrow of the sub-screens', () => {
  afterEach(() => setLanguage('en'));

  const screens: [string, () => React.JSX.Element][] = [
    ['Credits', () => <CreditsScreen />],
    ['Themes', () => <ThemesScreen />],
    ['Theme mix', () => <ThemeMixScreen />],
  ];

  describe.each(['classic', 'brand'] as const)('palette %s', (palette) => {
    it.each(screens)('%s: the ← is a button named "Back" and goes back', async (_name, screen) => {
      await getDb().setGrammarPalette(palette);
      mockBack.mockClear();
      const view = render(<ThemeProvider>{screen()}</ThemeProvider>);
      await flush();
      const back = view.getByLabelText('Back');
      expect(back.props.accessibilityRole).toBe('button');
      fireEvent.press(back);
      expect(mockBack).toHaveBeenCalledTimes(1);
      view.unmount();
    });
  });

  it('Spanish UI: the label is "Atrás"', async () => {
    await getDb().setGrammarPalette('classic');
    setLanguage('es');
    const view = render(<ThemeProvider><CreditsScreen /></ThemeProvider>);
    await flush();
    expect(view.getByLabelText('Atrás')).toBeTruthy();
    expect(view.queryByLabelText('Back')).toBeNull();
    view.unmount();
  });
});

describe('a11y: onboarding controls', () => {
  afterEach(() => setLanguage('en'));

  it('language, start and theme controls are named buttons; a theme tile is named by its theme', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><OnboardingScreen /></ThemeProvider>);
    await flush();
    expect(view.getByRole('button', { name: 'English' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Español' })).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'English' }));
    fireEvent.press(view.getByRole('button', { name: 'Get started' }));
    fireEvent.press(view.getByRole('button', { name: "Let's start" }));
    // theme step: every tile is a button whose name is the theme's name, not the sample text.
    for (const id of ONBOARDING_SKINS) {
      const tile = view.getByTestId(`onboarding-theme-${id}`);
      expect(tile.props.accessibilityRole).toBe('button');
      expect(tile.props.accessibilityLabel).toBe(t().skins.names[id]);
    }
    expect(view.getByRole('button', { name: 'Continue' })).toBeTruthy();
    view.unmount();
  });
});
