import { StyleSheet, View, Text, Pressable, type LayoutChangeEvent } from 'react-native';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalButton } from '@/components/grammar/Brutal';

type ColorScheme = (typeof Colors)['light'];

// FB170 (a TypingCardScreen-ből költözött, 1:1): a billentyűzet felső élén
// ülő egyetlen Check/→ sáv. A `dockedAction`/`inlineCheckBtn` stílusértékek
// változatlanok, csak ide költöztek, hogy a PCIC is használhassa.
export const DOCK_RESERVE = 76;
// A 💬 gomb (55 px + 12 px rés) helye a sáv jobb szélén, ahol a Learn kártya mellé teszi (endInset).
export const FEEDBACK_INSET = 67;

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
  /** Extra jobb oldali hely (px), hogy a sáv mellett egy lebegő gomb (a 💬) elférjen, a sávot nem takarva. */
  endInset?: number;
  colors: ColorScheme;
  /** A tényleges kirajzolt magasság, hogy a hívó beállíthassa a görgető alsó paddingjét és a 💬 bottomOffsetjét. */
  onHeight?: (h: number) => void;
};

export default function DockedAction({ label, onPress, tone, color, bottom, endInset, colors, onHeight }: Props) {
  const g = useGrammarColors();
  return (
    <View
      style={[styles.dockedAction, { bottom, backgroundColor: colors.background }, endInset ? { paddingRight: 20 + endInset } : null]}
      onLayout={onHeight ? (e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height) : undefined}
    >
      {g.brutal ? (
        // NY19: Check = ink kitöltés, Next = a kitöltés.
        <BrutalButton testID="learn-docked-action" label={label} fill={tone === 'next' ? 'a' : 'ink'} onPress={onPress} />
      ) : (
        <Pressable style={[styles.inlineCheckBtn, { backgroundColor: color ?? TONE_COLOR[tone] }]} onPress={onPress}>
          <Text style={styles.inlineCheckText}>{label}</Text>
        </Pressable>
      )}
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
