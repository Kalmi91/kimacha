// PLAN-temak 2A: a téma-motor adata. Egy téma (skin) = színek (módonként) + forma +
// betű + dísz-azonosító. A színek, a forma és a betű-nevek a PLAN-temak.md "Téma-spec"
// táblázatából jönnek 1:1, a kontraszt-szabály miatti módosítások kivételével (azok a
// PLAN "Spec-eltérések" alatt vannak, régi → új értékkel). A betű-nevek stringek: a
// betöltést (useFonts) a constants/Fonts.ts végzi ugyanezeken a neveken.
import { BASE, ON_FILL, PALETTE_FILLS, type FillPaletteId, type GrammarPaletteId } from './GrammarPalettes';

export type SkinMode = 'light' | 'dark';

export type SkinId =
  | 'brutal' | 'deco' | 'loteria' | 'senior' | 'konnyu' | 'retro95' | 'y2k' | 'kawaii'
  | 'gamer' | 'botanikus' | 'zen' | 'diszlexia' | 'szocreal' | 'plakat' | 'csillampony'
  | 'bauhaus' | 'popart' | 'szecesszio' | 'kalocsai' | 'memphis' | 'kodex' | 'graffiti'
  | 'ukiyoe' | 'classic';

export type SkinGroupId = 'ajanlott' | 'muveszet' | 'kultura' | 'hangulat' | 'olvasas';

// Szín-szerep: a forma (keret, árnyék) színét szerep adja, így a "Saját mix" (szín egy
// témából, forma egy másikból) is jó színt kap.
export type ColorRole = 'ink' | 'a' | 'b' | 'c' | 'border';

export type CornerRadii = [number, number, number, number]; // bal-fent, jobb-fent, jobb-lent, bal-lent

// bg = képernyő-háttér, paper = kártya, ink = szöveg (+ keret), mu = halvány szöveg,
// a = elsődleges kitöltés, onA = szöveg a-n, b / c = második / harmadik szín (onB = szöveg
// b-n), border = a keret saját színe (ahol nem az ink), extra = téma-specifikus színek
// (matrica, pont, hullám, virágszínek ...).
export type SkinColors = {
  bg: string;
  paper: string;
  ink: string;
  mu: string;
  a: string;
  onA: string;
  b?: string;
  onB?: string;
  c?: string;
  border?: string;
  extra?: Record<string, string>;
};

export type SkinShape = {
  borderWidth: number;
  borderStyle: 'solid' | 'dashed';
  radius: number | CornerRadii;
  buttonRadius: number | CornerRadii;
  shadowOffset: number;
  // A keret / az árnyék színe (szerep). Alap: ink.
  borderColor?: ColorRole;
  shadowColor?: ColorRole;
  // A dísz-réteg (4D / 6E) olvassa: dupla keret, 3D-perem, gombok egymás alatt.
  doubleFrame?: boolean;
  bevel?: boolean;
  buttonsStacked?: boolean;
  // kalocsai: a másodlagos (papír kitöltésű) gomb kerete ebben a színben; alap: a shape.borderColor.
  secondaryBorderColor?: ColorRole;
};

export type SkinFonts = { title: string | null; word: string | null; body: string | null };

export type Skin = {
  // 'mix' csak a Saját mixből összerakott Skinnél (lib/skinTheme.ts composeSkin).
  id: SkinSelection;
  group: SkinGroupId;
  // Az első elem az alap-mód. Egy elemű lista: a világos / sötét beállítás hatástalan.
  modes: SkinMode[];
  colors: Partial<Record<SkinMode, SkinColors>>;
  shape: SkinShape;
  fonts: SkinFonts;
  fontScale: number;
  // A téma-sor értéke; hol érvényes: cím + szó (spacingScope 'display', alap) vagy minden szöveg ('all').
  letterSpacing: number;
  spacingScope?: 'display' | 'all';
  lineHeight?: number;
  uppercaseTitle?: boolean;
  lowercaseTitle?: boolean;
  uppercaseWord?: boolean;
  // retro95: minden betűméret +4 px (a VT323 kicsi).
  fontSizeOffset?: number;
  // memphis: a cím + szó mérete szorzóval (a RubikMonoOne széles).
  displayScale?: number;
  // plakat: a szó (variant 'word') elforgatása fokban.
  wordRotate?: number;
};

