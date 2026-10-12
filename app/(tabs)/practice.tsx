import ComingSoon from '@/components/ComingSoon';
import { t } from '@/lib/i18n';

// Beta tab (Settings -> Beta -> Practice tab); the content comes in a later step.
export default function PracticeScreen() {
  return <ComingSoon testID="practice-screen" title={t().tabs.practice} />;
}
