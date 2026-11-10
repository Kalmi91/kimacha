import { StyleSheet } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

/** The classic look's exam tag (the brutal look uses a Sticker); same pattern as the core tag, in the theme tint. */
export function ExamTagClassic({ topicId }: { topicId: string }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <Text testID={`grammar-exam-tag-${topicId}`} style={[styles.tag, { color: legibleOn(colors.tint, colors.card), borderColor: colors.tint }]}>
      {t().grammar.examTag}
    </Text>
  );
}

const styles = StyleSheet.create({
  tag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
