import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { BrutalBox } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { speechBusy, speechStatus, useSpeechStatus } from '@/lib/speechStatus';

// The shared 🔊 / ⏹ button. On the brutalist palette a box matching the small
// icon buttons of the games (✕ in the GrammarDrill header, ← on the lesson page):
// BrutalBox, offset 2, paper fill, ink border + offset shadow. On the classic
// palette today's look: the caller supplies the styles (style / iconStyle / labelStyle).
// The tap flash: the theme's main colour covers the button and fades out in this many ms.
const FLASH_MS = 300;

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
  const status = useSpeechStatus();
  const [pressedRun, setPressedRun] = useState<number | null>(null);
  const active = pressedRun === status.id && speechBusy(status.phase);
  const [flash] = useState(() => new Animated.Value(0));
  // a flash still fading must not outlive the button
  useEffect(() => () => flash.stopAnimation(), [flash]);
  const press = () => {
    onPress();
    if (!iconProp) setPressedRun(speechStatus().id);
    flash.stopAnimation();
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: FLASH_MS, useNativeDriver: true }).start();
  };
  const flashLayer = (
    <Animated.View
      testID={testID ? `${testID}-flash` : undefined}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, g.brutal ? null : styles.classicFlash, { backgroundColor: g.a, opacity: flash }]}
    />
  );
  const icon = iconProp ?? (speaking ? '⏹' : active ? (status.phase === 'loading' ? '⏳' : '🔉') : '🔊');
  // icon-only (no visible label): a spoken name for the screen reader.
  const a11yLabel = accessibilityLabel ?? (label || iconProp ? undefined : speaking ? t().a11y.stopSpeaking : t().a11y.speak);
  if (g.brutal) {
    return (
      <BrutalBox
        testID={testID}
        accessibilityLabel={a11yLabel}
        offset={2}
        onPress={press}
        style={[styles.brutalOuter, brutalStyle]}
        boxStyle={[label ? styles.brutalBoxLabel : styles.brutalBox, styles.clip]}
      >
        {flashLayer}
        <Text style={styles.brutalIcon}>{icon}</Text>
        {label ? <Text style={[labelStyle, { color: g.ink }]}>{label}</Text> : null}
      </BrutalBox>
    );
  }
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={a11yLabel} accessibilityState={{ busy: active }} style={style} onPress={press} hitSlop={hitSlop}>
      {flashLayer}
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
  clip: { overflow: 'hidden' },
  classicFlash: { borderRadius: 8 },
});
