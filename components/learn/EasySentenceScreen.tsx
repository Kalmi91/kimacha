import { type ReactNode } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';

import { getWordsForLevel, type Level } from '@/data/words';
import type { DueItem } from '@/lib/sessionQueue';
import { nearMissDistractors } from '@/lib/distractors';
import { speechLang } from '@/lib/languages';
import EasySentenceCard from '@/components/EasySentenceCard';
import FeedbackButton from '@/components/FeedbackModal';

// Moved from app/(tabs)/index.tsx (structural extraction only): the
// "easy sentence" tap-to-order render branch, unchanged logic.
type Props = {
  current: DueItem;
  direction: [string, string];
  level: Level;
  colors: { background: string };
  chrome: ReactNode;
  cardChips: ReactNode;
  noteText: string | null;
  strictAccents: boolean;
  qsStep: number;
  onResult: (correct: boolean) => void;
  onBury: () => void;
  onSkip: () => void;
};

export default function EasySentenceScreen({
  current,
  direction,
  level,
  colors,
  chrome,
  cardChips,
  noteText,
  strictAccents,
  qsStep,
  onResult,
  onBury,
  onSkip,
}: Props) {
  const [native, learned] = direction;
  const nativeSentence = String(current.word[`sentence_${native}`]);
  const learnedSentence = String(current.word[`sentence_${learned}`]);
  // FB16: lowercase the sentence-initial word in the tile bank, a leading
  // capital reveals which tile starts the sentence. Grading stays case-insensitive.
  const rawTargetWords = learnedSentence.replace(/[.!?¡¿,;:]/g, '').split(/\s+/).filter(Boolean);
  const targetWordList = rawTargetWords.map((w, i) =>
    i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w,
  );
  const levelWords = getWordsForLevel(level, learned);
  // Near-miss distractors (FB1): sibling articles + same-stem/ending forms
  // instead of random vocab, so the learner practises forms not random noise.
  const vocab = levelWords.map(w => String(w[learned]).split(' / ')[0]);
  const traps = nearMissDistractors(targetWordList, vocab, learned);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {chrome}
      {/* FB87: a long sentence with many chips grows past the centered column,
          so the card scrolls (shared scroll styles). */}
      <ScrollView
        style={styles.typingScroll}
        contentContainerStyle={styles.typingScrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <EasySentenceCard
        chips={cardChips}
        key={`${current.wordId}-${qsStep}`}
        sourceSentence={nativeSentence}
        lang={learned}
        targetWords={targetWordList}
        trapWords={traps}
        onResult={onResult}
        onBury={onBury}
        onSkip={onSkip}
        mistakeNote={noteText}
        speechLocale={speechLang(learned)}
        strictAccents={strictAccents}
      />
      </ScrollView>
      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`easy:${nativeSentence}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  typingScroll: {
    flex: 1,
    width: '100%',
  },
  typingScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
});
