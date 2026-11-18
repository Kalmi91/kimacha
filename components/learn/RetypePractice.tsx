import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import { ActionButton, themedInputStyle } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { charDiff } from '@/lib/charDiff';
import { useDiffStyles } from '@/lib/useDiffStyles';
import { useGrammarColors } from '@/lib/grammarColors';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { useSkin } from '@/lib/useSkin';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { gradePcicAnswer, gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { styles } from './pcicStyles';

export { useRetypeRowScroll } from './useRetypeRowScroll';

/** The card's docked bar runs the retype check while the field waits for one (the same place as on the card). */
export type RetypeHandle = { check: () => void };

/**
 * FB659: a just-for-curiosity retype of the revealed word. Fully local: it only reads the answer and shows a
 * verdict, so it never touches the card, XP, counters, progress, mistakes or logs. The parent keys it per card.
 */
const RetypePractice = forwardRef<RetypeHandle, {
  colors: (typeof Colors)['light']; answerText: string; target: string; strictAccents: boolean; sentence: boolean; rowScroll?: { rowRef: React.RefObject<View | null>; onRowLayout: () => void };
  // The card scrolls the block up before the keyboard opens, so the window does not pan under the status bar.
  onOpen?: () => void; onFocusField?: (block: View) => void; onBlurField?: () => void;
  // True while the field is open and waits for a check: the docked bar then shows Check instead of Next.
  onPendingChange?: (pending: boolean) => void;
}>(function RetypePractice({ colors, answerText, target, strictAccents, sentence, rowScroll, onOpen, onFocusField, onBlurField, onPendingChange }, ref) {
  const blockRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const s = t().pcic.retype;
  const g = useGrammarColors();
  const diff = useDiffStyles();
  const { id: skin } = useSkin();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ right: boolean; best: string } | null>(null);
  // The keyboard opens by itself when the field opens and after Retype (the same delayed focus as a new card).
  const [focusSeq, setFocusSeq] = useState(0);
  useFocusOnNewCard(inputRef, open, `retype-${focusSeq}`);
  const check = () => {
    if (typed.trim().length === 0) return;
    const grade = (sentence ? gradeSentenceAnswer : gradePcicAnswer)(typed, answerText, strictAccents, target);
    setResult({ right: suggestedGrade(grade) === 'good', best: grade.best });
    inputRef.current?.blur();
  };
  useImperativeHandle(ref, () => ({ check }));
  const pending = open && result === null;
  useEffect(() => { onPendingChange?.(pending); }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPendingChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  const again = () => { setTyped(''); setResult(null); setFocusSeq((n) => n + 1); };
  if (!open) {
    return (
      <View ref={rowScroll?.rowRef} collapsable={false} onLayout={rowScroll?.onRowLayout}><ActionButton testID="learn-retype" label={s.button} accessibilityLabel={s.button} onPress={() => { setOpen(true); onOpen?.(); }} fill="paper"
        brutalStyle={styles.retypeBtn} classicStyle={[styles.retypeBtn, styles.checkBtn, { backgroundColor: colors.tabIconDefault }]} classicTextStyle={styles.checkBtnText} /></View>
    );
  }
  const exact = result !== null && typed.trim().toLowerCase() === result.best.trim().toLowerCase();
  return (
    <View ref={blockRef} style={styles.retypeBlock}>
      <View style={styles.retypeRow}>
      <TextInput
        ref={inputRef}
        testID="learn-retype-input"
        style={[styles.input, styles.retypeInput, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
        value={typed}
        onChangeText={(v) => { setTyped(v); setResult(null); }}
        onSubmitEditing={check}
        onFocus={() => blockRef.current && onFocusField?.(blockRef.current)}
        onBlur={onBlurField}
        placeholder={s.placeholder}
        placeholderTextColor={colors.tabIconDefault}
        {...answerInputProps}
      />
      {result !== null && (
        <ActionButton testID="learn-retype-again" label={s.again} accessibilityLabel={s.again} onPress={again}
          brutalBoxStyle={skin === 'popart' ? { flex: 1 } : undefined}
          brutalStyle={styles.retypeCheck} classicStyle={[styles.checkBtn, styles.retypeCheck, { backgroundColor: colors.tint }]} classicTextStyle={styles.checkBtnText} />
      )}
      </View>
      {result !== null && !exact && (
        <Text testID="learn-retype-diff" style={[styles.moreNewAsk, { color: colors.text }]}>
          {charDiff(typed, result.best, { case: true, accents: false }).map((d, i) => (
            <Text key={i} style={d.missing ? diff.missing : d.wrong ? diff.wrong : { color: result.right ? colors.successFill : colors.text }}>{d.ch}</Text>
          ))}
        </Text>
      )}
      {result !== null && (
        <Text testID="learn-retype-result" style={[styles.moreNewAsk, { color: colors.text }]}>{result.right ? s.right : s.wrong}</Text>
      )}
    </View>
  );
});

export default RetypePractice;
