// a charDiff-sor jelölései olvashatók minden témán (kihagyott betű: sötét szöveg a
// borostyánon; rossz betű: fehér, ha átmegy, egyedi betűnél sötét).

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';

import { SKINS, contrastRatio, textContrastMin, type SkinId } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import { useDiffStyles } from '@/lib/useDiffStyles';

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

function Probe() {
  const diff = useDiffStyles();
  return (
    <>
      <RN.Text testID="wrong" style={diff.wrong}>x</RN.Text>
      <RN.Text testID="missing" style={diff.missing}>o</RN.Text>
    </>
  );
}

async function styles(skin: SkinId) {
  await getDb().setSkin(skin);
  render(<ThemeProvider><Probe /></ThemeProvider>);
  await flush();
  return {
    wrong: RN.StyleSheet.flatten(screen.getByTestId('wrong').props.style),
    missing: RN.StyleSheet.flatten(screen.getByTestId('missing').props.style),
  };
}

describe('useDiffStyles (PLAN-temak 7H)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('classic: a rossz betű fehér marad (20 px félkövér nagy szöveg, 3,76:1), a kihagyotté sötét', async () => {
    const { wrong, missing } = await styles('classic');
    expect(wrong).toMatchObject({ backgroundColor: '#EF4444', color: '#FFFFFF' });
    expect(missing).toMatchObject({ backgroundColor: '#EAB308', textDecorationLine: 'underline' });
    expect(contrastRatio(missing.color as string, '#EAB308')).toBeGreaterThanOrEqual(4.5);
  });

  it('egyedi betűs téma (deco): a rossz betű szövege 4,5 felett, nem fehér', async () => {
    const { wrong } = await styles('deco');
    expect(wrong.color).not.toBe('#FFFFFF');
    expect(contrastRatio(wrong.color as string, '#EF4444')).toBeGreaterThanOrEqual(4.5);
  });

  it('textContrastMin: rendszer-betűn a 20 px félkövér nagy (3), egyedi betűn nem (4,5)', () => {
    expect(textContrastMin(SKINS.classic, 'body', 20, true)).toBe(3);
    expect(textContrastMin(SKINS.deco, 'body', 20, true)).toBe(4.5);
    expect(textContrastMin(SKINS.classic, 'body', 14, true)).toBe(4.5);
    expect(textContrastMin(SKINS.classic, 'body', 24, false)).toBe(3);
  });
});
