/**
 * Strict word-level answer check for typing cards (FB6).
 *
 * "she speak" must NOT pass for "She speaks" — a single letter can be the
 * whole grammar point (verb ending, plural -s). So every word must match
 * exactly; only case, punctuation and missing accents are forgiven
 * (beginner phone keyboards rarely produce á/é/ñ → "como estas" still
 * passes for "¿Cómo estás?"). A stray space typed inside a word ("ofi cina"
 * for "oficina") is forgiven too (FB34) via a whitespace-free fallback.
 */
function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:¡¿"'()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function strictAnswerMatch(answer: string, correct: string): boolean {
  const a = normalizeWords(answer);
  const c = normalizeWords(correct);
  if (a.length === c.length && a.every((w, i) => w === c[i])) return true;
  // FB34: a stray space typed inside a word ("ofi cina" for "oficina") must
  // not fail the answer, compare the whitespace-free concatenation instead.
  return a.join('') === c.join('');
}
