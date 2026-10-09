import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { BrutalBox } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';

// The shared 🔊 / ⏹ button. On the brutalist palette a box matching the small
// icon buttons of the games (✕ in the GrammarDrill header, ← on the lesson page):
// BrutalBox, offset 2, paper fill, ink border + offset shadow. On the classic
// palette today's look: the caller supplies the styles (style / iconStyle / labelStyle).
type Props = {
  onPress: () => void;
  /** ⏹ instead of 🔊 (the play<->stop button of the lesson read-aloud). */
  speaking?: boolean;
  /** a different icon (e.g. 💡 on the hint button), in the same game style. */
  icon?: string;
  /** Label next to the icon (the "Read aloud" rows); without it, icon only. */
  label?: string;
  testID?: string;
  accessibilityLabel?: string;
  /** Classic: the Pressable's style. */
  style?: StyleProp<ViewStyle>;
  /** Classic: the icon's style. */
  iconStyle?: StyleProp<TextStyle>;
  /** The label's style (on brutalist the colour is overridden by ink). */
  labelStyle?: StyleProp<TextStyle>;
  /** Brutalist: the box's outer (layout) style. */
  brutalStyle?: StyleProp<ViewStyle>;
  /** Classic: hitSlop (px), where today's button has one. */
  hitSlop?: number;
};

export default function SpeakButton({
  onPress,
  speaking = false,
  icon: iconProp,
  label,
  testID,
  accessibilityLabel,
  style,
  iconStyle,
  labelStyle,
  brutalStyle,
  hitSlop,
}: Props) {
  const g = useGrammarColors();
  const icon = iconProp ?? (speaking ? '⏹' : '🔊');
  if (g.brutal) {
    return (
      <BrutalBox
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        offset={2}
        onPress={onPress}
        style={[styles.brutalOuter, brutalStyle]}
        boxStyle={label ? styles.brutalBoxLabel : styles.brutalBox}
      >
        <Text style={styles.brutalIcon}>{icon}</Text>
        {label ? <Text style={[labelStyle, { color: g.ink }]}>{label}</Text> : null}
      </BrutalBox>
    );
  }
  return (
    <Pressable testID={testID} accessibilityLabel={accessibilityLabel} style={style} onPress={onPress} hitSlop={hitSlop}>
      <Text style={iconStyle}>{icon}</Text>
      {label ? <Text style={labelStyle}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brutalOuter: { flexShrink: 0 },
  brutalBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  brutalBoxLabel: { height: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brutalIcon: { fontSize: 18 },
});
