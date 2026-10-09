// Easy reading topic: Spanish syllabifier. Splits a word into syllables so that the
// original letters (case, accents) are kept: syllabify('carro') -> ['ca', 'rro'].
// Simplified, but it knows the common rules: diphthong / triphthong in one nucleus, hiatus
// (two strong vowels or an accented í / ú) is two syllables, ch / ll / rr / qu / gu(e,i) is one sound,
// a consonant cluster (pl, tr ...) stays together, Mexican tl stays together (a-tlas).

const STRONG = 'aeoáéóàèò';
const ACCENTED_WEAK = 'íú';
const LETTERS = /[a-záéíóúüñàèòïç]/i;

// Consonant pairs that stay together (second l / r, plus tl).
const CLUSTERS = new Set(['pl', 'pr', 'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'kl', 'kr', 'tl', 'tr']);
const DIGRAPHS = new Set(['ch', 'll', 'rr']);

type Unit = { text: string; vowel: boolean };

function isVowelAt(low: string, i: number): boolean {
  const c = low[i];
  if (STRONG.includes(c) || ACCENTED_WEAK.includes(c)) return true;
  if (c === 'u' || c === 'ü' || c === 'i' || c === 'ï') {
    // qu / gu + e, i: the u is silent, consonant-like (que, guerra); in gü it is pronounced.
    if (c === 'u' && i > 0 && (low[i - 1] === 'q' || low[i - 1] === 'g') && 'eéií'.includes(low[i + 1] ?? '')) return false;
    return true;
  }
  // y is a vowel only at the end of a word (muy, hoy), or on its own (y).
  if (c === 'y') return i === low.length - 1;
  return false;
}

// Letter units: vowel or consonant (ch / ll / rr / qu / gu count as one unit).
function units(word: string): Unit[] {
  const low = word.toLowerCase();
  const out: Unit[] = [];
  let i = 0;
  while (i < word.length) {
    if (isVowelAt(low, i)) {
      out.push({ text: word[i], vowel: true });
      i += 1;
      continue;
    }
    const pair = low.slice(i, i + 2);
    if (DIGRAPHS.has(pair)) {
      out.push({ text: word.slice(i, i + 2), vowel: false });
      i += 2;
    } else if ((pair === 'qu' || pair === 'gu') && !isVowelAt(low, i + 1)) {
      out.push({ text: word.slice(i, i + 2), vowel: false });
      i += 2;
    } else {
      out.push({ text: word[i], vowel: false });
      i += 1;
    }
  }
  return out;
}

// Two adjacent vowels belong to one nucleus (diphthong) if at least one is weak and
// not accented (í, ú): ciu-dad, bue-no, ai-re. Two strong ones or an accented weak one: hiatus (le-er, ra-íz).
function joins(prev: string, next: string): boolean {
  const p = prev.toLowerCase();
  const n = next.toLowerCase();
  if (ACCENTED_WEAK.includes(p) || ACCENTED_WEAK.includes(n)) return false;
  const pStrong = STRONG.includes(p);
  const nStrong = STRONG.includes(n);
  return !(pStrong && nStrong);
}

function isCluster(a: Unit, b: Unit): boolean {
  return CLUSTERS.has((a.text + b.text).toLowerCase());
}

// The syllables of a word (letters). A word containing a non-letter character should be split up by the caller first (see syllabifyPhrase).
export function syllabify(word: string): string[] {
  const all = units(word);
  if (all.length === 0 || !all.some((u) => u.vowel)) return word ? [word] : [];

  // Nuclei: adjacent vowel units, merged per diphthong.
  const nuclei: { start: number; end: number }[] = [];
  for (let i = 0; i < all.length; i++) {
    if (!all[i].vowel) continue;
    const last = nuclei[nuclei.length - 1];
    if (last && last.end === i - 1 && joins(all[i - 1].text, all[i].text)) last.end = i;
    else nuclei.push({ start: i, end: i });
  }

  // The cut point of the consonant cluster between nuclei (the index where the new syllable starts).
  const cuts: number[] = [];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const from = nuclei[n].end + 1;
    const to = nuclei[n + 1].start; // the consonants: [from, to)
    const count = to - from;
    if (count <= 0) cuts.push(to); // hiatus: cut directly at the next nucleus
    else if (count === 1) cuts.push(from);
    else if (count === 2) cuts.push(isCluster(all[from], all[from + 1]) ? from : from + 1);
    else if (isCluster(all[to - 2], all[to - 1])) cuts.push(to - 2);
    else cuts.push(to - 1);
  }

  const result: string[] = [];
  let begin = 0;
  for (const cut of cuts) {
    result.push(all.slice(begin, cut).map((u) => u.text).join(''));
    begin = cut;
  }
  result.push(all.slice(begin).map((u) => u.text).join(''));
  return result;
}

// A phrase (space, hyphen, punctuation): the syllables word by word; the non-letter parts are separate items
// (`syllables: null`) so that the caller can render them unchanged.
type PhrasePart = { text: string; syllables: string[] | null };

export function syllabifyPhrase(text: string): PhrasePart[] {
  const parts: PhrasePart[] = [];
  let buf = '';
  let inWord = false;
  const flush = () => {
    if (!buf) return;
    parts.push({ text: buf, syllables: inWord ? syllabify(buf) : null });
    buf = '';
  };
  for (const ch of text) {
    const letter = LETTERS.test(ch);
    if (buf && letter !== inWord) flush();
    inWord = letter;
    buf += ch;
  }
  flush();
  return parts;
}
