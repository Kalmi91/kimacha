// PLAN-play 11. lépés: példamondat a PCIC word/phrase tételekhez, a régi
// Tanulás-korpusz szókártyáiból (data/words/{a0..c2}.json, mezők `sentence_es`
// + `sentence_en`). Kálmán jóváhagyása (s4, artifact HsKKPddM4KKt7wBQZmLVNo):
// Check után a megoldás alatt a mondat, spanyolul kimondva.
//
// Egyezés: a PCIC-tétel `es` alakja <-> a korpusz-kártya `es` alakja,
// normalizálva (kisbetű, zárójeles glossza + szélső írásjel törölve, névelő
// (el/la/los/las/un/una) mindkét oldalon elhagyva, ékezet MARAD). Egy
// tételhez egy mondat; több egyezésnél a legalacsonyabb szintű korpusz-
// kártyáé nyer (a0..c2 sorrendben az első nem-üres találat). Csak akkor kerül
// be, ha a korpusz-kártyának `sentence_es` ÉS `sentence_en` is nem üres.
//
// Kimenet: data/pcic/<szint>-sentences.json, `{ "<pcic-id>": { es, en } }`,
// csak `word`/`phrase` kind tételekre (a `sentence`/`pattern` kind kimarad).
//
// Usage: node scripts/pcic-sentences.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const WORD_LEVELS = ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const PCIC_LEVELS = ['a1', 'a2', 'b1', 'b2'];

function normalize(es) {
  let s = String(es ?? '').toLowerCase();
  s = s.replace(/\([^)]*\)/g, ' '); // zárójeles glossza
  s = s.trim();
  s = s.replace(/^[¿¡"'.,;:!?-]+|[¿¡"'.,;:!?-]+$/g, ''); // szélső írásjel
  s = s.replace(/^(el|la|los|las|un|una)\s+/, ''); // névelő
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// a0..c2 sorrendben az első nem-üres sentence_es/en kártya nyer normalizált
// `es` kulcsonként (= legalacsonyabb szintű kártya, mert a tömb ebben a
// sorrendben fut és csak az első beírás számít).
const sentenceByNormEs = new Map();
for (const lvl of WORD_LEVELS) {
  const cards = JSON.parse(readFileSync(`data/words/${lvl}.json`, 'utf8'));
  for (const card of cards) {
    const es = String(card.sentence_es ?? '').trim();
    const en = String(card.sentence_en ?? '').trim();
    if (!es || !en) continue;
    const key = normalize(card.es);
    if (!key || sentenceByNormEs.has(key)) continue;
    sentenceByNormEs.set(key, { es, en });
  }
}

// Durva ige-tő heurisztika a tartalmaz-e auditra (nem kapu, csak jelentés):
// ragozott igénél a mondat nem a szótári alakot tartalmazza, ezért a kulcs
// szótöve (kb. az első 60%-a) is elég a "tartalmazza" számításhoz.
function stem(word) {
  return word.length > 4 ? word.slice(0, Math.ceil(word.length * 0.6)) : word;
}

let totalMatched = 0;
let totalWordPhrase = 0;
for (const lvl of PCIC_LEVELS) {
  const all = JSON.parse(readFileSync(`data/pcic/${lvl}-all.json`, 'utf8'));
  const allIds = new Set(all.map((item) => item.id));
  const wordPhrase = all.filter((item) => item.kind === 'word' || item.kind === 'phrase');

  const out = {};
  let containsForm = 0;
  for (const item of wordPhrase) {
    const key = normalize(item.es);
    const sentence = sentenceByNormEs.get(key);
    if (!sentence) continue;
    out[item.id] = { es: sentence.es, en: sentence.en };
    const firstWord = key.split(' ')[0] ?? '';
    if (firstWord && sentence.es.toLowerCase().includes(stem(firstWord))) containsForm += 1;
  }

  // Audit: minden kulcs létező PCIC-id, minden mondat nem üres.
  for (const [id, sentence] of Object.entries(out)) {
    if (!allIds.has(id)) throw new Error(`${lvl}: nem létező PCIC-id a kimenetben: ${id}`);
    if (!sentence.es.trim() || !sentence.en.trim()) throw new Error(`${lvl}: üres mondat: ${id}`);
  }

  const sortedOut = Object.fromEntries(Object.keys(out).sort().map((id) => [id, out[id]]));
  writeFileSync(`data/pcic/${lvl}-sentences.json`, `${JSON.stringify(sortedOut, null, 2)}\n`);

  const matched = Object.keys(out).length;
  totalMatched += matched;
  totalWordPhrase += wordPhrase.length;
  console.log(
    `${lvl}: ${matched}/${wordPhrase.length} egyezett (word+phrase), ` +
    `a mondat tartalmazza a tő/alakot ${containsForm}/${matched} esetben`
  );
}
console.log(`összesen: ${totalMatched}/${totalWordPhrase}`);
