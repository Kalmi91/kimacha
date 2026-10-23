import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';

import { ActionButton, TitleText, themedInputStyle } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { login, type CloudFailure, type LoginData } from '@/lib/cloud/api';
import { NAME_MAX, isValidName, isValidPin } from '@/lib/cloud/validate';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import ScreenFeedback from '@/lib/screenFeedback';
import { useTheme } from '@/lib/ThemeContext';

// The web sign-in screen: name + 4-digit PIN. A new name makes a new account, a known name with the right PIN
// brings the saved progress back. The caller (CloudGate) takes over once login() answered with a token.
function errorText(failure: CloudFailure): string {
  const s = t().cloud;
  switch (failure.error) {
    case 'bad_pin':
      return s.errorBadPin;
    case 'locked':
      return s.errorLocked(Math.max(1, Math.ceil((failure.retryAfterSec ?? 0) / 60)));
    case 'network':
      return s.errorNetwork;
    case 'bad_input':
      return s.errorBadInput;
    default:
      return s.errorServer;
  }
}

export default function CloudLogin({ onLoggedIn }: { onLoggedIn: (data: LoginData) => void }) {
  const s = t().cloud;
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = isValidName(name) && isValidPin(pin) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await login(name, pin);
    if (res.ok) {
      onLoggedIn(res.data);
      return;
    }
    setBusy(false);
    setError(errorText(res));
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)];
  return (
    <View testID="cloud-login" style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <TitleText variant="title" style={[styles.title, { color: g.ink }]}>{s.title}</TitleText>
          <Text style={[styles.hint, { color: g.mu }]}>{s.hint}</Text>
          <Text style={[styles.label, { color: g.ink }]}>{s.nameLabel}</Text>
          <TextInput
            testID="cloud-login-name"
            accessibilityLabel={s.nameLabel}
            style={inputStyle}
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            placeholder={s.namePlaceholder}
            placeholderTextColor={colors.tabIconDefault}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Text style={[styles.label, { color: g.ink }]}>{s.pinLabel}</Text>
          <TextInput
            testID="cloud-login-pin"
            accessibilityLabel={s.pinLabel}
            style={inputStyle}
            value={pin}
            onChangeText={(v) => { setPin(v.replace(/\D/g, '')); setError(null); }}
            placeholder={s.pinPlaceholder}
            placeholderTextColor={colors.tabIconDefault}
            maxLength={4}
            secureTextEntry
            keyboardType="number-pad"
            inputMode="numeric"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
          />
          {error ? <Text testID="cloud-login-error" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <ActionButton
            testID="cloud-login-submit"
            label={s.submit}
            onPress={submit}
            disabled={!canSubmit}
            brutalStyle={styles.button}
            classicStyle={[styles.button, styles.classicButton, { backgroundColor: colors.tint, opacity: canSubmit ? 1 : 0.4 }]}
            classicTextStyle={[styles.classicButtonText, { color: colors.onTint }]}
          />
        </View>
      </ScrollView>
      {/* the feedback button works before sign-in too: it sends the text to the feedback sheet, no account needed.
          The pair is not known yet, so it is the default of a fresh install (en→es). */}
      <ScreenFeedback level="-" languagePair={pairOf('es')} currentCard="cloud-login" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  form: { width: '100%', maxWidth: 360, gap: spacing.sm },
  title: { fontSize: fontSize.xl, lineHeight: lineHeight.xl, textAlign: 'center' },
  hint: { fontSize: fontSize.sm, lineHeight: lineHeight.sm, textAlign: 'center', marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  input: { minHeight: tapTarget, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: fontSize.md },
  error: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  button: { alignSelf: 'stretch', marginTop: spacing.md },
  classicButton: { minHeight: tapTarget, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  classicButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
