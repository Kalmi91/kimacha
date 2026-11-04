import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, textOnFill, type BrutalFill } from '@/components/grammar/Brutal';

type ColorScheme = (typeof Colors)['light'];

// LearnChrome currently has no highlightable `badge` chip style (an earlier
// refactor merged the old badge row into a single-line status row), so
// this is a new component with the approved design's `.badge` values:
// 13 px font, 999 radius, faint background, bold, colour variants.
type Tone = 'default' | 'blue' | 'green' | 'accent';

type BadgeItem = {
  label: string;
  tone?: Tone;
  // for a screen reader, when the visible label is not enough on its own.
  accessibilityLabel?: string;
  // a number that changes (the XP chip): digits of equal width, so the chip does not jump.
  tabular?: boolean;
};

// `accent` comes from the theme (colors.accent), the others are fixed.
const TONE_COLOR: Record<Tone, string | null> = {
  default: null,
  blue: '#0284C7',
  green: '#22C55E',
  accent: null,
};

type Props = {
  items: BadgeItem[];
  colors: ColorScheme;
  // one line, never wraps: the chips shrink and their labels scale down to fit (the Learn header's five count chips).
  singleLine?: boolean;
};

// label props for `singleLine`: one line, font shrinks down to 70 % before it is cut.
const MIN_FONT_SCALE = 0.7;
const FIT_LABEL = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: MIN_FONT_SCALE } as const;

// React Native Web ignores adjustsFontSizeToFit, so there numberOfLines alone cuts the label with an ellipsis ("du…"). On the web
// the row does the same shrinking itself. Where even the smallest font is cut (the widest fonts on a narrow screen), the chips
// keep their size and wrap: a count that cannot be read is worse than a second line.
export function fitLabels(row: HTMLElement, labels: HTMLElement[]) {
  const setFontSize = (value: string) => labels.forEach((label) => { label.style.fontSize = value; });
  const anyCut = () => labels.some((label) => label.scrollWidth > label.clientWidth);
  row.style.flexWrap = '';
  setFontSize('');
  if (!anyCut()) return;
  const base = parseFloat(getComputedStyle(labels[0]).fontSize);
  for (let percent = 95; percent >= MIN_FONT_SCALE * 100; percent -= 5) {
    setFontSize(`${(base * percent) / 100}px`);
    if (!anyCut()) return;
  }
  setFontSize('');
  row.style.flexWrap = 'wrap';
}

// small boxes on the brutalist palette (due = b, XP = a fill).
const TONE_FILL: Record<Tone, BrutalFill> = { default: 'paper', blue: 'b', green: 'paper', accent: 'a' };

export default function BadgeRow({ items, colors, singleLine = false }: Props) {
  const g = useGrammarColors();
  const fit = singleLine ? FIT_LABEL : null;
  const webFit = singleLine && Platform.OS === 'web';
  const row = useRef<View>(null);
  const labels = useRef<(HTMLElement | null)[]>([]);
  const [, refit] = useReducer((n: number) => n + 1, 0);
  // After every render, before the paint, and again when the row's width changes or a font arrives (a theme's font is wider
  // than its fallback, and nothing else re-renders the row then).
  useLayoutEffect(() => {
    if (webFit && row.current) fitLabels(row.current as unknown as HTMLElement, labels.current.filter((label) => label !== null));
  });
  useEffect(() => {
    if (!webFit) return;
    document.fonts.addEventListener('loadingdone', refit);
    return () => document.fonts.removeEventListener('loadingdone', refit);
  }, [webFit]);
  const onRowLayout = webFit ? refit : undefined;
  if (g.brutal) {
    return (
      <View ref={row} style={[styles.row, singleLine && styles.rowSingle]} onLayout={onRowLayout}>
        {items.map((item, i) => {
          const fill = TONE_FILL[item.tone ?? 'default'];
          return (
            <BrutalBox
              key={i}
              fill={fill}
              offset={2}
              style={singleLine ? styles.chipShrink : undefined}
              boxStyle={[styles.brutalBadge, singleLine && styles.brutalBadgeSingle]}
            >
              <Text
                {...fit}
                ref={(node) => {
                  labels.current[i] = node as unknown as HTMLElement | null;
                }}
                accessibilityLabel={item.accessibilityLabel}
                style={[styles.brutalBadgeText, { color: textOnFill(g, fill) }, item.tabular && styles.tabular]}
              >
                {item.label}
              </Text>
            </BrutalBox>
          );
        })}
      </View>
    );
  }
  return (
    <View ref={row} style={[styles.row, singleLine && styles.rowSingle]} onLayout={onRowLayout}>
      {items.map((item, i) => (
        <View key={i} style={[styles.badge, singleLine && styles.chipShrink, { backgroundColor: colors.card }]}>
          <Text
            {...fit}
            ref={(node) => {
              labels.current[i] = node as unknown as HTMLElement | null;
            }}
            accessibilityLabel={item.accessibilityLabel}
            style={[
              styles.badgeText,
              { color: legibleOn((item.tone === 'accent' ? colors.accent : TONE_COLOR[item.tone ?? 'default']) ?? colors.text, colors.card) },
              item.tabular && styles.tabular,
            ]}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    // the sum of the Spanish-labelled chips is wider than the screen; without this the
    // row does not shrink to its parent, so it never wrapped and the last chip stuck out.
    flexShrink: 1,
  },
  rowSingle: { flexWrap: 'nowrap' },
  // minWidth 0 lets a flex child shrink below its text's natural width.
  chipShrink: { flexShrink: 1, minWidth: 0 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  brutalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2 },
  brutalBadgeSingle: { paddingHorizontal: 6 },
  brutalBadgeText: { fontSize: 13, fontWeight: '500' },
  tabular: { fontVariant: ['tabular-nums'] },
});