// A ShipporiMincho TTF túl nagy (8,6 MB), ezért a 2B ügynök Spectral-Light-ot regisztrált helyette
// (zen, ukiyoe); a név egy helyen.
const SERIF_LIGHT = 'Spectral-Light';

const BRUTAL_SHAPE: SkinShape = { borderWidth: 2.5, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 3 };

// A brutalista szín-készlet egy al-palettából (a mai BASE + PALETTE_FILLS, onA = onB = ON_FILL).
export function brutalSkinColors(id: FillPaletteId): Record<SkinMode, SkinColors> {
  const fills = PALETTE_FILLS[id];
  const make = (mode: SkinMode): SkinColors => ({ ...BASE[mode], a: fills.a, onA: ON_FILL, b: fills.b, onB: ON_FILL });
  return { light: make('light'), dark: make('dark') };
}

const flowers = { flower1: '#E2231A', flower2: '#F28AB2', flower3: '#2B6CB0', flower4: '#2E8B3A', flower5: '#F2B705' };

export const SKINS: Record<SkinId, Skin> = {
  brutal: {
    id: 'brutal',
    group: 'ajanlott',
    modes: ['light', 'dark'],
    colors: brutalSkinColors('brand'),
    shape: BRUTAL_SHAPE,
    fonts: { title: null, word: null, body: null },
    fontScale: 1,
    letterSpacing: 0,
  },
  deco: {
    id: 'deco',
    group: 'ajanlott',
    modes: ['dark', 'light'],
    colors: {
      dark: { bg: '#0E1A2B', paper: '#16243A', ink: '#F3E9D2', mu: '#B9AE94', a: '#C9A44C', onA: '#0E1A2B', b: '#3FA08C' },
      light: { bg: '#F3E9D2', paper: '#FBF6EA', ink: '#0E1A2B', mu: '#6B6250', a: '#8B6D24', onA: '#FBF6EA', b: '#1F5E57' },
    },
    shape: { borderWidth: 1, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0, borderColor: 'a', doubleFrame: true },
    fonts: { title: 'PoiretOne', word: 'PoiretOne', body: 'JosefinSans' },
    fontScale: 1,
    letterSpacing: 3,
    uppercaseTitle: true,
  },
  loteria: {
    id: 'loteria',
    group: 'kultura',
    modes: ['light'],
    colors: {
      light: {
        bg: '#F4E3C1', paper: '#FFFFFF', ink: '#111111', mu: '#5A4320', a: '#C8102E', onA: '#FFFFFF', b: '#0072CE',
        extra: { flag1: '#E4007C', flag2: '#FF8200', flag3: '#00A651', flag4: '#0072CE', flag5: '#FFD100' },
      },
    },
    shape: { borderWidth: 3, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0 },
    fonts: { title: 'AlfaSlabOne', word: 'AlfaSlabOne', body: null },
    fontScale: 1,
    letterSpacing: 0,
    uppercaseWord: true,
  },
  senior: {
    id: 'senior',
    group: 'olvasas',
    modes: ['light', 'dark'],
    colors: {
      light: { bg: '#FFFFFF', paper: '#FFFFFF', ink: '#000000', mu: '#333333', a: '#0B5D1E', onA: '#FFFFFF' },
      dark: { bg: '#000000', paper: '#121212', ink: '#FFFFFF', mu: '#DDDDDD', a: '#1E7B34', onA: '#FFFFFF' },
    },
    shape: { borderWidth: 2, borderStyle: 'solid', radius: 8, buttonRadius: 8, shadowOffset: 0, buttonsStacked: true },
    fonts: { title: 'Atkinson-Bold', word: 'Atkinson-Bold', body: 'Atkinson' },
    fontScale: 1.25,
    letterSpacing: 0,
  },
  konnyu: {
    id: 'konnyu',
    group: 'olvasas',
    modes: ['light', 'dark'],
    colors: {
      light: { bg: '#FBF5E6', paper: '#FFFDF7', ink: '#2B2B2B', mu: '#6B6250', a: '#1F5E9C', onA: '#FFFFFF', b: '#B4541A', border: '#E8DFC8' },
      dark: { bg: '#1E1C18', paper: '#2A2721', ink: '#EDE6D6', mu: '#B5AC98', a: '#7FB2E5', onA: '#1E1C18', b: '#E7A06B' },
    },
    shape: { borderWidth: 1, borderStyle: 'solid', radius: 12, buttonRadius: 10, shadowOffset: 0, borderColor: 'border' },
    fonts: { title: 'Lexend', word: 'Lexend', body: 'Lexend' },
    fontScale: 1,
    letterSpacing: 1.5,
    spacingScope: 'all',
    lineHeight: 1.6,
  },
  retro95: {
    id: 'retro95',
    group: 'hangulat',
    modes: ['light'],
    colors: {
      light: {
        bg: '#008383', paper: '#C0C0C0', ink: '#000000', mu: '#000000', a: '#000080', onA: '#FFFFFF',
        extra: { field: '#FFFFFF', bevelLight: '#FFFFFF', bevelDark: '#808080' },
      },
    },
    shape: { borderWidth: 2, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0, bevel: true },
    fonts: { title: 'VT323', word: 'VT323', body: 'VT323' },
    fontScale: 1,
    letterSpacing: 0,
    fontSizeOffset: 4,
  },
  y2k: {
    id: 'y2k',
    group: 'hangulat',
    modes: ['light'],
    colors: {
      light: {
        bg: '#E9E3FF', paper: '#FFFFFF', ink: '#111111', mu: '#4A4560', a: '#111111', onA: '#B8FF5C', b: '#B8FF5C',
        extra: { sticker: '#FF9BD2' },
      },
    },
    shape: { borderWidth: 2, borderStyle: 'solid', radius: 22, buttonRadius: 999, shadowOffset: 0 },
    fonts: { title: 'Syne-ExtraBold', word: 'Syne-ExtraBold', body: null },
    fontScale: 1,
    letterSpacing: 0,
  },
  kawaii: {
    id: 'kawaii',
    group: 'hangulat',
    modes: ['light'],
    colors: {
      light: {
        bg: '#FFF1EC', paper: '#FFFFFF', ink: '#5A3E4B', mu: '#896673', a: '#BFF0DC', onA: '#1E5E46', b: '#E5DBFF', onB: '#4B3A80',
        border: '#FFD1C1', extra: { icon: '#FF8FA3' },
      },
    },
    shape: { borderWidth: 2, borderStyle: 'solid', radius: 24, buttonRadius: 999, shadowOffset: 0, borderColor: 'border' },
    fonts: { title: 'Fredoka-Medium', word: 'Fredoka-Medium', body: 'Fredoka-Medium' },
    fontScale: 1,
    letterSpacing: 0,
  },
  gamer: {
    id: 'gamer',
    group: 'hangulat',
    modes: ['dark'],
    colors: {
      dark: { bg: '#0B0F14', paper: '#121922', ink: '#E6EDF3', mu: '#8B98A5', a: '#A3FF12', onA: '#0B0F14', b: '#B26BFF' },
    },
    shape: { borderWidth: 1, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0, borderColor: 'a' },
    fonts: { title: 'Orbitron-Bold', word: 'Orbitron-Bold', body: null },
    fontScale: 1,
    letterSpacing: 0,
    uppercaseTitle: true,
  },
  botanikus: {
    id: 'botanikus',
    group: 'hangulat',
    modes: ['light', 'dark'],
    colors: {
      light: { bg: '#EEF2E6', paper: '#F8FAF3', ink: '#2F3E2E', mu: '#5D6B56', a: '#5C7B51', onA: '#F8FAF3', b: '#A9BF9A', border: '#C9D6BC' },
      dark: { bg: '#18211A', paper: '#212C23', ink: '#E4EBDA', mu: '#A9B7A0', a: '#8DB07F', onA: '#18211A', b: '#55704B' },
    },
    shape: { borderWidth: 1, borderStyle: 'solid', radius: 6, buttonRadius: 20, shadowOffset: 0, borderColor: 'border' },
    fonts: { title: 'Cormorant-MediumItalic', word: 'Cormorant-MediumItalic', body: null },
    fontScale: 1,
    letterSpacing: 0,
  },
  zen: {
    id: 'zen',
    group: 'hangulat',
    modes: ['light', 'dark'],
    colors: {
      light: { bg: '#FAFAF7', paper: '#FAFAF7', ink: '#1A1A1A', mu: '#6A6A65', a: '#1A1A1A', onA: '#FAFAF7', extra: { dot: '#D2462F' } },
      dark: { bg: '#121212', paper: '#121212', ink: '#EDEDE8', mu: '#9A9A95', a: '#EDEDE8', onA: '#121212', extra: { dot: '#E0583F' } },
    },
    shape: { borderWidth: 0, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0 },
    fonts: { title: SERIF_LIGHT, word: SERIF_LIGHT, body: SERIF_LIGHT },
    fontScale: 1,
    letterSpacing: 0,
  },
  diszlexia: {
    id: 'diszlexia',
    group: 'olvasas',
    modes: ['light', 'dark'],
    colors: {
      light: {
        bg: '#FDF6E3', paper: '#FFFDF5', ink: '#222222', mu: '#6B6250', a: '#2E5E8C', onA: '#FFFFFF', b: '#EAE2CC',
        border: '#E6DCC3', extra: { band: '#FFF2B0' },
      },
      dark: { bg: '#1E1C18', paper: '#2A2721', ink: '#EDE6D6', mu: '#B5AC98', a: '#7FB2E5', onA: '#1E1C18', extra: { band: '#4A4128' } },
    },
    shape: { borderWidth: 1, borderStyle: 'solid', radius: 12, buttonRadius: 10, shadowOffset: 0, borderColor: 'border' },
    fonts: { title: 'OpenDyslexic', word: 'OpenDyslexic', body: 'OpenDyslexic' },
    fontScale: 1,
    letterSpacing: 0,
    lineHeight: 1.8,
  },
  szocreal: {
    id: 'szocreal',
    group: 'ajanlott',
    modes: ['light'],
    colors: {
      light: { bg: '#E8D9B5', paper: '#F5E9C8', ink: '#3B2A1A', mu: '#6E5A40', a: '#A4161A', onA: '#F5E9C8', b: '#C98B2B' },
    },
    shape: { borderWidth: 4, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0, doubleFrame: true },
    fonts: { title: 'Playfair-Black', word: 'Playfair-Black', body: null },
    fontScale: 1,
    letterSpacing: 2,
    uppercaseTitle: true,
  },
  plakat: {
    id: 'plakat',
    group: 'muveszet',
    modes: ['light'],
    colors: {
      light: { bg: '#F2E8D5', paper: '#F2E8D5', ink: '#111111', mu: '#3A3A3A', a: '#CC241C', onA: '#F2E8D5', b: '#111111' },
    },
    shape: { borderWidth: 2, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0 },
    fonts: { title: 'RussoOne', word: 'Oswald-Bold', body: null },
    fontScale: 1,
    letterSpacing: 0,
    uppercaseWord: true,
    wordRotate: -6,
  },
  csillampony: {
    id: 'csillampony',
    group: 'ajanlott',
    modes: ['light'],
    colors: {
      light: {
        bg: '#FFE6F7', paper: '#FFFFFF', ink: '#6B2D7B', mu: '#8A5998', a: '#E3008C', onA: '#FFFFFF', b: '#E3D4FF', onB: '#5B3A8C',
        border: '#F3B7E6',
      },
    },
    shape: { borderWidth: 2, borderStyle: 'solid', radius: 24, buttonRadius: 999, shadowOffset: 0, borderColor: 'border' },
    fonts: { title: 'Pacifico', word: 'Fredoka-Medium', body: 'Fredoka-Medium' },
    fontScale: 1,
    letterSpacing: 0,
  },
  bauhaus: {
    id: 'bauhaus',
    group: 'muveszet',
    modes: ['light'],
    colors: {
      light: { bg: '#F1EDE4', paper: '#FFFFFF', ink: '#111111', mu: '#444444', a: '#E32D1D', onA: '#FFFFFF', b: '#1E4E9C', c: '#F2C12E' },
    },
    shape: { borderWidth: 0, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0 },
    fonts: { title: 'Jost-Bold', word: 'Jost-Bold', body: 'Jost' },
    fontScale: 1,
    letterSpacing: 0,
    lowercaseTitle: true,
  },
  popart: {
    id: 'popart',
    group: 'muveszet',
    modes: ['light'],
    colors: {
      light: { bg: '#FFE14D', paper: '#FFFFFF', ink: '#111111', mu: '#333333', a: '#E42B1B', onA: '#FFFFFF' },
    },
    shape: { borderWidth: 3, borderStyle: 'solid', radius: 40, buttonRadius: 0, shadowOffset: 0 },
    fonts: { title: 'Bangers', word: 'Bangers', body: null },
    fontScale: 1,
    letterSpacing: 0,
  },
  szecesszio: {
    id: 'szecesszio',
    group: 'muveszet',
    modes: ['light'],
    colors: {
      light: { bg: '#F3EAD3', paper: '#FBF5E6', ink: '#1F3D3A', mu: '#4F6461', a: '#1F6F68', onA: '#F3EAD3', b: '#C8A24A', c: '#B5523B' },
    },
    shape: {
      borderWidth: 2, borderStyle: 'solid', radius: [70, 70, 8, 8], buttonRadius: [14, 14, 4, 4], shadowOffset: 0,
      borderColor: 'a', doubleFrame: true,
    },
    fonts: { title: 'CinzelDecorative-Bold', word: 'Marcellus', body: 'Marcellus' },
    fontScale: 1,
    letterSpacing: 0,
  },
  kalocsai: {
    id: 'kalocsai',
    group: 'kultura',
    modes: ['light'],
    colors: {
      light: { bg: '#FFFFFF', paper: '#FFFFFF', ink: '#1A1A1A', mu: '#555555', a: '#E2231A', onA: '#FFFFFF', b: '#2B6CB0', extra: flowers },
    },
    shape: {
      borderWidth: 2, borderStyle: 'dashed', radius: 10, buttonRadius: 10, shadowOffset: 0, borderColor: 'a', secondaryBorderColor: 'b',
    },
    fonts: { title: 'YesevaOne', word: 'YesevaOne', body: null },
    fontScale: 1,
    letterSpacing: 0,
  },
  memphis: {
    id: 'memphis',
    group: 'muveszet',
    modes: ['light'],
    colors: {
      light: {
        bg: '#FFFFFF', paper: '#FFD23F', ink: '#111111', mu: '#333333', a: '#6C5CE7', onA: '#FFFFFF', b: '#FF5C8A', c: '#00B8A9',
        extra: { yellow: '#FFD23F' },
      },
    },
    shape: { borderWidth: 2, borderStyle: 'solid', radius: 0, buttonRadius: 999, shadowOffset: 6, shadowColor: 'b' },
    fonts: { title: 'RubikMonoOne', word: 'RubikMonoOne', body: null },
    fontScale: 1,
    letterSpacing: 0,
    displayScale: 0.8,
  },
  kodex: {
    id: 'kodex',
    group: 'muveszet',
    modes: ['light'],
    colors: {
      light: { bg: '#EAD9B0', paper: '#F4E8C8', ink: '#2B1D0E', mu: '#5C4630', a: '#7A1F1F', onA: '#F4E8C8', b: '#D4AF37', border: '#8B6B3A' },
    },
    shape: { borderWidth: 1, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0, borderColor: 'border', doubleFrame: true },
    fonts: { title: 'UnifrakturMaguntia', word: 'IMFellEnglish', body: 'IMFellEnglish' },
    fontScale: 1,
    letterSpacing: 0,
  },
  graffiti: {
    id: 'graffiti',
    group: 'muveszet',
    modes: ['dark'],
    colors: {
      dark: { bg: '#1C1C1C', paper: '#1C1C1C', ink: '#FFFFFF', mu: '#CCCCCC', a: '#FF3EA5', onA: '#111111', b: '#FFE600', c: '#7CFF4F' },
    },
    shape: { borderWidth: 3, borderStyle: 'solid', radius: 6, buttonRadius: 6, shadowOffset: 0, borderColor: 'a' },
    fonts: { title: 'RubikSprayPaint', word: 'PermanentMarker', body: null },
    fontScale: 1,
    letterSpacing: 0,
  },
  ukiyoe: {
    id: 'ukiyoe',
    group: 'ajanlott',
    modes: ['light', 'dark'],
    colors: {
      light: { bg: '#EFE6D2', paper: '#F7F0DF', ink: '#1F2A44', mu: '#4A5368', a: '#1F3A5F', onA: '#EFE6D2', extra: { seal: '#C0392B', wave: '#1F3A5F' } },
      dark: { bg: '#0F1626', paper: '#172036', ink: '#EFE6D2', mu: '#B3AC9A', a: '#D9C9A3', onA: '#0F1626', extra: { seal: '#D2462F', wave: '#2B4A75' } },
    },
    shape: { borderWidth: 1, borderStyle: 'solid', radius: 0, buttonRadius: 0, shadowOffset: 0 },
    fonts: { title: SERIF_LIGHT, word: SERIF_LIGHT, body: SERIF_LIGHT },
    fontScale: 1,
    letterSpacing: 0,
  },
  // A mai Colors.light / Colors.dark értékei (a constants/Colors.ts ugyanezeket adja
  // a 'light' / 'dark' kulcson; a skins.test.ts egyezést ellenőriz). Forma: a mai
  // BrutalBox értékei, mert a Brutal-komponensek classic alatt is ezt rajzolnák.
  classic: {
    id: 'classic',
    group: 'hangulat',
    modes: ['light', 'dark'],
    colors: {
      light: { bg: '#F8FAFC', paper: '#FFFFFF', ink: '#1E293B', mu: '#64748B', a: '#2563EB', onA: '#FFFFFF', b: '#EC4899' },
      dark: { bg: '#0F172A', paper: '#1E293B', ink: '#F1F5F9', mu: '#94A3B8', a: '#3B82F6', onA: '#0F172A', b: '#EC4899' },
    },
    shape: BRUTAL_SHAPE,
    fonts: { title: null, word: null, body: null },
    fontScale: 1,
    letterSpacing: 0,
  },
};

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

