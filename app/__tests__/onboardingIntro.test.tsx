// The new steps of the onboarding. Order: language -> welcome -> intro ("How it works")
// -> theme (5 recommended) -> level. The intro has no Skip button, the first (encouraging) point and the closing line are visible.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';

import { ONBOARDING_SKINS } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
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

async function toIntro(lang: 'English' | 'Español' = 'English') {
  render(<ThemeProvider><OnboardingScreen /></ThemeProvider>);
  await flush();
  fireEvent.press(screen.getByText(lang));
  fireEvent.press(screen.getByTestId('onboarding-start'));
}

describe('Onboarding: intro + theme step', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => {
    scheme.mockRestore();
    setLanguage('en');
  });

  it('"Get started" leads to the intro: title, encouraging first point, list, highlighted "Don\'t overdo it", closing line', async () => {
    await toIntro();
    expect(screen.getByText('How it works')).toBeTruthy();
    expect(screen.getByTestId('intro-first')).toBeTruthy();
    expect(
      screen.getByText('Learning a language is a long, hard road. There will be tough days, but everyone can do it, and so can you.'),
    ).toBeTruthy();
    expect(screen.getByText('Words: on cards, a small batch every day.')).toBeTruthy();
    expect(screen.getByText('Grammar: short lessons where you build sentences.')).toBeTruthy();
    expect(screen.getByText('Then an exam: show what you know.')).toBeTruthy();
    expect(screen.getByText("Repetition is the key: a word comes back right when you're about to forget it.")).toBeTruthy();
    expect(screen.getByTestId('intro-overdo')).toBeTruthy();
    expect(screen.getByTestId('intro-closing')).toBeTruthy();
    expect(screen.getByText("Every day you'll know a little more than yesterday.")).toBeTruthy();
    expect(screen.getByText("Let's start")).toBeTruthy();
  });

  it('no Skip button on the intro (neither in English nor in Spanish)', async () => {
    await toIntro();
    expect(screen.queryByText(/skip|kihagy|omitir|saltar/i)).toBeNull();
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
  });

  it('the intro exists in Spanish too, without ¿ ¡', async () => {
    await toIntro('Español');
    expect(screen.getByText('Así funciona')).toBeTruthy();
    expect(screen.getByText('Cada día vas a saber un poquito más que ayer.')).toBeTruthy();
    expect(screen.getByText('Empecemos')).toBeTruthy();
    const texts = JSON.stringify(screen.toJSON());
    expect(texts).not.toContain('¿');
    expect(texts).not.toContain('¡');
  });

  it('"Let\'s start" leads to the theme step, not straight to the level', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    expect(screen.getByTestId('onboarding-theme')).toBeTruthy();
    expect(screen.queryByText('Choose level')).toBeNull();
    expect(screen.getByText('Later you can pick from 24 in Settings.')).toBeTruthy();
  });

  it('the theme step shows exactly the 5 recommended rows, with the sample word and the "I know" pill', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    for (const id of ONBOARDING_SKINS) expect(screen.getByTestId(`onboarding-theme-${id}`)).toBeTruthy();
    expect(screen.queryByTestId('onboarding-theme-kawaii')).toBeNull();
    expect(screen.getAllByText('el carro')).toHaveLength(5);
    expect(screen.getAllByText('I know')).toHaveLength(5);
  });

  it('every theme row also shows the theme name under the sample word', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    for (const id of ONBOARDING_SKINS) {
      expect(screen.getByTestId(`onboarding-theme-name-${id}`).props.children).toBe(t().skins.names[id]);
    }
  });

  it('on the Spanish UI the sample word is "the car", the pill is "Lo sé"', async () => {
    await toIntro('Español');
    fireEvent.press(screen.getByText('Empecemos'));
    expect(screen.getAllByText('the car')).toHaveLength(5);
    expect(screen.getAllByText('Lo sé')).toHaveLength(5);
    expect(screen.getByText('Después puedes elegir entre 24 en Ajustes.')).toBeTruthy();
  });

  it('every row is drawn with its own theme font and background', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    const fonts = screen.getAllByText('el carro').map((n) => RN.StyleSheet.flatten(n.props.style).fontFamily);
    // ONBOARDING_SKINS order: ukiyoe, csillampony, szocreal, brutal, deco
    // the brutal row's word font is null = today's system font, so there is no fontFamily
    expect(fonts).toEqual(['Spectral-Light', 'Fredoka-Medium', 'Playfair-Black', undefined, 'PoiretOne']);
  });

  it('on tap the theme is saved immediately (setSkin), the selected row is marked', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    expect(screen.getByTestId('onboarding-theme-brutal').props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(screen.getByTestId('onboarding-theme-csillampony'));
    await flush();
    expect(await getDb().getSkin()).toBe('csillampony');
    expect(screen.getByTestId('onboarding-theme-csillampony').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('onboarding-theme-brutal').props.accessibilityState).toMatchObject({ selected: false });

    fireEvent.press(screen.getByTestId('onboarding-theme-ukiyoe'));
    await flush();
    expect(await getDb().getSkin()).toBe('ukiyoe');
  });

  it('"Continue" leads to the level picker', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    fireEvent.press(screen.getByTestId('onboarding-theme-next'));
    expect(screen.getByText('Choose level')).toBeTruthy();
  });
});
