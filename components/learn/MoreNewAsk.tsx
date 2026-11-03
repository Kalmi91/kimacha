import { View } from 'react-native';
import { Text } from '@/components/KText';
import { ActionButton } from '@/components/grammar/Themed';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { PCIC_NEW_BONUS_STEPS } from '@/lib/pcicSession';
import { styles } from './pcicStyles';

type ColorScheme = (typeof Colors)['light'];

// FB542: the question that replaces the card when the day's new words are done but reviews are left: +5 / +10 / +15
// (the row of the "done for today" screen) or "No, only reviews".
export default function MoreNewAsk({ colors, onPick, onDecline }: { colors: ColorScheme; onPick: (step: number) => void; onDecline: () => void }) {
  const s = t();
  return (
    <View testID="learn-ask-more-new" style={[styles.moreNewBlock, styles.moreNewAskBlock]}>
      <Text style={[styles.moreNewAsk, { color: colors.text }]}>{s.pcic.moreNewAsk}</Text>
      <View style={styles.moreNewRow}>
        {PCIC_NEW_BONUS_STEPS.map((n) => (
          <ActionButton
            key={n}
            testID={`learn-ask-new-${n}`}
            accessibilityLabel={s.pcic.moreNew(n)}
            label={s.pcic.moreNewShort(n)}
            onPress={() => onPick(n)}
            brutalStyle={styles.moreNewBtn}
            classicStyle={[styles.checkBtn, styles.moreNewBtn, { backgroundColor: colors.tint }]}
            classicTextStyle={styles.checkBtnText}
          />
        ))}
      </View>
      <View style={styles.moreNewRow}>
        <ActionButton
          testID="learn-ask-new-no"
          label={s.pcic.moreNewNo}
          onPress={onDecline}
          fill="paper"
          brutalStyle={styles.moreNewBtn}
          classicStyle={[styles.checkBtn, styles.moreNewBtn, { backgroundColor: colors.tabIconDefault }]}
          classicTextStyle={styles.checkBtnText}
        />
      </View>
    </View>
  );
}
