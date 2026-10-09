// the decoration of the diszlexia, plakat, bauhaus, popart, szecesszio, kalocsai, memphis, kodex and
// graffiti themes: the slots draw the decoration around the base content (testIDs: decor- = pure decoration,
// skin- = an element wrapping content / showing real data), plain View/Text, no SVG.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import fs from 'fs';
import path from 'path';

import { act, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { Text } from 'react-native';

import { BrutalBox } from '@/components/grammar/Brutal';
import { SKIN_DECOR } from '@/components/skins';
import { previewTextStyle } from '@/components/skins/previewText';
import { SkinBackdrop, SkinCardFrame, SkinHeader, SkinWord } from '@/components/skins/Slots';
import { Text as KText } from '@/components/KText';
import { SKINS, type SkinId } from '@/constants/Skins';
import { getDb } from '@/lib/database';
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

async function mountSkin(skin: SkinId, extra?: React.ReactNode) {
  await getDb().setSkin(skin);
  const view = render(
    <ThemeProvider>
      <SkinBackdrop />
      <SkinHeader>
        <Text>fejlec</Text>
      </SkinHeader>
      <SkinCardFrame>
        <Text>kartya</Text>
      </SkinCardFrame>
      <SkinWord word="casa">
        <Text>casa</Text>
      </SkinWord>
      {extra}
    </ThemeProvider>,
  );
  await flush();
  // the header's and the card's base content always stays around the decoration
  for (const text of ['fejlec', 'kartya']) expect(view.getByText(text)).toBeTruthy();
  return view;
}

const light = (id: SkinId) => SKINS[id].colors.light!;

describe('a 9 E2 téma díszei (PLAN-temak 6E)', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
  });
  afterEach(async () => {
    scheme.mockRestore();
    await getDb().setSkin(null);
  });

  it('a regiszter a 9 témát tölti, mindegyiknek van legalább egy slotja', () => {
    for (const id of ['diszlexia', 'plakat', 'bauhaus', 'popart', 'szecesszio', 'kalocsai', 'memphis', 'kodex', 'graffiti'] as const) {
      const decor = SKIN_DECOR[id];
      expect(decor).toBeDefined();
      expect(Object.keys(decor ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('diszlexia: sárga olvasó-sáv a szó mögött (a szó megmarad), sötét módban a sötét sáv-szín', async () => {
    const view = await mountSkin('diszlexia');
    expect(view.getByText('casa')).toBeTruthy();
    expect(view.getByTestId('skin-diszlexia-word')).toBeTruthy();
    expect(flat(view.getByTestId('decor-diszlexia-band').props.style)).toMatchObject({
      backgroundColor: '#FFF2B0',
      left: 0,
      right: 0,
    });
    view.unmount();

    scheme.mockReturnValue('dark');
    const dark = await mountSkin('diszlexia');
    expect(flat(dark.getByTestId('decor-diszlexia-band').props.style).backgroundColor).toBe('#4A4128');
    dark.unmount();
  });

  it('plakat: -22°-os piros sáv, fekete kör, szlogen-csík megafonnal, a szó -6°-ban', async () => {
    const view = await mountSkin(
      'plakat',
      <>
        <KText variant="word">szo</KText>
        <KText>torzs</KText>
      </>,
    );
    const c = light('plakat');
    expect(flat(view.getByTestId('decor-plakat-stripe').props.style)).toMatchObject({
      backgroundColor: c.a,
      transform: [{ rotate: '-22deg' }],
    });
    expect(flat(view.getByTestId('decor-plakat-disc').props.style).backgroundColor).toBe(c.ink);
    expect(view.getByText('LEARN, LEARN, LEARN!')).toBeTruthy();
    expect(view.getByText('📣')).toBeTruthy();
    expect(flat(view.getByText('szo').props.style).transform).toEqual([{ rotate: '-6deg' }]);
    expect(flat(view.getByText('torzs').props.style)?.transform).toBeUndefined();
    // the My mix preview rotates the word too, the other themes do not
    expect(previewTextStyle(SKINS.plakat, 'word', 30).transform).toEqual([{ rotate: '-6deg' }]);
    expect(previewTextStyle(SKINS.plakat, 'body', 14).transform).toBeUndefined();
    expect(previewTextStyle(SKINS.bauhaus, 'word', 30).transform).toBeUndefined();
    view.unmount();
  });

  it('plakat: nincs sarló-kalapács és vörös csillag', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'plakat.tsx'), 'utf8');
    expect(src).not.toMatch(/☭|⚒|🔨|⭐|★|☆|✯|🌟|🚩/);
  });

  it('bauhaus: kör-négyzet-háromszög a fejléc fölött, sárga kör a sarokban (levágva), kék sáv balra', async () => {
    const view = await mountSkin('bauhaus');
    const c = light('bauhaus');
    expect(flat(view.getByTestId('decor-bauhaus-circle').props.style).backgroundColor).toBe(c.a);
    expect(flat(view.getByTestId('decor-bauhaus-square').props.style).backgroundColor).toBe(c.b);
    expect(flat(view.getByTestId('decor-bauhaus-triangle').props.style).borderBottomColor).toBe(c.c);
    expect(flat(view.getByTestId('decor-bauhaus-corner').props.style).overflow).toBe('hidden');
    expect(flat(view.getByTestId('decor-bauhaus-sun').props.style)).toMatchObject({ backgroundColor: c.c, borderRadius: 32 });
    expect(flat(view.getByTestId('decor-bauhaus-bar').props.style)).toMatchObject({ backgroundColor: c.b, left: 0, width: 10 });
    view.unmount();
  });

  it('popart: legfeljebb 150 Ben-Day pötty (a, 40%), buborék-farok a kártya bal alsó sarkán', async () => {
    const view = await mountSkin('popart');
    const c = light('popart');
    const dots = view.getAllByTestId('decor-popart-dot');
    expect(dots.length).toBeLessThanOrEqual(150);
    expect(dots.length).toBeGreaterThan(100);
    expect(flat(dots[0].props.style)).toMatchObject({ backgroundColor: c.a, opacity: 0.4 });
    expect(flat(view.getByTestId('decor-popart-tail-edge').props.style).borderTopColor).toBe(c.ink);
    expect(flat(view.getByTestId('decor-popart-tail-fill').props.style).borderTopColor).toBe(c.paper);
    expect(flat(view.getByTestId('decor-popart-tail').props.style).left).toBeLessThan(80);
    view.unmount();
  });

  it('szecesszió: 1 px-es b külső keret 3 px réssel (íves tető), virág a szó fölött és a cím két oldalán', async () => {
    const view = await mountSkin('szecesszio');
    const c = light('szecesszio');
    expect(flat(view.getByTestId('decor-szecesszio-outer').props.style)).toMatchObject({
      top: -4,
      left: -4,
      right: -4,
      bottom: -4,
      borderWidth: 1,
      borderColor: c.b,
      borderTopLeftRadius: 74,
      borderTopRightRadius: 74,
      borderBottomRightRadius: 12,
      borderBottomLeftRadius: 12,
    });
    expect(view.getAllByTestId('decor-szecesszio-bloom-petal')).toHaveLength(8);
    // on a non-title header: a flower - line - flower row
    expect(view.getByTestId('decor-szecesszio-ornament')).toBeTruthy();
    expect(view.getAllByTestId('decor-szecesszio-flower')).toHaveLength(2);
    view.unmount();

    // the header is the title itself: a flower on both sides, no row
    await getDb().setSkin('szecesszio');
    const title = render(
      <ThemeProvider>
        <SkinHeader>
          <KText variant="title">Cim</KText>
        </SkinHeader>
      </ThemeProvider>,
    );
    await flush();
    expect(title.getByText('Cim')).toBeTruthy();
    expect(title.queryByTestId('decor-szecesszio-ornament')).toBeNull();
    expect(title.getAllByTestId('decor-szecesszio-flower')).toHaveLength(2);
    title.unmount();
  });

  it('kalocsai: öt színű virág-sor, növény-ikon a két felső sarokban, a másodlagos gomb szaggatott b keretű', async () => {
    const view = await mountSkin(
      'kalocsai',
      <>
        <BrutalBox testID="secondary" kind="button" fill="paper" />
        <BrutalBox testID="primary" kind="button" fill="a" />
      </>,
    );
    const c = light('kalocsai');
    const flowers = view.getAllByTestId('decor-kalocsai-flower');
    expect(flowers).toHaveLength(5);
    const petalColors = flowers.map((f) => flat(f.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.endsWith('-petal'))[0].props.style).backgroundColor);
    expect(petalColors).toEqual(['#E2231A', '#F28AB2', '#2B6CB0', '#2E8B3A', '#F2B705']);
    expect(view.getByTestId('decor-kalocsai-plant-left')).toBeTruthy();
    expect(flat(view.getByTestId('decor-kalocsai-plant-right').props.style).right).toBe(6);
    expect(flat(view.getByTestId('secondary').props.style)).toMatchObject({ borderStyle: 'dashed', borderColor: c.b });
    expect(flat(view.getByTestId('primary').props.style)).toMatchObject({ borderStyle: 'dashed', borderColor: c.a });
    view.unmount();
  });

  it('memphis: cikcakk (b), sárga kör, türkiz (c) háromszög a háttérben', async () => {
    const view = await mountSkin('memphis');
    const c = light('memphis');
    const bars = view.getAllByTestId('decor-memphis-zigzag-bar');
    expect(bars).toHaveLength(6);
    expect(bars.every((b) => flat(b.props.style).backgroundColor === c.b)).toBe(true);
    expect(flat(view.getByTestId('decor-memphis-circle').props.style).backgroundColor).toBe('#FFD23F');
    expect(flat(view.getByTestId('decor-memphis-triangle').props.style).borderBottomColor).toBe(c.c);
    view.unmount();
  });

  it('kódex: belső keret, iniciálé arany dobozban piros betűvel, a többi betű a szó elemében', async () => {
    const view = await mountSkin('kodex');
    // the mountSkin "casa" word: C drop cap + asa
    const c = light('kodex');
    expect(view.getByText('asa')).toBeTruthy();
    expect(view.getAllByTestId('skin-kodex-initial')).toHaveLength(1);
    expect(flat(view.getByTestId('skin-kodex-initial').props.style)).toMatchObject({ backgroundColor: c.b });
    expect(flat(view.getByText('C').props.style).color).toBe(c.a);
    expect(flat(view.getByTestId('decor-kodex-inner').props.style)).toMatchObject({
      top: 4,
      borderWidth: 1,
      borderColor: c.border,
    });
    view.unmount();
  });

  it('graffiti: -2°-os kártya, két csorgás a keret alján, szó b, cím c színnel', async () => {
    const view = await mountSkin(
      'graffiti',
      <SkinHeader>
        <KText variant="title" style={{ color: '#FFFFFF' }}>Cim</KText>
      </SkinHeader>,
    );
    const c = SKINS.graffiti.colors.dark!;
    expect(flat(view.getByTestId('skin-graffiti-frame').props.style).transform).toEqual([{ rotate: '-2deg' }]);
    const drips = view.getAllByTestId('decor-graffiti-drip');
    expect(drips).toHaveLength(2);
    expect(flat(drips[0].props.style).bottom).toBeLessThan(0);
    expect(flat(view.getByText('casa').props.style).color).toBe(c.b);
    expect(flat(view.getByText('Cim').props.style).color).toBe(c.c);
    view.unmount();
  });

  it('a díszek fájljai csak View / Text-et használnak: nincs SVG, expo-image vagy más natív függőség', () => {
    const dir = path.join(__dirname, '..');
    for (const file of [
      'partsE2.tsx', 'diszlexia.tsx', 'plakat.tsx', 'bauhaus.tsx', 'popart.tsx', 'szecesszio.tsx', 'kalocsai.tsx',
      'memphis.tsx', 'kodex.tsx', 'graffiti.tsx',
    ]) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(src).not.toMatch(/react-native-svg|expo-image|expo-linear-gradient|lottie/);
    }
  });
});
