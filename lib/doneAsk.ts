// FB296/297/298 (UTEMEZO 5. szakasz): a kor vegi egyetlen kerdes, tiszta
// fuggvenyben. A regi kod a nyitott TEMA erintetlen szavaibol (`fresh`) dontott,
// ezert egy majdnem kifogyott tema tevesen "szint kifogyott, gyakorolj"-at
// mutatott, holott a szinten meg sok szo var. A `levelUntouched` a SZINT
// egeszenek erintetlen szo-szama (FB190); a `freshLeft` a motor `fresh` listaja
// (a nyitott tema/kolcsonzott szavak erintetlen id-i), amit ez a fuggveny NEM
// hasznal a dontesben, csak a hivo allapotat dokumentalja.
import type { DoneAsk as DoneAskResult } from '@/components/DoneScreen';

export function doneAsk(input: { freshLeft: number; black: number; levelUntouched: number }): DoneAskResult {
  if (input.black === 0 && input.levelUntouched > 0) return 'more-new';
  if (input.levelUntouched === 0) return 'practise';
  // A tema kifogyott, de a szint nem: a FB135/136 "kovetkezo tema" blokk
  // mutatja az utat (newWordsInTopic === 0 && onNextTopicWords).
  return 'none';
}
