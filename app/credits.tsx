import type { ReactNode } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Linking } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { BrutalBackButton, Card } from '@/components/grammar/Brutal';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { FONT_LICENSES } from '@/constants/Fonts';

// the font weights (e.g. Jost + Jost-Bold) appear as one family.
const FONT_CREDITS = Object.values(FONT_LICENSES).filter(
  (f, i, all) => all.findIndex((o) => o.url === f.url) === i,
);

// on the brutalist palette the text is in a BrutalBox card, on the classic palette today's plain layout.
function Wrap({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return g.brutal ? <Card testID="credits-card">{children}</Card> : <>{children}</>;
}

// word-data attribution screen, entered from Settings.
// Pattern follows app/mistakes/index.tsx's header row (back arrow + centered title).
export default function CreditsScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const linkColor = g.brutal ? g.ink : colors.tint;
  const s = t();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, brutalHeaderRowStyle(g)]}>
        {g.brutal ? (
          <View style={styles.exitBtn}>
            <BrutalBackButton testID="credits-back" onPress={() => router.back()} />
          </View>
        ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={s.a11y.back} onPress={() => router.back()} hitSlop={12} style={styles.exitBtn}>
          <Text style={[styles.exitIcon, { color: colors.text }]}>←</Text>
        </Pressable>
        )}
        <Text variant="title" style={[styles.title, styles.titleInRow, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.credits.title}</Text>
        <View style={styles.exitBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Wrap>
        <Text style={[styles.body, { color: colors.text }]}>{s.credits.cefrjBody}</Text>
        <Pressable onPress={() => Linking.openURL(s.credits.cefrjUrl)}>
          <Text style={[styles.link, { color: linkColor }, g.brutal && styles.brutalLink]}>{s.credits.cefrjLabel}</Text>
        </Pressable>

        <Text style={[styles.body, styles.bodySpaced, { color: colors.text }]}>{s.credits.fontsBody}</Text>
        {FONT_CREDITS.map((font) => (
          <Pressable key={font.url} onPress={() => Linking.openURL(font.url)}>
            <Text testID="credits-font" style={[styles.link, { color: linkColor }, g.brutal && styles.brutalLink]}>
              {font.family} · {font.license}
            </Text>
          </Pressable>
        ))}

        <Text style={[styles.body, styles.bodySpaced, { color: colors.text }]}>{s.credits.photosBody}</Text>
        <Pressable onPress={() => Linking.openURL(s.credits.privacyUrl)}>
          <Text testID="credits-privacy" style={[styles.link, { color: linkColor }, g.brutal && styles.brutalLink]}>{s.credits.privacyLabel}</Text>
        </Pressable>
        </Wrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 0,
  },
  titleInRow: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  exitBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitIcon: {
    fontSize: 26,
    fontWeight: '700',
  },
  container: {
    padding: 20,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  // the font licenses paragraph (main 1b1c0c6 removed the old bodySpaced along with the
  // frequency source; here it lives on with the same value).
  bodySpaced: {
    marginTop: 8,
  },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalLink: { fontWeight: '500', textDecorationLine: 'underline' },
  link: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
});
