// The corrected sentence of the error tasks (spot, fix): shared by the task screens and the lesson test.

const PUNCT_TAIL = /[.,;:!?¡¿]+$/;

/** The word without the punctuation at its end, and the punctuation separately. */
function splitPunct(token: string): { core: string; tail: string } {
  const m = token.match(PUNCT_TAIL);
  return m ? { core: token.slice(0, -m[0].length), tail: m[0] } : { core: token, tail: '' };
}

/** The corrected sentence: the wrong word replaced by the option (or removed if the option is empty), the punctuation stays in place. */
export function fixedSentence(es: string, wrongIndex: number, fix: string): string {
  const words = es.split(/\s+/).filter(Boolean);
  const wrong = words[wrongIndex] ?? '';
  const { tail } = splitPunct(wrong);
  if (fix === '') {
    const rest = words.filter((_, i) => i !== wrongIndex);
    if (tail && rest.length > 0) {
      const at = Math.min(wrongIndex, rest.length) - 1;
      if (at >= 0) rest[at] = `${splitPunct(rest[at]).core}${tail}`;
    }
    return rest.join(' ');
  }
  words[wrongIndex] = `${fix}${tail}`;
  return words.join(' ');
}
