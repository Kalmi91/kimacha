// Spanyol főnév/melléknév alakok: többes szám és nemi alak. Tiszta modul (nincs import),
// hogy a `data/words.ts` ragozott alak -> words-open lemma keresője és a
// `lib/knownSentence.ts` ugyanazt a szabályt használja körkörös import nélkül.

const ACCENT_DROP: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

// Többes szám: magánhangzó után -s, -z után -ces, hangsúlyos -ón/-án/-én/-ín/-és
// végnél az ékezet leesik (canción → canciones), egyéb mássalhangzó után -es.
export function esPlural(word: string): string | null {
  if (/[aeiouáéíóú]$/.test(word)) return `${word}s`;
  if (word.endsWith('z')) return `${word.slice(0, -1)}ces`;
  const accented = word.match(/^(.*)([áéíóú])([nsl]?)$/);
  if (/[óáéí]n$|és$/.test(word) && accented) {
    return `${accented[1]}${ACCENT_DROP[accented[2]]}${accented[3]}es`;
  }
  if (word.endsWith('s')) return null; // lunes, crisis: változatlan
  return `${word}es`;
}

// Nemi alak, csak melléknévre: -o → -a, -or/-ol → +a (español → española),
// hangsúlyos -án/-ón/-és → ékezet nélkül +a (francés → francesa).
export function esFeminine(word: string): string | null {
  if (word.endsWith('o')) return `${word.slice(0, -1)}a`;
  if (word.length >= 5 && /(or|ol)$/.test(word)) return `${word}a`;
  const m = word.match(/^(.*)([áéó])(n|s)$/);
  if (m && (m[3] === 'n' || m[2] === 'é')) return `${m[1]}${ACCENT_DROP[m[2]]}${m[3]}a`;
  return null;
}
