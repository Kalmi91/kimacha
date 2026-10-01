import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalButton } from '@/components/grammar/Brutal';

export default function NotFoundScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>This screen doesn&apos;t exist.</Text>

        {g.brutal ? (
          // NY25: brutalista palettán fő gomb; a Link asChild adja a navigációt.
          <Link href="/" asChild>
            <BrutalButton testID="not-found-home" fill="a" label="Go to home screen!" onPress={() => {}} style={styles.brutalLink} />
          </Link>
        ) : (
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  brutalLink: { marginTop: 15 },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#2e78b7',
  },
});
