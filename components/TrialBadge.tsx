import { Sticker } from '@/components/grammar/Brutal';
import { t } from '@/lib/i18n';

// PLAN-fb0929 7. lépés (D1, Kálmán 2026-09-29): az új feladat-fajták (hibakereső, szórend,
// diktálás) csak két leckében élnek, ideiglenes "ÚJ · TESZT" jelöléssel, hogy Kálmán
// kipróbálhassa és jóváhagyhassa. EGY helyről kivehető: a TRIAL_BADGES false-ra állításától
// eltűnik minden jelvény (a feladat-gombokon, a feladatokon és a lecke-listán is).
const TRIAL_BADGES = true;

export default function TrialBadge({ testID = 'trial-badge' }: { testID?: string }) {
  if (!TRIAL_BADGES) return null;
  return <Sticker testID={testID} label={t().grammar.trialBadge} fill="b" rotate={-4} />;
}
