// Answer matching for the PCIC tab. The es form often carries a
// "/" alternative ("tocar/sentir frío") or a parenthesized optional
// part ("al final (de)"); both count as accepted forms. Accents
// count for spelling ("just the plain spelling of the words"), but a word-final ending/letter difference (e.g. "bueno"/"buena")
// matters grammatically, so it is
// wrong, not near, even if the edit distance is only 1.

import { levenshtein } from './levenshtein';
import { stripTrailingPunct } from './charDiff';
import type { Sm2Grade } from './sm2';

// question and exclamation marks, the period and the comma are never
// an error, neither at the start (¿ ¡), nor at the end (? ! .), nor mid-sentence (comma). The
// apostrophe and the hyphen stay (in English "don't", "well-known" they are part of the word).
const IGNORED_PUNCT = /[¿?¡!.,;:…]/g;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(IGNORED_PUNCT, ' ').replace(/\s+/g, ' ').trim();
}

function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Resolves a single parenthesized optional segment: one form is produced with the content and
// one without ("al final (de)" -> "al final de", "al final").
function expandParens(s: string): string[] {
  const match = s.match(/\s*\(([^)]*)\)/);
  if (!match || match.index === undefined) return [s];
  const before = s.slice(0, match.index);
  const after = s.slice(match.index + match[0].length);
  const withInner = `${before}${match[0].startsWith(' ') ? ' ' : ''}${match[1]}${after}`.replace(/\s+/g, ' ').trim();
  const withoutInner = `${before}${after}`.replace(/\s+/g, ' ').trim();
  return [withInner, withoutInner];
}

// A "/" is always inside a single word position ("tocar/sentir frío",
// "asiento/fila de un teatro"): in the space-tokenized form, the token that
// contains the "/" is replaced; the other words stay unchanged.
function expandSlashes(s: string): string[] {
  const tokens = s.split(' ');
  const slashAt = tokens.reduce<number[]>((acc, tok, i) => (tok.includes('/') ? [...acc, i] : acc), []);
  if (slashAt.length === 0) return [s];
  let variants: string[][] = [tokens];
  for (const idx of slashAt) {
    const options = tokens[idx].split('/');
    variants = variants.flatMap((variant) =>
      options.map((opt) => {
        const copy = [...variant];
        copy[idx] = opt;
        return copy;
      })
    );
  }
  return variants.map((v) => v.join(' '));
}

// the " / " (space-slash-space) separator splits whole
// alternatives ("el carro / el coche / el auto"); the space-free
// "a/b" stays as the within-word-position split above, as it was.
export function pcicAlternatives(answer: string): string[] {
  const withParens = answer.split(' / ').flatMap(expandParens);
  const all = withParens.flatMap(expandSlashes).map((v) => v.trim());
  return Array.from(new Set(all));
}

export interface PcicGrade {
  match: 'exact' | 'near' | 'wrong';
  best: string;
  // true only when the difference is EXCLUSIVELY an accent and
  // strict accents is OFF (otherwise this case is 'wrong'). The UI uses this
  // to show the "Missing accent, counted as correct" line.
  accentOnly?: boolean;
}

// A word-final ending/letter difference (the last 2 characters differ) is not a "typo".
function isWordFinalDiff(a: string, b: string): boolean {
  return a.slice(-2) !== b.slice(-2);
}

// If the two forms are equal after stripping accents, the difference is purely
// an accent error; this stays near even when it falls on the end of the word.
function isAccentOnlyDiff(a: string, b: string): boolean {
  return a !== b && foldAccents(a) === foldAccents(b);
}

// `target` (formerly `es`) is the correct form in the TARGET
// language, in either direction; the normalization (accents, case, "/" and
// parenthesis alternatives) is language-independent and works for English too.
export function gradePcicAnswer(typed: string, target: string, strictAccents = false): PcicGrade {
  const alternatives = pcicAlternatives(target);
  const typedNorm = stripTrailingPunct(normalize(typed));

  for (const alt of alternatives) {
    if (stripTrailingPunct(normalize(alt)) === typedNorm) {
      return { match: 'exact', best: alt };
    }
  }

  let best = alternatives[0];
  let bestNorm = stripTrailingPunct(normalize(best));
  let bestDist = Infinity;
  for (const alt of alternatives) {
    const altNorm = stripTrailingPunct(normalize(alt));
    const dist = levenshtein(typedNorm, altNorm);
    if (dist < bestDist) {
      bestDist = dist;
      best = alt;
      bestNorm = altNorm;
    }
  }

  if (bestDist <= 1) {
    if (isAccentOnlyDiff(typedNorm, bestNorm)) {
      // The strict-accents switch in Settings decides.
      // OFF: an accent-only difference counts as 100%. ON: a real error, like any
      // other letter difference.
      return strictAccents ? { match: 'wrong', best } : { match: 'near', best, accentOnly: true };
    }
    if (isWordFinalDiff(typedNorm, bestNorm)) return { match: 'wrong', best };
    return { match: 'near', best };
  }

  return { match: 'wrong', best };
}

// The docked "Next" button applies this automatically, and
// it also gives the pre-selected (isPre) suggestion of the manual Knew it / Didn't know it buttons.
// Rule: a 100% correct answer (exact, or accent-only near with strict accents OFF)
// -> Knew it; anything else (wrong or empty) -> Didn't know it.
export function suggestedGrade(grade: PcicGrade): Sm2Grade {
  if (grade.match === 'exact') return 'good';
  if (grade.match === 'near' && grade.accentOnly) return 'good';
  return 'again';
}

// The subject pronoun may be dropped in a Spanish sentence
// ("Como en casa." is fine instead of "Yo como en casa."). Only the FIRST word counts, and
// accents must be exact: "él" is a pronoun, "el" an article; "tú" is a pronoun, "tu" a possessive.
const SUBJECT_PRONOUNS = new Set([
  'yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
]);

/** The sentence without its leading subject pronoun, or null if it does not start with a pronoun. */
export function withoutLeadingSubjectPronoun(sentence: string): string | null {
  const match = sentence.trim().match(/^[¿¡"']*([^\s,]+)[,]?\s+(\S[\s\S]*)$/);
  if (!match) return null;
  if (!SUBJECT_PRONOUNS.has(match[1].toLowerCase())) return null;
  return match[2].trim();
}

const GRADE_RANK: Record<PcicGrade['match'], number> = { exact: 2, near: 1, wrong: 0 };

/**
 * Sentence grading: grades like a word card (gradePcicAnswer), but an answer
 * without the pronoun is also accepted when the correct sentence starts with a
 * pronoun. The better grade counts; `best` is the correct form shown (the full
 * sentence stays).
 */
export function gradeSentenceAnswer(typed: string, target: string, strictAccents = false): PcicGrade {
  const full = gradePcicAnswer(typed, target, strictAccents);
  const short = withoutLeadingSubjectPronoun(target);
  if (!short) return full;
  const alt = gradePcicAnswer(typed, short, strictAccents);
  return GRADE_RANK[alt.match] > GRADE_RANK[full.match] ? { ...alt, best: target } : full;
}