// Sorrend a Beállításokban (PLAN-temak.md csoportok).
export const SKIN_GROUPS: { id: SkinGroupId; skins: SkinId[] }[] = [
  { id: 'ajanlott', skins: ['brutal', 'deco', 'szocreal', 'csillampony', 'ukiyoe'] },
  { id: 'muveszet', skins: ['plakat', 'bauhaus', 'popart', 'szecesszio', 'memphis', 'kodex', 'graffiti'] },
  { id: 'kultura', skins: ['loteria', 'kalocsai'] },
  { id: 'hangulat', skins: ['retro95', 'y2k', 'kawaii', 'gamer', 'botanikus', 'zen', 'classic'] },
  { id: 'olvasas', skins: ['senior', 'konnyu', 'diszlexia'] },
];

export const ONBOARDING_SKINS: SkinId[] = ['ukiyoe', 'csillampony', 'szocreal', 'brutal', 'deco'];

export const DEFAULT_SKIN: SkinId = 'brutal';

// A kiválasztás: egy téma vagy a "Saját mix".
export type SkinSelection = SkinId | 'mix';

// Saját mix: szín + betű + forma + dísz külön. A szín lehet egy téma vagy egy Neo-brutál al-paletta.
export type SkinMix = { colors: SkinId | GrammarPaletteId; font: SkinId; shape: SkinId; decor: SkinId | 'none' };

