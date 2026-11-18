import ExamButton from '@/components/exam/ExamButton';
import { t } from '@/lib/i18n';

// "I mistyped" under a wrong typed answer in the drill: the answer counts as right and the drill moves on (the tests'
// own "I mistyped" works the same: a typo the learner owns up to is not a miss).
export default function MistypedButton({ onPress }: { onPress: () => void }) {
  return <ExamButton testID="grammar-mistyped" secondary label={t().grammar.mistyped} onPress={onPress} />;
}
