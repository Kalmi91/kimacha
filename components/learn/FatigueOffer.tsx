import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { ActionButton } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import type { FatigueOffer as Offer } from '@/lib/learn/fatigueDetector';
import { styles } from './pcicStyles';

export default function FatigueOffer({ colors, offer, onAccept, onDecline }: {
  colors: (typeof Colors)['light']; offer: Offer; onAccept: () => void; onDecline: () => void;
}) {
  const s = t().pcic.fatigueOffer;
  return (
    <View testID="learn-fatigue-offer" style={[styles.moreNewBlock, styles.moreNewAskBlock]}>
      <Text style={[styles.moreNewAsk, { color: colors.text }]}>{offer.reason === 'repeat-misses' ? s.repeatMisses : s.slowdown}</Text>
      <Text style={[styles.moreNewAsk, { color: colors.text }]}>{s.question}</Text>
      <View style={[styles.moreNewRow, offerStyles.actions]}>
        <ActionButton testID="learn-fatigue-offer-yes" label={s.yes} accessibilityLabel={s.yes} onPress={onAccept}
          brutalStyle={[styles.moreNewBtn, offerStyles.button]} classicStyle={[styles.checkBtn, styles.moreNewBtn, offerStyles.button, { backgroundColor: colors.tint }]} classicTextStyle={styles.checkBtnText} />
        <ActionButton testID="learn-fatigue-offer-no" label={s.no} accessibilityLabel={s.no} onPress={onDecline} fill="paper"
          brutalStyle={[styles.moreNewBtn, offerStyles.button]} classicStyle={[styles.checkBtn, styles.moreNewBtn, offerStyles.button, { backgroundColor: colors.tabIconDefault }]} classicTextStyle={styles.checkBtnText} />
      </View>
    </View>
  );
}

const offerStyles = StyleSheet.create({
  actions: { flexWrap: 'wrap' },
  button: { flexBasis: 160, minHeight: 44 },
});