export const DEFAULT_SKIN_MIX: SkinMix = { colors: 'brutal', font: 'brutal', shape: 'brutal', decor: 'none' };

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SKINS, v);
}

export function isSkinSelection(v: unknown): v is SkinSelection {
  return v === 'mix' || isSkinId(v);
}

const PALETTE_IDS: string[] = [...(Object.keys(PALETTE_FILLS) as FillPaletteId[]), 'classic'];

export function isSkinMix(v: unknown): v is SkinMix {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    (isSkinId(m.colors) || (typeof m.colors === 'string' && PALETTE_IDS.includes(m.colors))) &&
    isSkinId(m.font) &&
    isSkinId(m.shape) &&
    (m.decor === 'none' || isSkinId(m.decor))
  );
}

// A db-ben JSON-ként tárolt mix; érvénytelen / hiányzó érték = null.
export function parseSkinMix(raw: unknown): SkinMix | null {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : null;
    return isSkinMix(v) ? v : null;
  } catch {
    return null;
  }
}

// Régi felhasználó (skin NULL): a mentett paletta dönt (classic → classic, minden más → brutal).
export function legacySkinFor(palette: GrammarPaletteId): SkinId {
  return palette === 'classic' ? 'classic' : 'brutal';
}

export function skinColorsFor(skin: Skin, mode: SkinMode): SkinColors {
  return (skin.colors[mode] ?? skin.colors[skin.modes[0]]) as SkinColors;
}

