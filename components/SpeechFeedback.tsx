import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { spacing } from '@/constants/Theme';
import { t } from '@/lib/i18n';
import { useSpeechStatus } from '@/lib/speechStatus';
import { useTheme } from '@/lib/ThemeContext';

export default function SpeechFeedback() {
  const { error } = useSpeechStatus();
  const [dismissed, setDismissed] = useState<typeof error>(null);
  const { theme } = useTheme();
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setDismissed(error), 6000);
    return () => clearTimeout(timer);
  }, [error]);
  if (!error || error === dismissed) return null;
  const colors = Colors[theme];
  return (
    <View testID="speech-feedback-overlay" pointerEvents="none" style={[styles.toast, { backgroundColor: colors.card }]}>
      <Text testID="speech-feedback" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
        {t().audio[error.phase]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', top: 56, alignSelf: 'center', maxWidth: '90%', padding: spacing.sm, elevation: 4 },
});
