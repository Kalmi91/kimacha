import ComingSoon from '@/components/ComingSoon';
import { t } from '@/lib/i18n';

// Beta tab (Settings -> Beta -> Sentences tab); the content comes in a later step.
export default function SentencesScreen() {
  return <ComingSoon testID="sentences-screen" title={t().tabs.sentences} />;
}
