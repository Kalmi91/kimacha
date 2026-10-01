// PLAN-temak 4C: az onboarding új lépései. Sorrend: nyelv -> üdvözlés -> bevezető ("How it works")
// -> téma (5 ajánlott) -> szint. A bevezetőn nincs Skip gomb, az első (biztató) pont és a zárósor látszik.

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

describe('Onboarding: bevezető + témás lépés (PLAN-temak 4C)', () => {
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

  it('a "Get Started" a bevezetőre visz: cím, biztató első pont, lista, kiemelt "Don\'t overdo it", zárósor', async () => {
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

  it('nincs Skip / Kihagyás gomb a bevezetőn (se angolul, se spanyolul)', async () => {
    await toIntro();
    expect(screen.queryByText(/skip|kihagy|omitir|saltar/i)).toBeNull();
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
  });

  it('a bevezető spanyolul is megvan, ¿ ¡ nélkül', async () => {
    await toIntro('Español');
    expect(screen.getByText('Así funciona')).toBeTruthy();
    expect(screen.getByText('Cada día vas a saber un poquito más que ayer.')).toBeTruthy();
    expect(screen.getByText('Empecemos')).toBeTruthy();
    const texts = JSON.stringify(screen.toJSON());
    expect(texts).not.toContain('¿');
    expect(texts).not.toContain('¡');
  });

  it('a "Let\'s start" a téma-lépésre visz, nem egyenesen a szintre', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    expect(screen.getByTestId('onboarding-theme')).toBeTruthy();
    expect(screen.queryByText('Choose level')).toBeNull();
    expect(screen.getByText('Later you can pick from 24 in Settings.')).toBeTruthy();
  });

  it('a téma-lépés pontosan az 5 ajánlott sort mutatja, a minta-szóval és a "tudom" pirulával', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    for (const id of ONBOARDING_SKINS) expect(screen.getByTestId(`onboarding-theme-${id}`)).toBeTruthy();
    expect(screen.queryByTestId('onboarding-theme-kawaii')).toBeNull();
    expect(screen.getAllByText('el carro')).toHaveLength(5);
    expect(screen.getAllByText('I know')).toHaveLength(5);
  });

  it('7F: minden téma-sorban a téma neve is látszik a minta-szó alatt', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    for (const id of ONBOARDING_SKINS) {
      expect(screen.getByTestId(`onboarding-theme-name-${id}`).props.children).toBe(t().skins.names[id]);
    }
  });

  it('spanyol felületen a minta-szó "the car", a pirula "Lo sé"', async () => {
    await toIntro('Español');
    fireEvent.press(screen.getByText('Empecemos'));
    expect(screen.getAllByText('the car')).toHaveLength(5);
    expect(screen.getAllByText('Lo sé')).toHaveLength(5);
    expect(screen.getByText('Después puedes elegir entre 24 en Ajustes.')).toBeTruthy();
  });

  it('minden sor a téma saját betűjével és hátterével rajzolódik', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    const fonts = screen.getAllByText('el carro').map((n) => RN.StyleSheet.flatten(n.props.style).fontFamily);
    // ONBOARDING_SKINS sorrendje: ukiyoe, csillampony, szocreal, brutal, deco
    // a brutal sor szó-betűje null = a mai rendszer-betű (PLAN-temak 6E 2a), ezért nincs fontFamily
    expect(fonts).toEqual(['Spectral-Light', 'Fredoka-Medium', 'Playfair-Black', undefined, 'PoiretOne']);
  });

  it('koppintásra a téma azonnal mentődik (setSkin), a kiválasztott sor jelölt', async () => {
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

  it('a "Continue" a szint-választóra visz', async () => {
    await toIntro();
    fireEvent.press(screen.getByText("Let's start"));
    fireEvent.press(screen.getByTestId('onboarding-theme-next'));
    expect(screen.getByText('Choose level')).toBeTruthy();
  });
});
