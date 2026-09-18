import type { DueItem, Shown } from '@/lib/sessionQueue';
import { speak as speakIn } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import type { stringsFor } from '@/lib/i18n';

type Strings = ReturnType<typeof stringsFor>;

// Moved from app/(tabs)/index.tsx, structural extraction only.
export type TypingResult = 'correct' | 'almost' | 'wrong' | 'skipped' | null;

// UTEMEZO 7. szakasz (moved from app/(tabs)/index.tsx, structural extraction
// only): minden lapon egy cimke, a sajat nyelven (a motor labelOf-ja csak a
// motor sajat, magyar teszt-cimkeje, ld. lib/sessionQueue.ts).
export function lapLabelOf(shown: Shown | null, s: Strings): string | null {
  if (!shown) return null;
  if (shown.kind === 'ask-more') return s.lap.question;
  if (shown.type === 'sentence') return s.lap.sentence;
  if (shown.kind === 'review') return shown.repair ? s.lap.repair : s.lap.review;
  return shown.repair ? s.lap.repairLap(shown.lap ?? 1) : s.lap.newLap(shown.lap ?? 1);
}

export function getFrontBack(item: DueItem, direction: [string, string]) {
  const [native, learned] = direction;
  const isWord = item.type === 'word';

  let frontLang = learned;
  let backLang = native;
  if (item.typingDirection === 'native-to-learned') {
    frontLang = native;
    backLang = learned;
  }

  return {
    front: String(isWord ? item.word[frontLang] : item.word[`sentence_${frontLang}`]),
    back: String(isWord ? item.word[backLang] : item.word[`sentence_${backLang}`]),
    frontLang,
    backLang,
  };
}

// FB116 (moved from app/(tabs)/index.tsx, structural extraction only): a
// skipped card is still read out loud, the word AND its sentence ("ha nem
// irok be semmit de nyomok a következőre akkor is mondja ki a szót és a
// mondatot"). This is the one part of FB43 that the learner reversed.
export function speakSkippedAnswer(item: DueItem, direction: [string, string]): void {
  const learned = direction[1];
  const { back, backLang } = getFrontBack(item, direction);
  if (back) speakIn(back, speechLang(backLang));
  if (item.type !== 'word') return;
  const sentence = String(item.word[`sentence_${learned}`] ?? '');
  if (sentence) speakIn(sentence, speechLang(learned));
}
