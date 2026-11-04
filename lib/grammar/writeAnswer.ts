// The check of the sentence-writing task. A pure module, no React.
//
// It compares like the transform drill (strictAnswerMatch: case and punctuation do not count, the accent switch decides on the
// accents), not with the dictation's sentence grader, which forgives one missing accent only: a whole typed sentence often
// has more ("Estudio espanol para viajar a Mexico"), and on the lenient setting that must stay right.

import { strictAnswerMatch } from '@/lib/answerMatch';
import type { WriteItem } from '@/lib/grammar/lessonTypes';
import { withoutLeadingSubjectPronoun } from '@/lib/pcicMatch';

/** Right if the typed text is the sentence or an accepted form of it, also with the leading subject pronoun dropped. */
export function isWriteAnswerRight(typed: string, item: Pick<WriteItem, 'es' | 'accept'>, strictAccents: boolean): boolean {
  return [item.es, ...(item.accept ?? [])].some((form) => {
    const short = withoutLeadingSubjectPronoun(form);
    return strictAnswerMatch(typed, form, { strictAccents }) || (short !== null && strictAnswerMatch(typed, short, { strictAccents }));
  });
}
