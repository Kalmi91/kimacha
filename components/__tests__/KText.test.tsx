// a KText a téma betűjét (title / word / body), méretét, betűközét, sormagasságát és
// kis-/nagybetűs formáját alkalmazza; a Klasszikus téma (és a Neo-brutál body) a mai viselkedés.

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

describe('KText: a téma betűje a szövegeken (PLAN-temak 4C)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('a Text néven is exportált', () => {
    expect(Text).toBe(KText);
  });

  it('classic: a stílus érintetlen (ugyanaz a referencia), nincs fontFamily', async () => {
    const style = { fontSize: 20, fontWeight: '700' as const };
    await renderWithSkin('classic', <KText variant="title" style={style}>cím</KText>);
    expect(screen.getByText('cím').props.style).toBe(style);
  });

  it('brutal: a body, a title és a word is változatlan (a mai rendszer-betű, PLAN-temak 6E 2a)', async () => {
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

  it('deco: title NAGYBETŰS + betűköz 3 + PoiretOne, body JosefinSans', async () => {
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

  it('senior: a betűméret 1,25-szörös (a mérettel nem rendelkező szöveg 14 alapról), Atkinson', async () => {
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

  it('retro95: minden betűméret +4 px, VT323', async () => {
    await renderWithSkin('retro95', <KText style={{ fontSize: 16, lineHeight: 20 }}>törzs</KText>);
    const st = styleOf('törzs');
    expect(st).toMatchObject({ fontSize: 20, fontFamily: 'VT323' });
    // a megadott sormagasság a mérettel arányosan nő
    expect(st.lineHeight).toBeCloseTo(25);
  });

  it('memphis: a cím + szó mérete 0,8-szoros, a body nem', async () => {
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

  it('konnyu: betűköz 1,5 minden szövegen, sormagasság 1,6 × betűméret, Lexend', async () => {
    await renderWithSkin('konnyu', <KText style={{ fontSize: 15 }}>törzs</KText>);
    expect(styleOf('törzs')).toMatchObject({ fontFamily: 'Lexend', letterSpacing: 1.5, lineHeight: 24 });
  });

  it('a betűköz csak a cím + szón (display), ha a téma nem "all": deco body nem kap betűközt', async () => {
    await renderWithSkin('deco', <KText style={{ fontSize: 14 }}>törzs</KText>);
    expect(styleOf('törzs').letterSpacing).toBeUndefined();
  });

  it('bauhaus: a cím kisbetűs', async () => {
    await renderWithSkin('bauhaus', <KText variant="title">cím</KText>);
    expect(styleOf('cím')).toMatchObject({ textTransform: 'lowercase', fontFamily: 'Jost-Bold' });
  });

  it('loteria: a szó NAGYBETŰS, a cím nem', async () => {
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

  it('a saját fontFamily a stílusban erősebb, mint a témáé', async () => {
    await renderWithSkin('deco', <KText variant="title" style={{ fontFamily: 'SpaceMono' }}>cím</KText>);
    expect(styleOf('cím').fontFamily).toBe('SpaceMono');
  });

  it('beágyazott KText: a belső nem állít saját betűt / betűközt, de a fontWeight elmarad', async () => {
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
