import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import { ActionButton, themedInputStyle } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { gradePcicAnswer, gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { styles } from './pcicStyles';

/**
 * FB659: a just-for-curiosity retype of the revealed word. Fully local: it only reads the answer and shows a
 * verdict, so it never touches the card, XP, counters, progress, mistakes or logs. The parent keys it per card.
 */
export default function RetypePractice({ colors, answerText, target, strictAccents, sentence, onOpen, onFocusField, onBlurField }: {
  colors: (typeof Colors)['light']; answerText: string; target: string; strictAccents: boolean; sentence: boolean;
  // The card scrolls the block up before the keyboard opens, so the window does not pan under the status bar.
  onOpen?: () => void; onFocusField?: (block: View) => void; onBlurField?: () => void;
}) {
  const blockRef = useRef<View>(null);
  const s = t().pcic.retype;
  const g = useGrammarColors();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [right, setRight] = useState<boolean | null>(null);
  const check = () => {
    if (typed.trim().length === 0) return;
    setRight(suggestedGrade((sentence ? gradeSentenceAnswer : gradePcicAnswer)(typed, answerText, strictAccents, target)) === 'good');
  };
  if (!open) {
    return (
      <ActionButton testID="learn-retype" label={s.button} accessibilityLabel={s.button} onPress={() => { setOpen(true); onOpen?.(); }} fill="paper"
        brutalStyle={styles.retypeBtn} classicStyle={[styles.retypeBtn, styles.checkBtn, { backgroundColor: colors.tabIconDefault }]} classicTextStyle={styles.checkBtnText} />
    );
  }
  return (
    <View ref={blockRef} style={styles.retypeBlock}>
      <View style={styles.retypeRow}>
      <TextInput
        testID="learn-retype-input"
        style={[styles.input, styles.retypeInput, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
        value={typed}
        onChangeText={(v) => { setTyped(v); setRight(null); }}
        onSubmitEditing={check}
        onFocus={() => blockRef.current && onFocusField?.(blockRef.current)}
        onBlur={onBlurField}
        placeholder={s.placeholder}
        placeholderTextColor={colors.tabIconDefault}
        {...answerInputProps}
      />
      <ActionButton testID="learn-retype-check" label={s.check} accessibilityLabel={s.check} onPress={check}
        brutalStyle={styles.retypeCheck} classicStyle={[styles.checkBtn, styles.retypeCheck, { backgroundColor: colors.tint }]} classicTextStyle={styles.checkBtnText} />
      </View>
      {right !== null && (
        <Text testID="learn-retype-result" style={[styles.moreNewAsk, { color: colors.text }]}>{right ? s.right : s.wrong}</Text>
      )}
    </View>
  );
}
