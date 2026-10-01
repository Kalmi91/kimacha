import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { BrutalBox } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';

// PLAN-fb1001 K2: a közös 🔊 / ⏹ gomb. Brutalista palettán a játékok kis
// ikon-gombjaival (✕ a GrammarDrill fejlécén, ← a lecke-oldalon) egyező doboz:
// BrutalBox, offset 2, papír kitöltés, ink keret + eltolt árnyék. Classic
// palettán a mai megjelenés: a hívó adja a stílusokat (style / iconStyle / labelStyle).
type Props = {
  onPress: () => void;
  /** ⏹ a 🔊 helyett (a lecke-felolvasás play<->stop gombja). */
  speaking?: boolean;
  /** PLAN-fb1001 13. lépés (FB440): más ikon (pl. 💡 a súgó-gombon), ugyanabban a játék-stílusban. */
  icon?: string;
  /** Ikon melletti felirat (a "Read aloud" sorok); nélküle csak ikon. */
  label?: string;
  testID?: string;
  accessibilityLabel?: string;
  /** Classic: a Pressable stílusa. */
  style?: StyleProp<ViewStyle>;
  /** Classic: az ikon stílusa. */
  iconStyle?: StyleProp<TextStyle>;
  /** A felirat stílusa (brutalistán a színt az ink felülírja). */
  labelStyle?: StyleProp<TextStyle>;
  /** Brutalista: a doboz külső (elrendezési) stílusa. */
  brutalStyle?: StyleProp<ViewStyle>;
  /** Classic: hitSlop (px), ahol a mai gombnak van. */
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
