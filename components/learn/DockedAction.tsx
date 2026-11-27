import { StyleSheet, View, Pressable, type LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalButton } from '@/components/grammar/Brutal';
import ExamButton from '@/components/exam/ExamButton';
import { useSkinDecor } from '@/components/skins';
import { legibleOn } from '@/constants/Skins';
import { t } from '@/lib/i18n';

type ColorScheme = (typeof Colors)['light'];

// Moved here from TypingCardScreen (1:1): the single Check/→ bar
// sitting on the keyboard's top edge. The `dockedAction`/`inlineCheckBtn` style values
// are unchanged, they just moved here so PCIC can use them too.
export const DOCK_RESERVE = 76;
// Under the 💬 (FeedbackModal) lifted above the bar, the bottom of the scroller needs this much room above the bar (dockH + dockLift):
// the button's bottom distance (styles.fab.bottom 24) + its height (styles.brutalFab.height 55) + a 12 px gap.
export const FAB_CLEARANCE = 24 + 55 + 12;

export type DockedActionTone = 'check' | 'next';
type Tone = DockedActionTone;

const TONE_COLOR: Record<Tone, string> = {
  check: '#38BDF8',
  next: '#1D4ED8',
};

/** The default label of a tone: the words card's Check, and the plain Next. */
export function defaultActionLabel(tone: Tone): string {
  const s = t();
  return tone === 'next' ? `${s.card.next} →` : `✓ ${s.card.check}`;
}

export type DockActionButtonProps = {
  /** Default per tone (see defaultActionLabel). */
  label?: string;
  onPress: () => void;
  tone: Tone;
  /** The caller can override the tone's base colour with this (Learn passes its own logic here, which depends on whether the prediction came true). */
  color?: string;
  /** The button's id (default on the brutal skins: `learn-docked-action`). */
  testID?: string;
  disabled?: boolean;
};

// The one Check / Next button, shared by the docked bar (DockedAction) and the inline twin (InlineAction),
// so the two cannot drift. Moved here 1:1 from DockedAction (the `inlineCheckBtn` style values are unchanged).
export function DockActionButton({ label, onPress, tone, color, testID, disabled }: DockActionButtonProps) {
  const g = useGrammarColors();
  const checkFill = useSkinDecor().checkFill;
  const text = label ?? defaultActionLabel(tone);
  return g.brutal ? (
    // Check = ink fill, Next = the fill.
    <BrutalButton testID={testID ?? 'learn-docked-action'} label={text} fill={tone === 'next' ? 'a' : checkFill ?? 'ink'} icon={tone === 'next' ? '→' : '✓'} disabled={disabled} onPress={onPress} />
  ) : (
    <Pressable
      testID={testID}
      disabled={disabled}
      style={[styles.inlineCheckBtn, { backgroundColor: legibleOn(color ?? TONE_COLOR[tone], '#FFFFFF') }, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.inlineCheckText}>{text}</Text>
    </Pressable>
  );
}

type Props = {
  /** Default per tone (the words card's Check / the plain Next), see DockActionButton. */
  label?: string;
  onPress: () => void;
  tone: Tone;
  /** The caller can override the tone's base colour with this (Learn passes its own logic here, which depends on whether the prediction came true). */
  color?: string;
  bottom: number;
  colors: ColorScheme;
  /** The height actually drawn, so the caller can set the scroller's bottom padding and the 💬 bottomOffset. */
  onHeight?: (h: number) => void;
  /** The button's id (default: `learn-docked-action`); in the grammar drill it carries over the old inline button's id. */
  testID?: string;
  /** Disabled button (on the exam's typed card when the answer is empty). */
  disabled?: boolean;
  /** A quieter second button above the main one. */
  secondary?: { label: string; testID?: string; onPress: () => void };
};

export default function DockedAction({ label, onPress, tone, color, bottom, colors, onHeight, testID, disabled, secondary }: Props) {
  return (
    <View
      testID="learn-dock"
      style={[styles.dockedAction, { bottom, backgroundColor: colors.background }]}
      onLayout={onHeight ? (e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height) : undefined}
    >
      {secondary ? (
        <View style={styles.secondaryGap}>
          <ExamButton testID={secondary.testID} secondary label={secondary.label} onPress={secondary.onPress} />
        </View>
      ) : null}
      <DockActionButton testID={testID} label={label} tone={tone} color={color} disabled={disabled} onPress={onPress} />
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
  // Room between the quiet "I mistyped" and the main button (FB718).
  secondaryGap: { marginBottom: 12 },
});
