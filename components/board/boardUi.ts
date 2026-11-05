// Small shared pieces of the weekly leaderboard screen: the monospace face, the monogram colors, the reduced-motion switch.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import type { ThemeColors } from '@/constants/Theme';
import type { BoardMetric } from '@/lib/cloud/board';
import { formatMinutes } from '@/lib/cloud/boardStats';
import { t } from '@/lib/i18n';
import { mixColor } from '@/lib/mixColor';

export const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace',
});

// The monogram circle: the name's character-code sum picks the tint or the secondary color, mixed 42% toward the card.
export function avatarColor(name: string, colors: ThemeColors): string {
  const sum = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return mixColor(sum % 2 ? colors.tint : colors.secondary, colors.card, 0.42);
}

// True while the system asks for less motion: the screen then plays no animation.
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

// The figure of a ranking as text: `412 XP`, or `3 h 25 min` for the time ranking (`value` is then the week's minutes).
export const valueText = (metric: BoardMetric, value: number): string => (metric === 'time' ? formatMinutes(value) : t().board.xp(value));

// `Rank 3 · 412 XP` / `Rank 3 · 3 h 25 min`, for the screen reader labels.
export const rankText = (metric: BoardMetric, rank: number, value: number): string =>
  metric === 'time' ? t().board.rankLineTime(rank, formatMinutes(value)) : t().board.rankLine(rank, value);
