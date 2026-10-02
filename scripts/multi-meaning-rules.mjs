// Több jelentésű szavak kapuja (PLAN-tobbjelentes.md 2. lépés, R11-R14). Közös a két kapuban:
// words-open-check.mjs (kérdés `en`, válasz `es`, hint `hint_en`) és validate-en-track.mjs (kérdés `es`, válasz `en`, hint `hint_es`).
//   R11  ha egy normalizált kérdés legalább két kártyán szerepel, mindegyiknek kötelező a hint
//   R12  a hintben pontosan egy *…* jelölés van, a jelölt szó első 2 betűje (kisbetű, ékezet nélkül) egyezik a kérdés
//        valamelyik szavának első 2 betűjével (juego/jugar, llevo/llevar, played/play), legfeljebb 8 szó; az angol
//        rendhagyó igealak is jó (be: am/is/are/was/were, have: has/had, do: does/did, go: goes/went)
//   R13  hint csak R11 szerinti kártyán van
//        splitAlternatives: a kérdést vesszőnél/pontosvesszőnél alternatívákra bontja; ha két kártya azonos alternatívát ad
//        ("to try, to taste" és "to try, to attempt"), mindkettőn kötelező a hint (vagy összevonás). A régi kártyák (order <=
//        legacyMaxOrder) egymás közti ütközéseit legfeljebb legacyWarnLimit darabig hibának, fölötte figyelmeztetésnek vesszük.
//        stripQualifiers: az alternatívák összevetésekor a zárójeles minősítőt ("door lock (MX)" > "door lock") elhagyja, hogy
//        a minősítő ne kerülje ki a kaput; az azonos alapszavú kártyáknak hint_en vagy összevonás kell.
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

export function checkMultiMeaning({
  cards, qKey, aKey, hintKey, articles, ignore = [], tag, fail,
  splitAlternatives = false, stripQualifiers = false, legacyMaxOrder = 0, legacyWarnLimit = 50, warn = () => {},
}) {
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

  // alternatíva-szintű átfedés (splitAlternatives): alt -> kártyák
  const altCards = new Map();
  const unqual = (s) => (stripQualifiers ? s.replace(/\([^)]*\)/g, ' ') : s);
  const altsOf = (c) => (splitAlternatives ? unqual(String(c[qKey] ?? '')).split(/[,;]/).map(norm).filter(Boolean) : []);
  if (splitAlternatives) {
    for (const c of cards) for (const a of new Set(altsOf(c))) altCards.set(a, [...(altCards.get(a) || []), c]);
  }
  const hasHintText = (c) => typeof c[hintKey] === 'string' && c[hintKey].trim() !== '';
  const altMulti = new Set(); // a kártyák, amelyek alternatíva-átfedésben vannak
  const altProblems = []; // [kártya, partner, alt, legacy?]
  for (const [a, cs] of altCards) {
    if (cs.length < 2) continue;
    cs.forEach((c) => altMulti.add(c));
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const x = cs[i];
        const y = cs[j];
        if (hasHintText(x) && hasHintText(y)) continue;
        altProblems.push([x, y, a, x.order <= legacyMaxOrder && y.order <= legacyMaxOrder]);
      }
    }
  }
  const legacyProblems = altProblems.filter((p) => p[3]);
  const legacyAsWarning = legacyProblems.length > legacyWarnLimit;
  for (const [x, y, a, legacy] of altProblems) {
    const msg = `${tag(x)} és ${tag(y)}: azonos alternatíva ("${a}"), de nem mindkettőn van ${hintKey}`;
    if (legacy && legacyAsWarning) warn('R11', msg);
    else fail('R11', msg);
  }

  for (const c of cards) {
    const k = norm(c[qKey]);
    const multi = count.get(k) >= 2 || altMulti.has(c);
    const hasHint = Object.hasOwn(c, hintKey);

    // R11 + R13
    if (count.get(k) >= 2 && !hasHintText(c)) {
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
