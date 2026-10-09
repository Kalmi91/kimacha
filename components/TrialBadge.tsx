import { Sticker } from '@/components/grammar/Brutal';
import { t } from '@/lib/i18n';

// The new task types (error-finder, word order,
// dictation) exist only in two lessons, with a temporary "NEW · TEST" mark so that the developer
// can try and approve them. Removable from ONE place: setting TRIAL_BADGES to false makes
// every badge disappear (on the task buttons, on the tasks and on the lesson list too).
const TRIAL_BADGES = true;

export default function TrialBadge({ testID = 'trial-badge' }: { testID?: string }) {
  if (!TRIAL_BADGES) return null;
  return <Sticker testID={testID} label={t().grammar.trialBadge} fill="b" rotate={-4} />;
}
