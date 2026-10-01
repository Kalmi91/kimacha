// Több jelentésű szavak kapuja (PLAN-tobbjelentes.md 2. lépés, R11-R14). Közös a két kapuban:
// words-open-check.mjs (kérdés `en`, válasz `es`, hint `hint_en`) és validate-en-track.mjs (kérdés `es`, válasz `en`, hint `hint_es`).
//   R11  ha egy normalizált kérdés legalább két kártyán szerepel, mindegyiknek kötelező a hint
//   R12  a hintben pontosan egy *…* jelölés van, a jelölt szó első 2 betűje (kisbetű, ékezet nélkül) egyezik a kérdés
//        valamelyik szavának első 2 betűjével (juego/jugar, llevo/llevar, played/play), legfeljebb 8 szó; az angol
//        rendhagyó igealak is jó (be: am/is/are/was/were, have: has/had, do: does/did, go: goes/went)
//   R13  hint csak R11 szerinti kártyán van
//   R14  a perjeles válaszban minden alternatíva nem üres, nincs ismétlés, az elválasztó pontosan " / "
// A normalizálás: kisbetű, szóköz-összevonás, trim, vezető névelő nélkül (S3).

const HINT_MAX_WORDS = 8;
const fold = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');
const IRREGULAR = {
  be: ['am', 'is', 'are', 'was', 'were'],
  have: ['has', 'had'],
  do: ['does', 'did'],
  go: ['goes', 'went'],
};

export function checkMultiMeaning({ cards, qKey, aKey, hintKey, articles, ignore = [], tag, fail }) {
  const norm = (q) => {
    const s = String(q ?? '').toLowerCase().replace(/[¿?¡!.]/g, '').replace(/\s+/g, ' ').trim();
    const [first, ...rest] = s.split(' ');
    return articles.includes(first) && rest.length ? rest.join(' ') : s;
  };
  const skip = new Set([...articles, ...ignore]);
  const count = new Map();
  for (const c of cards) {
    const k = norm(c[qKey]);
    if (k) count.set(k, (count.get(k) || 0) + 1);
  }

  for (const c of cards) {
    const k = norm(c[qKey]);
    const multi = count.get(k) >= 2;
    const hasHint = Object.hasOwn(c, hintKey);

    // R11 + R13
    if (multi && !(typeof c[hintKey] === 'string' && c[hintKey].trim())) {
      fail('R11', `${tag(c)}: "${k}" ${count.get(k)} kártyán szerepel, de nincs ${hintKey}`);
    }
    if (hasHint && !multi) fail('R13', `${tag(c)}: ${hintKey} olyan kártyán, ahol a kérdés ("${k}") nem több jelentésű`);

    // R12
    if (hasHint) {
      const h = c[hintKey];
      if (typeof h !== 'string') {
        fail('R12', `${tag(c)}: ${hintKey} nem string`);
      } else {
        const marked = h.match(/^[^*]*\*([^*]+)\*[^*]*$/);
        if (!marked) {
          fail('R12', `${tag(c)}: ${hintKey} nem pontosan egy *…* jelölést tartalmaz: "${h}"`);
        } else {
          const words = h.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
          if (words > HINT_MAX_WORDS) fail('R12', `${tag(c)}: ${hintKey} ${words} szó (max ${HINT_MAX_WORDS}): "${h}"`);
          const m = fold(marked[1].trim().split(/\s+/)[0].toLowerCase()).slice(0, 2);
          const qWords = k.split(/[^\p{L}'’]+/u).filter((w) => w && !skip.has(w));
          const first = fold(marked[1].trim().split(/\s+/)[0].toLowerCase());
          if (!qWords.some((w) => fold(w).slice(0, 2) === m || IRREGULAR[w]?.includes(first))) {
            fail('R12', `${tag(c)}: a jelölt "${marked[1]}" első 2 betűje nem egyezik a kérdés ("${k}") egyik szavával sem: "${h}"`);
          }
        }
      }
    }

    // R14
    const a = c[aKey];
    if (typeof a === 'string' && a.includes('/')) {
      const parts = a.split(' / ');
      if (parts.some((p) => !p || p !== p.trim() || p.includes('/'))) {
        fail('R14', `${tag(c)}: ${aKey} "${a}": üres alternatíva vagy az elválasztó nem pontosan " / "`);
      } else if (new Set(parts.map((p) => p.toLowerCase())).size !== parts.length) {
        fail('R14', `${tag(c)}: ${aKey} "${a}": ismétlődő alternatíva`);
      }
    }
  }
}
