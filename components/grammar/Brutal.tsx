import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useSkinDecor } from '@/components/skins';
import type { SkinDecor } from '@/components/skins/types';
import type { ColorRole, CornerRadii, SkinShape } from '@/constants/Skins';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';
import { useTheme } from '@/lib/ThemeContext';

// NY20: a neo-brutalista forma-elemek (NYELVTAN.md "Neo-brutalista stílus").
// Csak akkor használjuk őket, ha useGrammarColors().brutal igaz; a classic
// paletta a mai kinézetet adja, ezek nélkül.

export type BrutalFill = 'paper' | 'a' | 'b' | 'ink';

// A Neo-brutál árnyék-eltolás (px): az `offset` prop ehhez képest skálázódik a téma shadowOffset-jére.
const BRUTAL_SHADOW = 3;

function fillColor(g: GrammarColors, fill: BrutalFill): string {
  if (fill === 'a') return g.a;
  if (fill === 'b') return g.b;
  if (fill === 'ink') return g.ink;
  return g.paper;
}

// A szöveg színe az adott kitöltésen: színes (a / b) kitöltésen az onA / onB (brutal témánál
// mindig onFill), tintán a papír-alap, papíron az ink.
export function textOnFill(g: GrammarColors, fill: BrutalFill): string {
  if (fill === 'a') return g.onA;
  if (fill === 'b') return g.onB;
  if (fill === 'ink') return g.bg;
  return g.ink;
}

// A fő gomb (ink kitöltés) szövege: Neo-brutál világos módban a b szín, sötét módban (ahol az ink
// világos) a sötét alap, hogy olvasható maradjon (grammarColorsFor onInk); a többi témánál a bg.
export function inkButtonText(g: GrammarColors): string {
  return g.onInk;
}

// PLAN-temak 2A: a forma-szerepek (keret / árnyék színe) és a sarok-sugár a téma `shape`-éből.
export function roleColor(g: GrammarColors, role: ColorRole = 'ink'): string {
  if (role === 'a') return g.a;
  if (role === 'b') return g.b;
  if (role === 'c') return g.c;
  if (role === 'border') return g.border;
  return g.ink;
}

export function radiusStyle(r: number | CornerRadii): ViewStyle {
  if (typeof r === 'number') return r > 0 ? { borderRadius: r } : {};
  return { borderTopLeftRadius: r[0], borderTopRightRadius: r[1], borderBottomRightRadius: r[2], borderBottomLeftRadius: r[3] };
}

// Kis elemek (matrica, szegmens, kapcsoló) keret-vastagsága és sarka: a téma kerete, de legfeljebb
// a mai 2 px, illetve a `maxRadius`; a Neo-brutál téma mai értékei (2 px, sarok 0) változatlanok.
function smallRadius(shape: SkinShape, maxRadius: number): ViewStyle {
  return typeof shape.buttonRadius === 'number' ? radiusStyle(Math.min(shape.buttonRadius, maxRadius)) : {};
}

// PLAN-temak 6E: a téma gomb-változata (a díszből). Alapból 'default': semmi nem változik.
// stacked (senior): teljes szélesség, min. 48 magas; text (zen): csak szöveg; bevel (retro95):
// a gomb első betűje aláhúzva (a 3D-perem a forma `bevel` jelzőjéből jön).
export type ButtonVariant = NonNullable<SkinDecor['buttonVariant']>;

export function useButtonVariant(): ButtonVariant {
  return useSkinDecor().buttonVariant ?? 'default';
}

// A push-gomb szövegének színe: csak szöveg változatban (zen) az ink, különben a kitöltés szerint.
export function actionTextColor(g: GrammarColors, fill: BrutalFill, variant: ButtonVariant): string {
  if (variant === 'text') return g.ink;
  return fill === 'ink' ? inkButtonText(g) : textOnFill(g, fill);
}

function minHeightOf(style: StyleProp<ViewStyle>): number {
  const h = StyleSheet.flatten(style)?.minHeight;
  return typeof h === 'number' ? h : 0;
}

// retro95: a 3D-perem négy oldalának színe (világos bal-fent, sötét jobb-lent); a téma extra-színe,
// más színekkel (Saját mix) a Win95 alapértékek.
function bevelColors(g: GrammarColors): ViewStyle {
  const light = g.extra.bevelLight ?? '#FFFFFF';
  const dark = g.extra.bevelDark ?? '#808080';
  return { borderTopColor: light, borderLeftColor: light, borderBottomColor: dark, borderRightColor: dark };
}

