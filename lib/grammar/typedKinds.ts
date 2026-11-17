// The checks of the four typed task kinds added for the grammar tests: open cloze (`opencloze`), error correction by
// typing (`fix`), word bank (`bank`) and the typed noun form (`noun`). A pure module, no React.
//
// The typing rules are the transform / write rules (strictAnswerMatch: case and punctuation do not count, the accent
// switch decides on the accents).

import { strictAnswerMatch } from '@/lib/answerMatch';
import type { BankItem, ClozeItem, FixItem, NounItem } from '@/lib/grammar/lessonTypes';

/** The gap mark of the open cloze and the word bank. */
export const GAP_MARK = '___';

/** The text pieces around the gaps: n gaps give n + 1 pieces. */
export function clozeParts(text: string): string[] {
  return text.split(GAP_MARK);
}

export function clozeGapCount(text: string): number {
  return clozeParts(text).length - 1;
}

/** Right if the typed text is the answer or one of the accepted forms. */
export function typedRight(typed: string, answer: string, accept: string[] | undefined, strictAccents: boolean): boolean {
  if (typed.trim() === '') return false;
  return [answer, ...(accept ?? [])].some((form) => strictAnswerMatch(typed, form, { strictAccents }));
}

/** Per gap: is the typed word right? A missing entry is wrong. */
export function gradeCloze(item: Pick<ClozeItem, 'answers' | 'accept'>, typed: string[], strictAccents: boolean): boolean[] {
  return item.answers.map((answer, i) => typedRight(typed[i] ?? '', answer, item.accept?.[i], strictAccents));
}

export function isFixAnswerRight(typed: string, item: Pick<FixItem, 'answer' | 'accept'>, strictAccents: boolean): boolean {
  return typedRight(typed, item.answer, item.accept, strictAccents);
}

export function isBankAnswerRight(typed: string, item: Pick<BankItem, 'answer' | 'accept'>, strictAccents: boolean): boolean {
  return typedRight(typed, item.answer, item.accept, strictAccents);
}

export function isNounAnswerRight(typed: string, item: Pick<NounItem, 'answer' | 'accept'>, strictAccents: boolean): boolean {
  return typedRight(typed, item.answer, item.accept, strictAccents);
}

/** The sentence with its gap filled (the first gap only). */
export function filledSentence(es: string, answer: string): string {
  return es.replace(GAP_MARK, answer);
}

/** The text with every gap filled in order. */
export function filledCloze(text: string, answers: string[]): string {
  const parts = clozeParts(text);
  return parts.reduce((out, piece, i) => `${out}${piece}${i < parts.length - 1 ? (answers[i] ?? GAP_MARK) : ''}`, '');
}
