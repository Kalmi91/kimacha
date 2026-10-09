import { Pressable, ScrollView, StyleSheet, Text as RNText, View, useColorScheme, type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { ONBOARDING_SKINS, SKINS, legibleOn, resolveMode, type SkinId } from '@/constants/Skins';
import { BrutalButton, radiusStyle, roleColor } from '@/components/grammar/Brutal';
import { useGrammarColors, grammarColorsFor } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { themeKeyFor } from '@/lib/skinTheme';
import { useSkin } from '@/lib/useSkin';
import { useTheme } from '@/lib/ThemeContext';

// The two new onboarding steps, the intro ("How it works") and the 5-theme picker.
// In the style of today's onboarding: centred content, the title is welcomeStyle (given by the caller),
// BrutalButton on the brutalist palette, today's round button on classic.

function StartButton({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  const g = useGrammarColors();
  if (g.brutal) return <BrutalButton testID={testID} label={label} onPress={onPress} style={styles.brutalBtn} />;
  return (
    <Pressable testID={testID} accessibilityRole="button" style={[styles.startBtn, { backgroundColor: Colors[theme].tint }]} onPress={onPress}>
      <Text style={[styles.startBtnText, { color: Colors[theme].onTint }]}>{label}</Text>
    </Pressable>
  );
}

// The intro: the first point and the highlighted "Don't overdo it" box, the closing line faint.
export function OnboardingIntro({ titleStyle, onStart }: { titleStyle: StyleProp<TextStyle>; onStart: () => void }) {
  const { theme } = useTheme();
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const i = t().intro;
  const box = g.brutal ? { borderWidth: shape.borderWidth, ...radiusStyle(shape.radius) } : { borderWidth: 2, borderRadius: 12 };
  const lines = [i.words, i.grammar, i.exam, i.repetition];
  return (
    <ScrollView
      testID="onboarding-intro"
      style={{ backgroundColor: Colors[theme].background }}
      contentContainerStyle={styles.scroll}
    >
      <Text variant="title" style={titleStyle}>{i.title}</Text>
      <View testID="intro-first" style={[styles.box, box, { borderColor: g.a, backgroundColor: g.paper }]}>
        <Text style={[styles.itemText, { color: g.ink }]}>{i.first}</Text>
      </View>
      {lines.map((line) => (
        <View key={line} style={styles.row}>
          <Text style={[styles.bullet, { color: legibleOn(g.a, g.bg, 3) }]}>•</Text>
          <Text style={[styles.itemText, styles.rowText, { color: g.ink }]}>{line}</Text>
        </View>
      ))}
      <View testID="intro-overdo" style={[styles.box, box, { borderColor: g.brutal ? roleColor(g, shape.borderColor) : g.b, backgroundColor: g.b }]}>
        <Text style={[styles.itemText, { color: g.onB }]}>{i.overdo}</Text>
      </View>
      <Text testID="intro-closing" style={[styles.closing, { color: g.mu }]}>{i.closing}</Text>
      <StartButton testID="onboarding-intro-start" label={i.start} onPress={onStart} />
    </ScrollView>
  );
}

// One theme row: the theme's own background, font (the word + the button), border and `a`-coloured "I know" button,
// with the sample word. Not KText: the row shows ITS OWN theme, not the active one.
function ThemeSampleRow({ id, selected, onPress }: { id: SkinId; selected: boolean; onPress: () => void }) {
  const { override, grammarPalette } = useTheme();
  const scheme = useColorScheme();
  const active = useGrammarColors();
  const o = t().onboardingTheme;
  const skin = SKINS[id];
  const mode = resolveMode(skin.modes, override, scheme === 'light' ? 'light' : 'dark');
  const c = grammarColorsFor(themeKeyFor(id, mode, grammarPalette));
  const { shape, fonts } = skin;
  const shift = shape.shadowOffset;
  const radius = radiusStyle(shape.radius);
  const wordStyle: TextStyle = { color: c.ink, fontSize: 26, letterSpacing: skin.letterSpacing };
  if (fonts.word) wordStyle.fontFamily = fonts.word;
  if (skin.uppercaseWord) wordStyle.textTransform = 'uppercase';
  const knowStyle: TextStyle = { color: c.onA, fontSize: 14 };
  if (fonts.body) knowStyle.fontFamily = fonts.body;
  // the theme name in small type under the sample word.
  const nameStyle: TextStyle = { color: c.mu, fontSize: 11 };
  if (fonts.body) nameStyle.fontFamily = fonts.body;
  return (
    <Pressable
      testID={`onboarding-theme-${id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t().skins.names[id]}
      accessibilityState={{ selected }}
      style={[styles.ring, { borderColor: selected ? active.ink : 'transparent' }]}
    >
      <View style={{ marginRight: shift, marginBottom: shift }}>
        {shift > 0 ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: shift, top: shift, right: -shift, bottom: -shift, backgroundColor: roleColor(c, shape.shadowColor), ...radius }}
          />
        ) : null}
        <View
          style={[
            styles.sample,
            {
              backgroundColor: c.bg,
              borderWidth: shape.borderWidth,
              borderColor: roleColor(c, shape.borderColor),
              borderStyle: shape.borderStyle,
              ...radius,
            },
          ]}
        >
          <View style={styles.sampleText}>
            <RNText style={wordStyle}>{o.sampleWord}</RNText>
            <RNText testID={`onboarding-theme-name-${id}`} style={nameStyle}>
              {t().skins.names[id]}
            </RNText>
          </View>
          <View style={[styles.know, { backgroundColor: c.a, ...radiusStyle(shape.buttonRadius) }]}>
            <RNText style={knowStyle}>{o.know}</RNText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// The theme step: the 5 recommended themes; tapping applies one at once, "Continue" moves on.
export function OnboardingThemeStep({ titleStyle, onNext }: { titleStyle: StyleProp<TextStyle>; onNext: () => void }) {
  const { theme, setSkin } = useTheme();
  const g = useGrammarColors();
  const { id } = useSkin();
  const o = t().onboardingTheme;
  return (
    <ScrollView
      testID="onboarding-theme"
      style={{ backgroundColor: Colors[theme].background }}
      contentContainerStyle={styles.scroll}
    >
      <Text variant="title" style={titleStyle}>{o.title}</Text>
      {ONBOARDING_SKINS.map((skinId) => (
        <ThemeSampleRow key={skinId} id={skinId} selected={id === skinId} onPress={() => setSkin(skinId)} />
      ))}
      <Text style={[styles.later, { color: g.mu }]}>{o.later}</Text>
      <StartButton testID="onboarding-theme-next" label={o.next} onPress={onNext} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  brutalBtn: { minWidth: 240 },
  startBtn: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 14 },
  startBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  box: { alignSelf: 'stretch', padding: 12 },
  itemText: { fontSize: 16, lineHeight: 22 },
  row: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  rowText: { flex: 1 },
  bullet: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  closing: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  ring: { alignSelf: 'stretch', borderWidth: 3, padding: 3 },
  sample: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  sampleText: { flexShrink: 1 },
  know: { paddingHorizontal: 14, paddingVertical: 8 },
  later: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 12 },
});
