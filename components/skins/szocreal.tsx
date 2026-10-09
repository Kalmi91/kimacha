import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import { HalfDisc, InnerFrame, Rays } from '@/components/skins/parts';
import type { SkinDecor } from '@/components/skins/types';
import { getDb } from '@/lib/database';
import { dailyPlanPercent } from '@/lib/dailyPlan';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useSkin } from '@/lib/useSkin';

// Socialist realism: an inner 3 px b frame under the 4 px ink frame, a rising sun (semicircle +
// rays, in color b) above the word, a "Shock worker" badge and a "Daily plan n%" bar under the header.

const FRAME_GAP = 3;
const REFRESH_MS = 30000;

// Today's active minutes relative to one seventh of the weekly goal; refreshed on load and every half minute.
function useDailyPlanPercent(): number {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      Promise.all([getDb().getUsageStats(), getDb().getWeeklyGoalMinutes()])
        .then(([usage, goal]) => {
          if (alive) setPct(dailyPlanPercent(usage.today, goal));
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return pct;
}

function SzocrealCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View testID="skin-szocreal-frame">
      {children}
      <InnerFrame testID="decor-szocreal-inner" inset={shape.borderWidth + FRAME_GAP} width={3} color={g.b} />
    </View>
  );
}

function SzocrealWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  const radius = 11;
  const outer = 30;
  return (
    <View style={styles.word}>
      <View testID="decor-szocreal-sun" style={{ width: outer * 2, height: outer }}>
        <Rays testID="decor-szocreal-rays" count={9} spread={80} inner={16} outer={outer} color={g.b} thickness={2} />
        <HalfDisc radius={radius} color={g.b} style={{ position: 'absolute', bottom: 0, left: outer - radius }} />
      </View>
      {children}
    </View>
  );
}

function SzocrealHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const pct = useDailyPlanPercent();
  const s = t().settings.themes;
  return (
    <View>
      {children}
      <View testID="skin-szocreal-strip" style={styles.strip}>
        <View testID="skin-szocreal-badge" style={[styles.badge, { backgroundColor: g.a }]}>
          <Text numberOfLines={1} style={[styles.badgeText, { color: g.onA }]}>
            ★ {s.shockWorker}
          </Text>
        </View>
        <View style={styles.plan}>
          <Text testID="skin-szocreal-plan-label" numberOfLines={1} style={[styles.planText, { color: g.ink }]}>
            {s.dailyPlan} {pct}%
          </Text>
          <View style={[styles.track, { borderColor: g.ink }]}>
            <View
              testID="skin-szocreal-plan-fill"
              style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: g.b }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink: FitText shrinks inside the row container, so its wrapper must too.
  word: { flexShrink: 1, alignItems: 'center', gap: 4 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, flexShrink: 1 },
  badgeText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  plan: { flex: 1, gap: 3 },
  planText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  track: { height: 8, borderWidth: 1 },
});

export const szocrealDecor: SkinDecor = {
  CardFrame: SzocrealCardFrame,
  WordRenderer: SzocrealWord,
  HeaderOrnament: SzocrealHeader,
};
