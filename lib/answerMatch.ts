/**
 * Strict word-level answer check for typing cards (FB6).
 *
 * "she speak" must NOT pass for "She speaks" — a single letter can be the
 * whole grammar point (verb ending, plural -s). So every word must match
 * exactly; only case, punctuation and missing accents are forgiven
 * (beginner phone keyboards rarely produce á/é/ñ → "como estas" still
 * passes for "¿Cómo estás?").
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
  return a.length === c.length && a.every((w, i) => w === c[i]);
}
