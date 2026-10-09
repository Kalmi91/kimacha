// Spanish noun/adjective forms: plural and gendered form. A pure module (no imports),
// so that the inflected form -> words-open lemma lookup of `data/words.ts` and
// `lib/knownSentence.ts` use the same rule without a circular import.

const ACCENT_DROP: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

// Plural: -s after a vowel, -ces after -z, after a stressed -ón/-án/-én/-ín/-és
// ending the accent drops (canción → canciones), -es after any other consonant.
export function esPlural(word: string): string | null {
  if (/[aeiouáéíóú]$/.test(word)) return `${word}s`;
  if (word.endsWith('z')) return `${word.slice(0, -1)}ces`;
  const accented = word.match(/^(.*)([áéíóú])([nsl]?)$/);
  if (/[óáéí]n$|és$/.test(word) && accented) {
    return `${accented[1]}${ACCENT_DROP[accented[2]]}${accented[3]}es`;
  }
  if (word.endsWith('s')) return null; // lunes, crisis: unchanged
  return `${word}es`;
}

// Gendered form, for adjectives only: -o → -a, -or/-ol → +a (español → española),
// stressed -án/-ón/-és → +a without the accent (francés → francesa).
export function esFeminine(word: string): string | null {
  if (word.endsWith('o')) return `${word.slice(0, -1)}a`;
  if (word.length >= 5 && /(or|ol)$/.test(word)) return `${word}a`;
  const m = word.match(/^(.*)([áéó])(n|s)$/);
  if (m && (m[3] === 'n' || m[2] === 'é')) return `${m[1]}${ACCENT_DROP[m[2]]}${m[3]}a`;
  return null;
}