// Mód-feloldás: egy módú témánál a beállítás hatástalan; kétmódúnál a mai Auto / Light / Dark.
export function resolveMode(modes: SkinMode[], override: SkinMode | 'system', system: SkinMode): SkinMode {
  if (modes.length === 1) return modes[0];
  const wanted = override === 'system' ? system : override;
  return modes.includes(wanted) ? wanted : modes[0];
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

// WCAG kontraszt-arány (#RRGGBB).
export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// A szöveg színe egy kitöltésen, ha a téma nem ad explicit onB / onC-t: a jobb kontrasztú a jelöltek közül.
export function bestOn(fill: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrastRatio(c, fill) > contrastRatio(best, fill) ? c : best));
}

// PLAN-temak 7H: a WCAG-küszöb egy KText-szövegre. Nagy szövegnél (>= 24 px, vagy >= 18,66 px és
// félkövér) 3, különben 4,5. A KText szabályai szerint: a méret a fontScale / displayScale (title
// és word) / fontSizeOffset-tel skálázódik, egyedi betűnél (skin.fonts[variant]) a fontWeight
// elmarad, vagyis ott nincs félkövér.
export function textContrastMin(
  skin: Pick<Skin, 'fonts' | 'fontScale' | 'displayScale' | 'fontSizeOffset'>,
  variant: 'title' | 'word' | 'body',
  size: number,
  bold: boolean,
): number {
  const px = size * skin.fontScale * (variant === 'body' ? 1 : skin.displayScale ?? 1) + (skin.fontSizeOffset ?? 0);
  return px >= 24 || (px >= 18.66 && bold && !skin.fonts[variant]) ? 3 : 4.5;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

// PLAN-temak 7G: olvasható szín egy háttéren. Ha az `fg` a `bg`-n átmegy a küszöbön (alap WCAG AA
// 4.5, jelnél / nagy szövegnél 3), változatlan marad (a mai kinézet nem változik); különben azonos
// árnyalaton a bg-től távolodva feketébe / fehérbe keveri, a legkisebb változtatásig, ami átmegy.
// Ugyanígy kitöltésre is: `legibleOn(fill, '#FFFFFF')` = a fehér szöveget elbíró kitöltés.
export function legibleOn(fg: string, bg: string, min = 4.5): string {
  if (!HEX6.test(fg) || !HEX6.test(bg) || contrastRatio(fg, bg) >= min) return fg;
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(fg);
  const targets = luminance(bg) > luminance(fg) ? [0, 255] : [255, 0];
  for (const t of targets) {
    for (let step = 1; step <= 50; step++) {
      const k = step / 50;
      const hex = `#${[r, g, b].map((v) => Math.round(v + (t - v) * k).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      if (contrastRatio(hex, bg) >= min) return hex;
    }
  }
  return fg;
}
