// Gate for multi-meaning words. Shared by the two gates:
// words-open-check.mjs (question `en`, answer `es`, hint `hint_en`) and validate-en-track.mjs (question `es`, answer `en`, hint `hint_es`).
//   R11  if a normalized question appears on at least two cards, every one of them must have a hint
//   R12  the hint contains exactly one *…* marker; the first 2 letters of the marked word (lowercase, accents stripped) match the
//        first 2 letters of one of the question's words (juego/jugar, llevo/llevar, played/play), at most 8 words; an English
//        irregular verb form is fine too (be: am/is/are/was/were, have: has/had, do: does/did, go: goes/went)
//   R13  a hint is allowed only on a card covered by R11, or on a card whose order is in the `confusable` set (confusable group: scripts/words-open-confusable.json)
//        splitAlternatives: splits the question into alternatives at commas/semicolons; if two cards share an alternative
//        ("to try, to taste" and "to try, to attempt"), both must have a hint (or be merged). Collisions among old cards (order <=
//        legacyMaxOrder) count as errors up to legacyWarnLimit, and as warnings above it.
//        stripQualifiers: when comparing alternatives, the parenthesised qualifier ("door lock (MX)" > "door lock") is dropped so
//        that the qualifier cannot get around the gate; cards with the same base word need hint_en or a merge.
//   R14  in a slash-separated answer every alternative is non-empty, none repeats, and the separator is exactly " / "
// Normalization: lowercase, whitespace collapsed, trimmed, without a leading article.

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
  splitAlternatives = false, stripQualifiers = false, legacyMaxOrder = 0, legacyWarnLimit = 50, warn = () => {}, confusable = new Set(),
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

  // alternative-level overlap (splitAlternatives): alt -> cards
  const altCards = new Map();
  const unqual = (s) => (stripQualifiers ? s.replace(/\([^)]*\)/g, ' ') : s);
  const altsOf = (c) => (splitAlternatives ? unqual(String(c[qKey] ?? '')).split(/[,;]/).map(norm).filter(Boolean) : []);
  if (splitAlternatives) {
    for (const c of cards) for (const a of new Set(altsOf(c))) altCards.set(a, [...(altCards.get(a) || []), c]);
  }
  const hasHintText = (c) => typeof c[hintKey] === 'string' && c[hintKey].trim() !== '';
  const altMulti = new Set(); // cards that overlap on an alternative
  const altProblems = []; // [card, partner, alt, legacy?]
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
    if (hasHint && !multi && !confusable.has(c.order)) fail('R13', `${tag(c)}: ${hintKey} olyan kártyán, ahol a kérdés ("${k}") nem több jelentésű`);

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
