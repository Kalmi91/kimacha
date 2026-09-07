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
export interface MatchOptions {
  strictAccents?: boolean;
}

function normalizeWords(text: string, strictAccents = false): string[] {
  if (strictAccents) return normalizeKeepingAccents(text);
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:¡¿"'()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// FB132: the accent forgiveness above is a beginner crutch (phone keyboards
// rarely produce á/é/ñ), so it is switchable in Settings -> Difficulty. With
// strict accents on, "como estas" no longer passes for "Cómo estás"; case and
// punctuation stay forgiven either way.
function normalizeKeepingAccents(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:¡¿"'()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// FB137, Kálmán 2026-08-16 (easy:"The engine makes a lot of noise."): "nem hace
// kellett volna?? ide szerintem rosszat raktam be és elfogadta". The tap-to-order
// card used the typing cards' 2-character Levenshtein tolerance, but a tile is
// tapped, not typed: there is no typo to forgive, so the tolerance only ever hid
// a genuinely wrong pick ("hacen" for "hace" is a single character away). Tiles
// must match the target one for one; case and edge punctuation stay forgiven,
// because the bank carries the sentence's own capitalisation and full stop.
const stripEdges = (word: string) =>
  word.toLowerCase().replace(/^[¡¿"'(]+/, '').replace(/[.,!?;:"')]+$/, '');

export function sentenceBuildMatch(built: string[], target: string[]): boolean {
  if (built.length !== target.length) return false;
  return built.every((w, i) => stripEdges(w) === stripEdges(target[i]));
}

// BUG-001: a parenthetical in the solution is a disambiguating gloss, not part
// of the answer ("van (ő)", "óra (idő)", "ver (veremos)"). The normalisation
// above turns "(" and ")" into spaces, so the gloss used to become a REQUIRED
// word: "van" failed against "van (ő)". Both forms are accepted now, the full
// one first (the same gloss-stripping the tile bank does since FB12).
const withoutGloss = (text: string) => text.replace(/\([^)]*\)/g, ' ').trim();

export function strictAnswerMatch(answer: string, correct: string, opts: MatchOptions = {}): boolean {
  const a = normalizeWords(answer, opts.strictAccents);
  const bare = withoutGloss(correct);
  const candidates = bare && bare !== correct.trim() ? [correct, bare] : [correct];
  return candidates.some((candidate) => {
    const c = normalizeWords(candidate, opts.strictAccents);
    if (c.length === 0) return false;
    if (a.length === c.length && a.every((w, i) => w === c[i])) return true;
    // FB34: a stray space typed inside a word ("ofi cina" for "oficina") must
    // not fail the answer, compare the whitespace-free concatenation instead.
    return a.join('') === c.join('');
  });
}
