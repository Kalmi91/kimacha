import BadgeRow from '@/components/learn/BadgeRow';
import Colors from '@/constants/Colors';
import { DAILY_XP_GOAL } from '@/lib/dailyXp';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useXpToday } from '@/lib/useXpToday';

// The "XP n/50" chip of the word card, on the grammar and Sentences screens too. `earned` (> 0) adds the "+2 XP"
// of the answer that was just right; 0 or undefined shows nothing extra.
export default function XpChip({ earned = 0 }: { earned?: number }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const xp = useXpToday();
  const items: Parameters<typeof BadgeRow>[0]['items'] = [{ label: s.pcic.badgeXp(xp, DAILY_XP_GOAL), tone: 'accent', accessibilityLabel: s.pcic.badgeXpA11y(xp, DAILY_XP_GOAL), tabular: true }];
  if (earned > 0) items.push({ label: s.pcic.badgeXpEarned(earned), tone: 'green', accessibilityLabel: s.pcic.badgeXpEarned(earned), tabular: true });
  return <BadgeRow singleLine colors={colors} items={items} />;
}
