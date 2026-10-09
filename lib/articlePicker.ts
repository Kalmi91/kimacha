// User feedback (word:beef): "I would like it so that for a word like this
// I do not have to type the el la but pick it, here let there be 3 options el
// la or none, I mean a circle crossed out. […] the point is that I often
// change it while in the middle of a word and I want to change it easily".
//
// Three buttons were asked for, but the corpus also has plural articles (los zapatos, las gafas),
// and if the button row appeared ONLY on cards with an article, its mere appearance
// would give away that an article is needed. Hence five buttons (el / la / los / las / ⊘), present on every
// Spanish NOUN card, with and without an article. The ⊘ is the default, so
// whoever does not touch it can type as before.

import type { PosInfo } from '@/lib/pcicPos';

export const ARTICLE_OPTIONS = ['el', 'la', 'los', 'las'] as const;

export type ArticlePick = '' | (typeof ARTICLE_OPTIONS)[number];

// Issue #3: which languages have an article button row at all, and with which forms.
// Swedish (en/ett) or German (der/die/das) is thus one entry, not another
// `||` branch in this function.
const ARTICLES_BY_LANG: Record<string, readonly string[]> = {
  es: ARTICLE_OPTIONS,
};

/**
 * Whether the button row is shown. It is, if the language being typed has an article set and
 * the card asks for a WORD (a sentence card has nothing to put an article on).
 *
 * User feedback (word:contrary / opposite): "the el la los las none
 * part should be there too where verbs or adjectives have to be written, because for example I just
 * put the el in and here it is not needed". Until now the button row appeared only on noun cards,
 * so for verbs and adjectives the learner typed the article in by hand and
 * failed with it. From now on every word card has the row, and the ⊘ is the CORRECT
 * answer for a non-noun: "no article needed here" is something to learn too, it is not the
 * absence of the row that tells it.
 */
export function articlePickerApplies(backLang: string, isWordCard: boolean, answer?: string): boolean {
  if (!ARTICLES_BY_LANG[backLang] || !isWordCard) return false;
  return answer === undefined || answer.split('/').some((alt) => articleCanApply(alt));
}

/**
 * User feedback (word:I am going to travel / you are going to eat):
 * "the el la los las part is not needed here because there are several words. It can't
 * be used here". A multi-word form without an article (voy a viajar, van a llegar) cannot
 * take an article, there the row is just noise. A single word (perro), or a multi-word
 * form with an article (el fin de semana) still gets the row.
 */
/**
 * User feedback (word:The cat is on the table.): "the el la los las row
 * is not needed for sentences". A form ending in sentence-final punctuation or starting with the Spanish opening
 * mark (¿/¡) is a sentence, not a word, and the row stays noise there even if it
 * starts with an article (El gato está en la mesa.).
 */
function articleCanApply(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return true;
  if (/[.?!…]$/.test(trimmed) || /^[¿¡]/.test(trimmed)) return false;
  if (articleOf(trimmed)) return true;
  return !/\s/.test(trimmed);
}

/** What the grader sees: the chosen article and the typed word in one string. */
export function composeAnswer(pick: ArticlePick, typed: string): string {
  const body = typed.trim();
  if (!pick) return body;
  if (!body) return pick;
  return `${pick} ${body}`;
}

/**
 * The article of the correct form, so that on reveal the button row shows the RIGHT answer
 * (the learner sees what they should have pressed).
 */
export function articleOf(text: string): ArticlePick {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return (ARTICLE_OPTIONS as readonly string[]).includes(first) ? (first as ArticlePick) : '';
}

/** The correct form without an article, the expected content of the typing field. */
export function bodyOf(text: string): string {
  const trimmed = text.trim();
  return articleOf(trimmed) ? trimmed.split(/\s+/).slice(1).join(' ') : trimmed;
}

/**
 * Addendum (fix round, 2026-09-23): on the PCIC card the part-of-speech chip
 * (lib/pcicPos.ts posOf()) already says when the item is not a noun, so asking about
 * an article there would be superfluous (and confusing) for a non-noun. The row
 * only applies when the part of speech is unknown (`null`, then the
 * ⊘ answer is still a lesson) or explicitly `noun`.
 */
export function articleRowAppliesForPos(pos: PosInfo | null): boolean {
  return !pos || pos.pos === 'noun';
}
