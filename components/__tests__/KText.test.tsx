// KText applies the theme's font (title / word / body), size, letter spacing, line height and
// casing; the Classic theme (and the Neo-brutal body) is today's behaviour.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';

import { KText, Text } from '@/components/KText';
import type { SkinId } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

async function renderWithSkin(skin: SkinId, ui: React.ReactElement) {
  await getDb().setSkin(skin);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await flush();
}

const styleOf = (text: string) => RN.StyleSheet.flatten(screen.getByText(text).props.style);

describe('KText: the theme font on texts', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('it is also exported as Text', () => {
    expect(Text).toBe(KText);
  });

  it('classic: the style is untouched (same reference), no fontFamily', async () => {
    const style = { fontSize: 20, fontWeight: '700' as const };
    await renderWithSkin('classic', <KText variant="title" style={style}>cím</KText>);
    expect(screen.getByText('cím').props.style).toBe(style);
  });

  it('brutal: body, title and word are unchanged (the current system font)', async () => {
    await renderWithSkin(
      'brutal',
      <>
        <KText style={{ fontSize: 14, fontWeight: '500' }}>törzs</KText>
        <KText variant="title" style={{ fontSize: 24, fontWeight: '500' }}>cím</KText>
        <KText variant="word" style={{ fontSize: 32, fontWeight: '700' }}>szó</KText>
      </>,
    );
    expect(styleOf('törzs')).toEqual({ fontSize: 14, fontWeight: '500' });
    expect(styleOf('cím')).toEqual({ fontSize: 24, fontWeight: '500' });
    expect(styleOf('szó')).toEqual({ fontSize: 32, fontWeight: '700' });
  });

  it('deco: title UPPERCASE + letter spacing 3 + PoiretOne, body JosefinSans', async () => {
    await renderWithSkin(
      'deco',
      <>
        <KText variant="title" style={{ fontSize: 18, fontWeight: '600' }}>cím</KText>
        <KText style={{ fontSize: 14, fontWeight: '600' }}>törzs</KText>
      </>,
    );
    expect(styleOf('cím')).toEqual({ fontSize: 18, fontFamily: 'PoiretOne', letterSpacing: 3, textTransform: 'uppercase' });
    expect(styleOf('törzs')).toEqual({ fontSize: 14, fontFamily: 'JosefinSans' });
  });

  it('senior: font size 1.25x (text without a size from a base of 14), Atkinson', async () => {
    await renderWithSkin(
      'senior',
      <>
        <KText style={{ fontSize: 16 }}>törzs</KText>
        <KText>alap</KText>
      </>,
    );
    expect(styleOf('törzs')).toMatchObject({ fontSize: 20, fontFamily: 'Atkinson' });
    expect(styleOf('alap')).toMatchObject({ fontSize: 17.5, fontFamily: 'Atkinson' });
  });

  it('retro95: every font size +4 px, VT323', async () => {
    await renderWithSkin('retro95', <KText style={{ fontSize: 16, lineHeight: 20 }}>törzs</KText>);
    const st = styleOf('törzs');
    expect(st).toMatchObject({ fontSize: 20, fontFamily: 'VT323' });
    // the given line height grows in proportion to the size
    expect(st.lineHeight).toBeCloseTo(25);
  });

  it('memphis: title + word size 0.8x, body not', async () => {
    await renderWithSkin(
      'memphis',
      <>
        <KText variant="title" style={{ fontSize: 20 }}>cím</KText>
        <KText style={{ fontSize: 20 }}>törzs</KText>
      </>,
    );
    expect(styleOf('cím')).toMatchObject({ fontSize: 16, fontFamily: 'RubikMonoOne' });
    expect(styleOf('törzs')).toEqual({ fontSize: 20 });
  });

  it('konnyu: letter spacing 1.5 on all texts, line height 1.6 × font size, Lexend', async () => {
    await renderWithSkin('konnyu', <KText style={{ fontSize: 15 }}>törzs</KText>);
    expect(styleOf('törzs')).toMatchObject({ fontFamily: 'Lexend', letterSpacing: 1.5, lineHeight: 24 });
  });

  it('letter spacing only on title + word (display) when the theme is not "all": deco body gets no letter spacing', async () => {
    await renderWithSkin('deco', <KText style={{ fontSize: 14 }}>törzs</KText>);
    expect(styleOf('törzs').letterSpacing).toBeUndefined();
  });

  it('bauhaus: the title is lowercase', async () => {
    await renderWithSkin('bauhaus', <KText variant="title">cím</KText>);
    expect(styleOf('cím')).toMatchObject({ textTransform: 'lowercase', fontFamily: 'Jost-Bold' });
  });

  it('loteria: the word is UPPERCASE, the title is not', async () => {
    await renderWithSkin(
      'loteria',
      <>
        <KText variant="word">szó</KText>
        <KText variant="title">cím</KText>
      </>,
    );
    expect(styleOf('szó')).toMatchObject({ textTransform: 'uppercase' });
    expect(styleOf('cím').textTransform).toBeUndefined();
  });

  it("a fontFamily set explicitly in the style wins over the theme's", async () => {
    await renderWithSkin('deco', <KText variant="title" style={{ fontFamily: 'SpaceMono' }}>cím</KText>);
    expect(styleOf('cím').fontFamily).toBe('SpaceMono');
  });

  it('nested KText: the inner one sets no font / letter spacing of its own, but the fontWeight is dropped', async () => {
    await renderWithSkin(
      'deco',
      <KText variant="title" style={{ fontSize: 18 }}>
        <KText style={{ fontWeight: '700' }}>belső</KText>
      </KText>,
    );
    const inner = styleOf('belső');
    expect(inner.fontFamily).toBeUndefined();
    expect(inner.letterSpacing).toBeUndefined();
    expect(inner.textTransform).toBeUndefined();
    expect(inner.fontWeight).toBeUndefined();
  });
});
