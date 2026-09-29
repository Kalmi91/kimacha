import type { ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { Card } from '@/components/grammar/Brutal';

// NY19: brutalista palettán a szöveg egy BrutalBox kártyában, classic palettán a mai sima elrendezés.
function Wrap({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return g.brutal ? <Card testID="credits-card">{children}</Card> : <>{children}</>;
}

// PLAN-credits.md: word-data attribution screen, entered from Settings.
// Pattern follows app/spelling.tsx's header row (back arrow + centered title).
export default function CreditsScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const linkColor = g.brutal ? g.ink : colors.tint;
  const s = t();
  const router = useRouter();

  const links = [
    { label: s.credits.frequencyWordsLabel, url: s.credits.frequencyWordsUrl },
    { label: s.credits.openSubtitlesLabel, url: s.credits.openSubtitlesUrl },
    { label: s.credits.licenseLabel, url: s.credits.licenseUrl },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.exitBtn}>
          <Text style={[styles.exitIcon, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, styles.titleInRow, { color: colors.text }, g.brutal && styles.brutalTitle]}>{s.credits.title}</Text>
        <View style={styles.exitBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Wrap>
        <Text style={[styles.body, { color: colors.text }]}>{s.credits.body}</Text>

        {links.map((link) => (
          <Pressable key={link.url} onPress={() => Linking.openURL(link.url)}>
            <Text style={[styles.link, { color: linkColor }, g.brutal && styles.brutalLink]}>{link.label}</Text>
          </Pressable>
        ))}

        <Text style={[styles.body, styles.bodySpaced, { color: colors.text }]}>{s.credits.cefrjBody}</Text>
        <Pressable onPress={() => Linking.openURL(s.credits.cefrjUrl)}>
          <Text style={[styles.link, { color: linkColor }, g.brutal && styles.brutalLink]}>{s.credits.cefrjLabel}</Text>
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
