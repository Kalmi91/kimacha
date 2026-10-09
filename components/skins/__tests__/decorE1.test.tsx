// the decorations and custom layouts of the loteria, senior, konnyu, retro95, y2k, kawaii, gamer, botanikus and zen themes:
// the slots draw the decoration around the base content, the button variants
// (senior stacked, retro95 3D + underlined first letter, zen text only) through BrutalButton / BrutalBox.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import fs from 'fs';
import path from 'path';

import { act, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import * as RN from 'react-native';
import { Text } from 'react-native';

import { BrutalBox, BrutalButton } from '@/components/grammar/Brutal';
import DockedAction from '@/components/learn/DockedAction';
import PcicRevealedAnswer from '@/components/learn/PcicRevealedAnswer';
import { SKIN_DECOR } from '@/components/skins';
import { PAPEL_PICADO, loteriaNumber } from '@/components/skins/loteria';
import { SkinBackdrop, SkinCardFrame, SkinHeader, SkinSpeakLabel, SkinWord } from '@/components/skins/Slots';
import Colors from '@/constants/Colors';
import { SKINS, type SkinId } from '@/constants/Skins';
import type { PcicItem } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import type { Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const flat = (style: unknown) => RN.StyleSheet.flatten(style as RN.StyleProp<RN.ViewStyle & RN.TextStyle>);

async function mountUi(skin: SkinId, ui: ReactElement) {
  await getDb().setSkin(skin);
  const view = render(<ThemeProvider>{ui}</ThemeProvider>);
  await flush();
  return view;
}

// The four slots side by side (as in decor.test.tsx), the base content stays around the decoration.
async function mountSkin(skin: SkinId, lang?: string) {
  const view = await mountUi(
    skin,
    <>
      <SkinBackdrop />
      <SkinHeader>
        <Text>fejlec</Text>
      </SkinHeader>
      <SkinCardFrame>
        <Text>kartya</Text>
      </SkinCardFrame>
      <SkinWord word="casa" lang={lang}>
        <Text>casa</Text>
      </SkinWord>
    </>,
  );
  expect(view.getByText('fejlec')).toBeTruthy();
  expect(view.getByText('kartya')).toBeTruthy();
  return view;
}

// The PCIC revealed-state block (Knew it / Didn't know button row) with minimal content.
async function mountGrades(skin: SkinId) {
  const item = { id: 'x-1', es: 'casa', en: 'house', kind: 'word', section: 's', order: 1 } as PcicItem;
  const card: Sm2Card = {
    itemId: 'x-1', state: 'learning', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0,
    due: '', lastReview: null, introducedAt: null,
  };
  return mountUi(
    skin,
    <PcicRevealedAnswer
      colors={Colors.light}
      s={t()}
      typedAnswer="casa"
      grade={{ match: 'exact', best: 'casa' }}
      nextGrade="good"
      current={card}
      currentItem={item}
      today="2026-10-01"
      target="es"
      onGrade={() => {}}
    />,
  );
}

const E1: SkinId[] = ['loteria', 'senior', 'konnyu', 'retro95', 'y2k', 'kawaii', 'gamer', 'botanikus', 'zen'];

describe('a 9 E1 téma díszei (PLAN-temak 6E)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
  });
  afterEach(async () => {
    scheme.mockRestore();
    await getDb().setSkin(null);
  });

  it('a regiszter a 9 témát tölti, mindegyiknek van legalább egy slotja vagy gomb-változata', () => {
    for (const id of E1) {
      const decor = SKIN_DECOR[id];
      expect(decor).toBeDefined();
      expect(Object.keys(decor ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('loteria: papel picado zászló-sor a spec színeivel, piros sorszám a lapon, a szó vonal fölött', async () => {
    const view = await mountSkin('loteria');
    expect(view.getByTestId('decor-loteria-flags')).toBeTruthy();
    expect(PAPEL_PICADO).toEqual(['#E4007C', '#FF8200', '#00A651', '#0072CE', '#FFD100']);
    expect(flat(view.getByTestId('decor-loteria-number').props.style).backgroundColor).toBe(SKINS.loteria.colors.light?.a);
    expect(view.getByTestId('decor-loteria-line')).toBeTruthy();
    expect(view.getByTestId('skin-loteria-frame')).toBeTruthy();
    view.unmount();
  });

  it('loteria: a lap sorszáma a szóból számolt (1-54), a kártya és a szó kontextuson át osztozik rajta', async () => {
    const view = await mountUi(
      'loteria',
      <SkinCardFrame>
        <SkinWord word="casa">
          <Text>casa</Text>
        </SkinWord>
      </SkinCardFrame>,
    );
    const n = loteriaNumber('casa');
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(54);
    expect(loteriaNumber('casa')).toBe(n);
    expect(view.getByTestId('decor-loteria-number').findByType(RN.Text).props.children).toBe(n);
    view.unmount();
  });

  it('senior: a push-gombok teljes szélességben, min. 48 magasan, ikonnal; a hang-gomb mellett "Read aloud"', async () => {
    const view = await mountUi(
      'senior',
      <>
        <BrutalButton testID="btn" label="Check" icon="✓" onPress={() => {}} />
        <SkinSpeakLabel />
      </>,
    );
    expect(flat(view.getByTestId('btn').props.style)).toMatchObject({ minHeight: 48 });
    expect(view.getByText('✓  Check')).toBeTruthy();
    expect(view.getByTestId('skin-speak-label').props.children).toBe('Read aloud');
    view.unmount();
  });

  it('senior: ha a felirat már tartalmazza az ikont (a dokkolt "✓ Check"), nincs dupla pipa', async () => {
    const view = await mountUi('senior', <BrutalButton testID="btn" label="✓ Check" icon="✓" onPress={() => {}} />);
    expect(view.getByText('✓ Check')).toBeTruthy();
    expect(view.queryByText('✓  ✓ Check')).toBeNull();
    view.unmount();
  });

  it('retro95: a dokkolt Check-sáv a spec szerint a-színű (sötétkék, fehér szöveg); a Neo-brutálon ink marad', async () => {
    const ui = <DockedAction label="✓ Check" tone="check" bottom={0} colors={Colors.light} onPress={() => {}} />;
    const retro = await mountUi('retro95', ui);
    const c = SKINS.retro95.colors.light!;
    expect(flat(retro.getByTestId('learn-docked-action').props.style).backgroundColor).toBe(c.a);
    expect(flat(retro.getByText('✓ Check').props.style).color).toBe(c.onA);
    retro.unmount();
    const brutal = await mountUi('brutal', ui);
    expect(flat(brutal.getByTestId('learn-docked-action').props.style).backgroundColor).not.toBe(c.a);
    brutal.unmount();
  });

  it('senior: a Neo-brutál téma gombja változatlan (nincs ikon, nincs min. 48), nincs hang-felirat', async () => {
    const view = await mountUi(
      'brutal',
      <>
        <BrutalButton testID="btn" label="Check" icon="✓" onPress={() => {}} />
        <SkinSpeakLabel />
      </>,
    );
    expect(flat(view.getByTestId('btn').props.style).minHeight).toBe(44);
    expect(view.getByText('Check')).toBeTruthy();
    expect(view.queryByTestId('skin-speak-label')).toBeNull();
    view.unmount();
  });

  it('konnyu: spanyol szónál a szótagok felváltva a / b színnel, alatta a "ca – rro" sor', async () => {
    const view = await mountUi(
      'konnyu',
      <SkinWord word="carro" lang="es">
        <Text>carro</Text>
      </SkinWord>,
    );
    const syllables = view.getAllByTestId('skin-konnyu-syllable');
    expect(syllables.map((s) => s.props.children)).toEqual(['ca', 'rro']);
    const { a, b } = SKINS.konnyu.colors.light!;
    expect(syllables.map((s) => flat(s.props.style).color)).toEqual([a, b]);
    expect(view.getByTestId('skin-konnyu-syllables').props.children).toBe('ca – rro');
    view.unmount();
  });

  it('konnyu: nem spanyol szónál (en, vagy nincs nyelv) az alap szó marad', async () => {
    for (const lang of ['en', undefined]) {
      const view = await mountSkin('konnyu', lang);
      expect(view.getByText('casa')).toBeTruthy();
      expect(view.queryByTestId('skin-konnyu-syllables')).toBeNull();
      view.unmount();
    }
  });

  it('konnyu: kifejezésnél minden spanyol szó szótagolt, a szótagszínezés folyamatos', async () => {
    const view = await mountUi(
      'konnyu',
      <SkinWord word="el carro" lang="es">
        <Text>el carro</Text>
      </SkinWord>,
    );
    expect(view.getAllByTestId('skin-konnyu-syllable').map((s) => s.props.children)).toEqual(['el', 'ca', 'rro']);
    expect(view.getByTestId('skin-konnyu-syllables').props.children).toBe('el   ca – rro');
    view.unmount();
  });

  it('retro95: "kimacha.exe" címsor-sáv x-gombbal, 3D-perem a dobozon, a gomb első betűje aláhúzva', async () => {
    const view = await mountUi(
      'retro95',
      <>
        <SkinHeader>
          <Text>fejlec</Text>
        </SkinHeader>
        <BrutalBox testID="box">
          <Text>kartya</Text>
        </BrutalBox>
        <BrutalButton label="Check" onPress={() => {}} />
      </>,
    );
    expect(view.getByText('kimacha.exe')).toBeTruthy();
    expect(view.getByText('fejlec')).toBeTruthy();
    const c = SKINS.retro95.colors.light!;
    expect(flat(view.getByTestId('decor-retro95-titlebar').props.style).backgroundColor).toBe(c.a);
    expect(view.getByTestId('decor-retro95-close')).toBeTruthy();
    expect(flat(view.getByTestId('box').props.style)).toMatchObject({
      borderTopColor: c.extra?.bevelLight,
      borderLeftColor: c.extra?.bevelLight,
      borderBottomColor: c.extra?.bevelDark,
      borderRightColor: c.extra?.bevelDark,
      borderWidth: 2,
    });
    expect(flat(view.getByText('C').props.style)).toMatchObject({ textDecorationLine: 'underline' });
    expect(view.getByText('Check')).toBeTruthy();
    view.unmount();
  });

  it('y2k: +8° matrica "new word", csillagok, streak-chip a valós sorozattal', async () => {
    await getDb().updateStreak();
    const view = await mountSkin('y2k');
    const sticker = view.getByTestId('decor-y2k-sticker');
    expect(flat(sticker.props.style).transform).toEqual([{ rotate: '8deg' }]);
    expect(flat(sticker.props.style).backgroundColor).toBe(SKINS.y2k.colors.light?.extra?.sticker);
    expect(view.getByText('new word')).toBeTruthy();
    expect(view.getAllByTestId('decor-y2k-star').length).toBeGreaterThanOrEqual(3);
    expect(view.getByText('🔥 1')).toBeTruthy();
    view.unmount();
  });

  it('kawaii: mosolygó arc a szó fölött, szív a fejlécben, a téma rózsaszín ikon-színével', async () => {
    const view = await mountSkin('kawaii');
    const icon = SKINS.kawaii.colors.light?.extra?.icon;
    expect(flat(view.getByTestId('decor-kawaii-face').props.style).borderColor).toBe(icon);
    expect(view.getByTestId('decor-kawaii-heart')).toBeTruthy();
    expect(flat(view.getByText('♥').props.style).color).toBe(icon);
    view.unmount();
  });

  it('gamer: XP-sáv "LVL n" a valós percekből, kombó "x1" streak nélkül, "+15 XP" a kártyán', async () => {
    for (let i = 0; i < 4; i++) await getDb().addUsageMinute();
    const view = await mountSkin('gamer');
    expect(view.getByTestId('skin-gamer-level').props.children.join('')).toBe('LVL 1');
    expect(flat(view.getByTestId('skin-gamer-xp-fill').props.style).width).toBe('40%');
    expect(view.getByTestId('skin-gamer-combo').props.children.join('')).toBe('x1');
    expect(view.getByText('+15 XP')).toBeTruthy();
    view.unmount();
  });

  it('botanikus: levél a fejlécben, növény a kártya sarkában (világos és sötét módban is)', async () => {
    for (const mode of ['light', 'dark'] as const) {
      scheme.mockReturnValue(mode);
      const view = await mountSkin('botanikus');
      expect(view.getByTestId('decor-botanikus-leaf')).toBeTruthy();
      expect(view.getByTestId('decor-botanikus-plant')).toBeTruthy();
      view.unmount();
    }
  });

  it('zen: piros pont a szó fölött (dot szín), rövid vonal alatta; sötét módban a sötét pont-szín', async () => {
    const view = await mountSkin('zen');
    expect(flat(view.getByTestId('decor-zen-dot').props.style).backgroundColor).toBe(SKINS.zen.colors.light?.extra?.dot);
    expect(view.getByTestId('decor-zen-line')).toBeTruthy();
    view.unmount();
    scheme.mockReturnValue('dark');
    const dark = await mountSkin('zen');
    expect(flat(dark.getByTestId('decor-zen-dot').props.style).backgroundColor).toBe(SKINS.zen.colors.dark?.extra?.dot);
    dark.unmount();
  });

  it('zen: a gombok csak szöveg (átlátszó, keret nélkül, ink szöveg), a "Tudom" (a kitöltés) aláhúzva', async () => {
    const view = await mountUi(
      'zen',
      <>
        <BrutalButton testID="know" fill="a" label="I know" onPress={() => {}} />
        <BrutalButton testID="check" label="Check" onPress={() => {}} />
      </>,
    );
    const ink = SKINS.zen.colors.light?.ink;
    expect(flat(view.getByTestId('know').props.style)).toMatchObject({ backgroundColor: 'transparent', borderWidth: 0 });
    expect(flat(view.getByText('I know').props.style)).toMatchObject({ color: ink, textDecorationLine: 'underline' });
    expect(flat(view.getByText('Check').props.style)).toMatchObject({ color: ink });
    expect(flat(view.getByText('Check').props.style).textDecorationLine).toBeUndefined();
    view.unmount();
  });

  it('senior: a Tudtam / Nem tudtam gombok egymás alatt, ikonnal, min. 48 magasan; a hang-gomb alatt "Read aloud"', async () => {
    const view = await mountGrades('senior');
    expect(view.getByText(`✓  ${t().pcic.good}`)).toBeTruthy();
    expect(view.getByText(`✗  ${t().pcic.again}`)).toBeTruthy();
    for (const gr of ['good', 'again']) {
      expect(flat(view.getByTestId(`pcic-grade-${gr}`).props.style)).toMatchObject({ minHeight: 48 });
    }
    // the row is a column: the two buttons' parent has column direction
    expect(flat(view.getByTestId('pcic-grades').props.style).flexDirection).toBe('column');
    expect(view.getAllByTestId('skin-speak-label').length).toBeGreaterThanOrEqual(1);
    view.unmount();
  });

  it('zen: a Tudtam gomb szövege aláhúzva, a gombok átlátszók; a Neo-brutál sor változatlan (sorban, ikon nélkül)', async () => {
    const zen = await mountGrades('zen');
    expect(flat(zen.getByText(t().pcic.good).props.style)).toMatchObject({ textDecorationLine: 'underline' });
    expect(flat(zen.getByText(t().pcic.again).props.style).textDecorationLine).toBeUndefined();
    expect(flat(zen.getByTestId('pcic-grade-good').props.style)).toMatchObject({ backgroundColor: 'transparent', borderWidth: 0 });
    zen.unmount();

    const brutal = await mountGrades('brutal');
    expect(brutal.getByText(t().pcic.good)).toBeTruthy();
    expect(brutal.queryByTestId('skin-speak-label')).toBeNull();
    expect(flat(brutal.getByTestId('pcic-grade-good').props.style).minHeight).toBeUndefined();
    expect(flat(brutal.getByTestId('pcic-grades').props.style).flexDirection).toBe('row');
    brutal.unmount();
  });

  it('az új díszek fájljai csak View / Text-et használnak: nincs SVG, expo-image vagy más natív függőség', () => {
    const dir = path.join(__dirname, '..');
    for (const file of ['loteria.tsx', 'senior.tsx', 'konnyu.tsx', 'retro95.tsx', 'y2k.tsx', 'kawaii.tsx', 'gamer.tsx', 'botanikus.tsx', 'zen.tsx']) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(src).not.toMatch(/react-native-svg|expo-image|expo-linear-gradient|lottie/);
    }
  });
});