// Doboz: Neo-brutál témán 2,5 px ink keret, sarok 0, tömör eltolt árnyék (3 px jobbra + 3 px le,
// ink színnel, elmosás nélkül). RN-ben nem elevation/shadow*: egy ink színű
// hátsó View, a doboz mögé eltolva. Zárt (dashed) doboz: szaggatott keret,
// árnyék nélkül. PLAN-temak 2A: a keret vastagsága / stílusa / színe, a sarok és az árnyék
// eltolása + színe az aktív téma `shape`-éből jön (az `offset` a 3 px-es alap arányában skálázódik).
export function BrutalBox({
  children,
  fill = 'paper',
  dashed = false,
  offset = 3,
  kind = 'card',
  style,
  boxStyle,
  onPress,
  disabled,
  action = false,
  testID,
  accessibilityLabel,
}: {
  children?: ReactNode;
  fill?: BrutalFill;
  dashed?: boolean;
  offset?: number;
  // 'button': a gomb-sarok (shape.buttonRadius), 'card': a kártya-sarok (shape.radius).
  kind?: 'card' | 'button';
  // A külső (elrendezési) burkoló stílusa.
  style?: StyleProp<ViewStyle>;
  // Az előlapi doboz stílusa (padding, igazítás).
  boxStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  // PLAN-temak 6E: push-gomb (BrutalButton, a Tudom / Nem tudom gombok): a téma gomb-változata érvényes rá.
  action?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const variant = useButtonVariant();
  const textOnly = action && variant === 'text';
  const wide = action && variant === 'stacked';
  const radius = radiusStyle(kind === 'button' ? shape.buttonRadius : shape.radius);
  const borderRole = (kind === 'button' && fill === 'paper' && shape.secondaryBorderColor) || shape.borderColor;
  const shift = textOnly ? 0 : (offset * shape.shadowOffset) / BRUTAL_SHADOW;
  const front: StyleProp<ViewStyle> = [
    {
      backgroundColor: textOnly ? 'transparent' : fillColor(g, fill),
      borderWidth: textOnly ? 0 : shape.borderWidth,
      borderColor: roleColor(g, borderRole),
      borderStyle: dashed || shape.borderStyle === 'dashed' ? 'dashed' : 'solid',
      ...radius,
      ...(shape.bevel && !dashed && !textOnly ? bevelColors(g) : null),
    },
    boxStyle,
    wide ? { minHeight: Math.max(48, minHeightOf(boxStyle)) } : null,
  ];
  return (
    <View style={[{ marginRight: shift, marginBottom: shift }, wide ? { alignSelf: 'stretch' } : null, style]}>
      {dashed || shift <= 0 ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: shift,
            top: shift,
            right: -shift,
            bottom: -shift,
            backgroundColor: roleColor(g, shape.shadowColor),
            ...radius,
          }}
        />
      )}
      {onPress ? (
        <Pressable
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          disabled={disabled}
          onPress={onPress}
          style={front}
        >
          {children}
        </Pressable>
      ) : (
        <View testID={testID} accessibilityLabel={accessibilityLabel} style={front}>
          {children}
        </View>
      )}
    </View>
  );
}

// Matrica: 2 px keret, kis betű, 500 súly, -6° és +8° közti elforgatás
// (streak, CORE, DONE, combo).
export function Sticker({
  label,
  fill = 'a',
  rotate = -4,
  style,
  textStyle,
  testID,
}: {
  label: string;
  fill?: BrutalFill;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View
      testID={testID}
      style={[
        styles.sticker,
        {
          backgroundColor: fillColor(g, fill),
          borderColor: roleColor(g, shape.borderColor),
          borderWidth: Math.min(2, shape.borderWidth),
          transform: [{ rotate: `${rotate}deg` }],
          ...smallRadius(shape, 999),
        },
        style,
      ]}
    >
      <Text style={[styles.stickerText, { color: textOnFill(g, fill) }, textStyle]}>{label}</Text>
    </View>
  );
}

// Lecke-kártya: brutalista palettán BrutalBox (paper vagy b kitöltéssel), classic
// paletta esetén a mai sima kártya (classicStyle + a paper = mai card szín).
export function Card({
  children,
  fill = 'paper',
  style,
  classicStyle,
  boxStyle,
  testID,
}: {
  children?: ReactNode;
  fill?: BrutalFill;
  style?: StyleProp<ViewStyle>;
  classicStyle?: StyleProp<ViewStyle>;
  // NY19: a brutalista doboz belső stílusa (a default styles.card után).
  boxStyle?: StyleProp<ViewStyle>;
  // Csak a brutalista dobozra kerül (a classic ág nem kap testID-t).
  testID?: string;
}) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <BrutalBox testID={testID} fill={fill} style={style} boxStyle={[styles.card, boxStyle]}>
        {children}
      </BrutalBox>
    );
  }
  return <View style={[{ backgroundColor: g.paper }, classicStyle, style]}>{children}</View>;
}

