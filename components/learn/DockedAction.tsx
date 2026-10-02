import { StyleSheet, View, Pressable, type LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalButton } from '@/components/grammar/Brutal';
import { useSkinDecor } from '@/components/skins';
import { legibleOn } from '@/constants/Skins';

type ColorScheme = (typeof Colors)['light'];

// FB170 (a TypingCardScreen-ből költözött, 1:1): a billentyűzet felső élén
// ülő egyetlen Check/→ sáv. A `dockedAction`/`inlineCheckBtn` stílusértékek
// változatlanok, csak ide költöztek, hogy a PCIC is használhassa.
export const DOCK_RESERVE = 76;
// A sáv fölé emelt 💬 (FeedbackModal) alatt a görgető alján ennyi hely kell a sáv (dockH + dockLift)
// fölött: a gomb alsó távolsága (styles.fab.bottom 24) + magassága (styles.brutalFab.height 55) + 12 px rés.
export const FAB_CLEARANCE = 24 + 55 + 12;

export type DockedActionTone = 'check' | 'next';
type Tone = DockedActionTone;

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
  /** A gomb azonosítója (alap: `learn-docked-action`); a nyelvtani drillben a régi inline gomb azonosítóját viszi tovább. */
  testID?: string;
  /** Letiltott gomb (a vizsga beírós kártyáján üres válasznál). */
  disabled?: boolean;
};

export default function DockedAction({ label, onPress, tone, color, bottom, colors, onHeight, testID, disabled }: Props) {
  const g = useGrammarColors();
  const checkFill = useSkinDecor().checkFill;
  return (
    <View
      testID="learn-dock"
      style={[styles.dockedAction, { bottom, backgroundColor: colors.background }]}
      onLayout={onHeight ? (e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height) : undefined}
    >
      {g.brutal ? (
        // NY19: Check = ink kitöltés, Next = a kitöltés.
        <BrutalButton testID={testID ?? 'learn-docked-action'} label={label} fill={tone === 'next' ? 'a' : checkFill ?? 'ink'} icon={tone === 'next' ? '→' : '✓'} disabled={disabled} onPress={onPress} />
      ) : (
        <Pressable
          testID={testID}
          disabled={disabled}
          style={[styles.inlineCheckBtn, { backgroundColor: legibleOn(color ?? TONE_COLOR[tone], '#FFFFFF') }, disabled && styles.disabled]}
          onPress={onPress}
        >
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
  disabled: { opacity: 0.4 },
  inlineCheckText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
