// NY25: fejlécek brutalista palettán (bg háttér, 2,5 px ink alsó vonal, nagybetűs 500-as cím,
// vissza-nyíl BrutalBox-ban), classic palettán a mai fejléc.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { grammarColorsFor } from '@/lib/grammarColors';
import { brutalHeaderOptions, brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { ThemeProvider } from '@/lib/ThemeContext';
import CreditsScreen from '../credits';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Fejlécek, neo-brutalista (NY25)', () => {
  it('brutalHeaderOptions: brand palettán ink vonal + nagybetűs 500-as cím', () => {
    const g = grammarColorsFor('brand-light');
    const o = brutalHeaderOptions(g);
    expect(o.headerStyle).toMatchObject({ backgroundColor: g.bg, borderBottomWidth: 2.5, borderBottomColor: g.ink, elevation: 0, shadowOpacity: 0 });
    expect(o.headerTitleStyle).toMatchObject({ color: g.ink, fontWeight: '500', textTransform: 'uppercase' });
    expect(brutalHeaderRowStyle(g)).toMatchObject({ borderBottomWidth: 2.5, borderBottomColor: g.ink });
  });

  it('brutalHeaderOptions: classic palettán üres', () => {
    const g = grammarColorsFor('light');
    expect(brutalHeaderOptions(g)).toEqual({});
    expect(brutalHeaderRowStyle(g)).toBeNull();
  });

  it('Credits: brand palettán a vissza-nyíl BrutalBox, classic palettán nem', async () => {
    await getDb().setGrammarPalette('brand');
    const brand = render(<ThemeProvider><CreditsScreen /></ThemeProvider>);
    await flush();
    expect(brand.queryByTestId('credits-back')).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(<ThemeProvider><CreditsScreen /></ThemeProvider>);
    await flush();
    expect(classic.queryByTestId('credits-back')).toBeNull();
    classic.unmount();
  });
});