// NY19: a fő gomb (nagybetűs, 500 súly): ink kitöltés b / bg színű szöveggel, vagy
// a / b kitöltés #111 szöveggel.
export function BrutalButton({
  label,
  onPress,
  fill = 'ink',
  disabled,
  testID,
  accessibilityLabel,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  fill?: BrutalFill;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  // PLAN-temak 6E: a senior (stacked) témán a címke elé kerülő ikon; más témán nem látszik.
  icon?: string;
}) {
  const g = useGrammarColors();
  const variant = useButtonVariant();
  // zen: a fő (a kitöltésű, "Tudom") gomb szövege aláhúzva; retro95: a gomb első betűje aláhúzva.
  const underlineAll = variant === 'text' && fill === 'a';
  const text =
    variant === 'bevel' && label ? (
      <>
        <Text style={styles.underline}>{label.charAt(0)}</Text>
        {label.slice(1)}
      </>
    ) : variant === 'stacked' && icon && !label.includes(icon) ? (
      `${icon}  ${label}`
    ) : (
      label
    );
  return (
    <BrutalBox
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      fill={fill}
      kind="button"
      action
      disabled={disabled}
      onPress={onPress}
      style={[disabled ? { opacity: 0.4 } : null, style]}
      boxStyle={styles.button}
    >
      <Text
        style={[
          styles.buttonText,
          { color: actionTextColor(g, fill, variant) },
          underlineAll ? styles.underline : null,
        ]}
      >
        {text}
      </Text>
    </BrutalBox>
  );
}

// NY19: beviteli mező brutalista palettán: 2,5 px ink keret, sarok 0, papír háttér.
export function brutalInputStyle(g: GrammarColors): TextStyle {
  // PLAN-temak 6E: a téma saját beviteli mező-színe (retro95: fehér "mező"), ha van; különben a papír.
  return { borderWidth: 2.5, borderColor: g.ink, borderRadius: 0, backgroundColor: g.extra.field ?? g.paper, color: g.ink };
}

// NY25: kapcsoló. Brutalista palettán téglalap sín (2,5 px ink keret, sarok 0), négyzetes
// ink gomb, bekapcsolva a sín `a` kitöltésű; classic palettán a mai Switch.
export function BrutalSwitch({
  value,
  onValueChange,
  disabled,
  testID,
}: {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const g = useGrammarColors();
  const { theme } = useTheme();
  const { shape } = useSkin().skin;
  if (!g.brutal) {
    return <Switch testID={testID} value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: Colors[theme].tint }} />;
  }
  const round = smallRadius(shape, 14);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      style={[
        styles.switchTrack,
        {
          borderColor: roleColor(g, shape.borderColor),
          borderWidth: Math.max(1, shape.borderWidth),
          backgroundColor: value ? g.a : g.paper,
          ...round,
        },
        disabled ? { opacity: 0.4 } : null,
      ]}
    >
      <View
        style={[
          styles.switchThumb,
          { backgroundColor: g.ink },
          'borderRadius' in round ? { borderRadius: 999 } : null,
          value ? { right: 4 } : { left: 4 },
        ]}
      />
    </Pressable>
  );
}

// NY25: vissza-nyíl a képernyőbe rajzolt fejlécsorban: kis BrutalBox, ink nyíl.
export function BrutalBackButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const g = useGrammarColors();
  return (
    <BrutalBox testID={testID} onPress={onPress} offset={2} kind="button" boxStyle={styles.backBox}>
      <Text style={[styles.backArrow, { color: g.ink }]}>←</Text>
    </BrutalBox>
  );
}

// Hány blokk legyen kitöltve a szegmentált sávban egy 0-100 százalékhoz.
export function segmentsFilled(percent: number, segments: number): number {
  return Math.max(0, Math.min(segments, Math.round((percent / 100) * segments)));
}

// Szegmentált progress: 5-8 blokk, 9 px magas, 2 px keret, kész blokk = ink kitöltés.
export function SegmentBar({
  filled,
  segments = 6,
  style,
  testID,
}: {
  filled: number;
  segments?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View testID={testID} style={[styles.segmentRow, style]}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          testID={testID ? `${testID}-${i}` : undefined}
          style={[
            styles.segment,
            {
              borderColor: roleColor(g, shape.borderColor),
              borderWidth: Math.min(2, shape.borderWidth),
              backgroundColor: i < filled ? g.ink : 'transparent',
              ...smallRadius(shape, 4),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 6 },
  sticker: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  stickerText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '500', textTransform: 'uppercase' },
  underline: { textDecorationLine: 'underline' },
  switchTrack: { width: 52, height: 28, borderWidth: 2.5 },
  switchThumb: { position: 'absolute', top: 4, width: 15, height: 15 },
  backBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, fontWeight: '500' },
  segmentRow: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 9, borderWidth: 2 },
});
