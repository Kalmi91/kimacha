import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { accentColor, themedEdgeStyle } from '@/components/grammar/Themed';
import GameFrame from '@/components/practice/GameFrame';
import { PCIC_LEVELS, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/languagePair';
import { storiesOfLevel, type SpeechStory, type StoryProgress } from '@/lib/speech/stories';
import { useTheme } from '@/lib/ThemeContext';

// The first screen of the Speak tab: the level row and one card per story of the level. A finished story shows its best score, the
// story of an open run says "Continue". Nothing is locked: every story can be opened. A direction without stories says so.

interface Props {
  target: PcicTarget;
  source: Lang;
  /** The direction has stories at all (the level row filters them); without any there is no level row. */
  hasStories: boolean;
  level: PcicLevel;
  onLevel: (level: PcicLevel) => void;
  progress: ReadonlyMap<string, StoryProgress>;
  /** The story that has an open run. */
  openId: string | null;
  onOpen: (id: string) => void;
}

export default function SpeechList({ target, source, hasStories, level, onLevel, progress, openId, onOpen }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const sx = t().speechTab;
  const frame = { testID: 'speech-screen', target, currentCard: 'speech-list', hideLevelCounter: true } as const;

  if (!hasStories) {
    return (
      <GameFrame {...frame} centered>
        <Text testID="speech-empty-language" style={[styles.empty, { color: colors.textMuted }]}>{sx.emptyLanguage}</Text>
      </GameFrame>
    );
  }

  const stories: readonly SpeechStory[] = storiesOfLevel(target, level, source);
  return (
    <GameFrame {...frame}>
      <View style={styles.box}>
        <View testID="speech-levels" accessibilityLabel={sx.levelPickerLabel} style={styles.levels}>
          {PCIC_LEVELS.map((l) => {
            const selected = l === level;
            return (
              <Pressable
                key={l}
                testID={`speech-level-${l}`}
                accessibilityRole="button"
                accessibilityLabel={sx.levelOptionA11y(l)}
                accessibilityState={{ selected }}
                onPress={() => onLevel(l)}
                style={[
                  styles.chip,
                  themedEdgeStyle(g),
                  { backgroundColor: selected ? colors.tint : colors.card, borderColor: selected ? colors.tint : colors.border },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.onTint : colors.text }]}>{l}</Text>
              </Pressable>
            );
          })}
        </View>
        {stories.length === 0 && <Text testID="speech-empty-level" style={[styles.emptyLevel, { color: colors.textMuted }]}>{sx.emptyLevel}</Text>}
        {stories.map((story) => {
          const best = progress.get(story.id);
          return (
            <Pressable key={story.id} testID={`speech-story-${story.id}`} accessibilityRole="button" onPress={() => onOpen(story.id)}>
              <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
                <View style={styles.cardText}>
                  <Text style={[styles.title, { color: colors.text }]}>{story.title[source]}</Text>
                  <Text style={[styles.teaser, { color: colors.textMuted }]}>{story.teaser[source]}</Text>
                </View>
                {openId === story.id ? (
                  <Text testID={`speech-story-continue-${story.id}`} style={[styles.badge, { color: accentColor(g, colors.tint) }]}>{sx.continueStory}</Text>
                ) : best ? (
                  <Text
                    testID={`speech-story-best-${story.id}`}
                    accessibilityLabel={sx.finishedA11y(best.best, best.total)}
                    style={[styles.badge, { color: colors.success }]}
                  >
                    {`✓ ${sx.scoreChip(best.best, best.total)}`}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: spacing.xl, gap: spacing.md },
  levels: { flexDirection: 'row', gap: spacing.sm },
  chip: { flex: 1, minHeight: tapTarget, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  card: { borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brutalCard: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardText: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  teaser: { fontSize: fontSize.sm },
  badge: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  empty: { fontSize: fontSize.md, textAlign: 'center' },
  emptyLevel: { fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.lg },
});
