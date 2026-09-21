import { StyleSheet, View, Text, Pressable, type LayoutChangeEvent } from 'react-native';

import Colors from '@/constants/Colors';

type ColorScheme = (typeof Colors)['light'];

// FB170 (a TypingCardScreen-ből költözött, 1:1): a billentyűzet felső élén
// ülő egyetlen Check/→ sáv. A `dockedAction`/`inlineCheckBtn` stílusértékek
// változatlanok, csak ide költöztek, hogy a PCIC is használhassa.
export const DOCK_RESERVE = 76;

type Tone = 'check' | 'next';

const TONE_COLOR: Record<Tone, string> = {
  check: '#38BDF8',
  next: '#1D4ED8',
};

type Props = {
  label: string;
  onPress: () => void;
  tone: Tone;
  /** A hívó ezzel felülírhatja a tone alapszínét (a Learn a saját, bejósolt-eltalálástól függő logikáját adja ide). */
  color?: string;
  bottom: number;
  colors: ColorScheme;
  /** A tényleges kirajzolt magasság, hogy a hívó beállíthassa a görgető alsó paddingjét és a 💬 bottomOffsetjét. */
  onHeight?: (h: number) => void;
};

export default function DockedAction({ label, onPress, tone, color, bottom, colors, onHeight }: Props) {
  return (
    <View
      style={[styles.dockedAction, { bottom, backgroundColor: colors.background }]}
      onLayout={onHeight ? (e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height) : undefined}
    >
      <Pressable style={[styles.inlineCheckBtn, { backgroundColor: color ?? TONE_COLOR[tone] }]} onPress={onPress}>
        <Text style={styles.inlineCheckText}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dockedAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  inlineCheckBtn: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCheckText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
