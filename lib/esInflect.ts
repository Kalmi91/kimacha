// Spanish noun/adjective forms: plural and gendered form. A pure module (no imports),
// so that the inflected form -> words-open lemma lookup of `data/words.ts` and
// `lib/knownSentence.ts` use the same rule without a circular import.

const ACCENT_DROP: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const ACCENT_ADD: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

// Plural: -s after a vowel, -ces after -z, after a stressed -ón/-án/-én/-ín/-és
// ending the accent drops (canción → canciones), -es after any other consonant. A stressed
// -ás/-ís/-ús drops it too (autobús → autobuses), except after a vowel, where the accent keeps the
// hiatus (país → países). A one-syllable word in -s takes -es (mes → meses). A word in -n without
// a written accent is stressed on the syllable before the last, and the extra syllable of the plural
// needs the accent there (joven → jóvenes, examen → exámenes).
export function esPlural(word: string): string | null {
  if (/[aeiouáéíóú]$/.test(word)) return `${word}s`;
  if (word.endsWith('z')) return `${word.slice(0, -1)}ces`;
  const accented = word.match(/^(.*)([áéíóú])([nsl]?)$/);
  if (/[óáéí]n$|és$/.test(word) && accented) {
    return `${accented[1]}${ACCENT_DROP[accented[2]]}${accented[3]}es`;
  }
  const stressedS = word.match(/^(.*)([áíóú])s$/);
  if (stressedS) {
    const hiatus = /[aeiou]$/.test(stressedS[1]) && /[íú]/.test(stressedS[2]);
    return hiatus ? `${word}es` : `${stressedS[1]}${ACCENT_DROP[stressedS[2]]}ses`;
  }
  if (word.endsWith('s')) {
    // lunes, crisis: unchanged
    return (word.match(/[aeiouüáéíóú]+/g) ?? []).length === 1 ? `${word}es` : null;
  }
  const llana = word.match(/^(.*?)([aeiou])([^aeiou]+)([aeiou])n$/);
  if (llana && !/[aeiouüáéíóú]$/.test(llana[1]) && !/[áéíóú]/.test(word)) {
    return `${llana[1]}${ACCENT_ADD[llana[2]]}${llana[3]}${llana[4]}nes`;
  }
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
