import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import CloudLogin from '@/components/cloud/CloudLogin';
import { ActionButton, TitleText } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import type { LoginData } from '@/lib/cloud/api';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import ScreenFeedback from '@/lib/screenFeedback';
import { useTheme } from '@/lib/ThemeContext';

// The web welcome screen of a returning visitor without a saved sign-in (and, from the Settings row, the sign-in chooser
// inside the guest mode): Sign in, Create account and a third button the caller names ("Skip" or "Cancel").
// Both sign-in screens come back here with their Back button.
type Step = 'choose' | 'signin' | 'create';

export default function CloudWelcome({ onLoggedIn, thirdLabel, onThird }: { onLoggedIn: (data: LoginData) => void; thirdLabel: string; onThird: () => void }) {
  const s = t().cloud;
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const [view, setView] = useState<Step>('choose');

  if (view !== 'choose') return <CloudLogin mode={view} onLoggedIn={onLoggedIn} onBack={() => setView('choose')} />;

  const classicFilled = [styles.button, styles.classicButton, { backgroundColor: colors.tint }];
  return (
    <View testID="cloud-welcome" style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <TitleText variant="title" style={[styles.title, { color: g.ink }]}>{s.welcomeTitle}</TitleText>
          <Text style={[styles.hint, { color: g.mu }]}>{s.welcomeText}</Text>
          <ActionButton
            testID="cloud-welcome-signin"
            label={s.welcomeSignIn}
            onPress={() => setView('signin')}
            brutalStyle={styles.button}
            classicStyle={classicFilled}
            classicTextStyle={[styles.classicButtonText, { color: colors.onTint }]}
          />
          <ActionButton
            testID="cloud-welcome-create"
            label={s.welcomeCreate}
            onPress={() => setView('create')}
            brutalStyle={styles.button}
            classicStyle={classicFilled}
            classicTextStyle={[styles.classicButtonText, { color: colors.onTint }]}
          />
          <ActionButton
            testID="cloud-welcome-third"
            label={thirdLabel}
            onPress={onThird}
            fill="paper"
            brutalStyle={styles.button}
            classicStyle={[styles.button, styles.classicButton, { borderWidth: 1, borderColor: colors.tint }]}
            classicTextStyle={[styles.classicButtonText, { color: colors.tint }]}
          />
        </View>
      </ScrollView>
      {/* the feedback button works here too, like on the sign-in screen: no account needed. */}
      <ScreenFeedback level="-" languagePair={pairOf('es')} currentCard="cloud-welcome" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  form: { width: '100%', maxWidth: 360, gap: spacing.sm },
  title: { fontSize: fontSize.xl, lineHeight: lineHeight.xl, textAlign: 'center' },
  hint: { fontSize: fontSize.sm, lineHeight: lineHeight.sm, textAlign: 'center', marginBottom: spacing.md },
  button: { alignSelf: 'stretch', marginTop: spacing.md },
  classicButton: { minHeight: tapTarget, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  classicButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
