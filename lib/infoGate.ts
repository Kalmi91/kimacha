// One rule for every "i" (info / rule explanation) button: if the text behind it contains the answer of the
// current task, the "i" appears only after the answer was checked. If it does not, it is always there.
// Accent- and case-insensitive; a leading article of the answer is optional in the text.
import { pcicAlternatives } from '@/lib/pcicMatch';
import { exampleIn } from '@/lib/pcicItemText';
import type { PcicItem } from '@/data/pcic';
import type { Lang } from '@/lib/languagePair';

const ARTICLE_RE = /^(el|la|los|las|un|una|der|die|das|den|dem|des|ein|eine|the|a|an)\s+/i;

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The forms of an answer that count as "given away" when found in a text (whole words, accent-folded, article-free). */
export function answerForms(answer: string | undefined): string[] {
  if (!answer) return [];
  const forms = new Set<string>();
  for (const alt of pcicAlternatives(answer)) {
    const folded = fold(alt);
    const bare = folded.replace(ARTICLE_RE, '');
    if (bare.length >= 2) forms.add(bare);
    else if (folded.length >= 2) forms.add(folded);
  }
  return [...forms];
}

/** True when the info text contains any form of the answer as a whole word or phrase. */
export function infoRevealsAnswer(info: string | undefined, answer: string | undefined | string[]): boolean {
  if (!info) return false;
  const forms = Array.isArray(answer) ? answer.flatMap(answerForms) : answerForms(answer);
  if (forms.length === 0) return false;
  const hay = ` ${fold(info)} `;
  // plural / simple inflection: form + s / es (only for forms of 4+ letters, so short words do not over-match)
  return forms.some((f) => hay.includes(` ${f} `) || (f.length >= 4 && (hay.includes(` ${f}s `) || hay.includes(` ${f}es `))));
}

/** Whether the "i" button is shown: always when the text hides the answer, after Check when it contains it. */
export function infoButtonVisible(info: string | undefined, answer: string | undefined | string[], checked: boolean): boolean {
  return checked || !infoRevealsAnswer(info, answer);
}

/** FB621/FB634: the example sentence in the prompt language for the question side of a word card (not when the card has a multi-meaning hint, nor on a sentence card). */
export function questionSentenceOf(item: PcicItem, promptLang: Lang, answer?: string): string | undefined {
  if (item.hint || item.kind === 'sentence') return undefined;
  const sentence = exampleIn(item, promptLang)?.trim();
  if (!sentence || infoRevealsAnswer(sentence, answer)) return undefined;
  return sentence;
}
