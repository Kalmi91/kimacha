// PLAN-fb0923 2. lepes (FB361-362), egyszeri meres: szintenkent listazza,
// mely PCIC word/phrase tetelre ad a (bovitett) posOf meg is null-t, azutan
// hogy a lib/pcicPos.ts mar a teljes WordPos-keszletet olvassa a fo
// korpuszbol. Csak olvas, nem ir. A lib/pcicPos.ts TS-modult nem importalja
// (path-alias miatt), a lemma-index + szabaly logikajat egy-egy-ben
// ismetli plain JS-ben, ugyanazokkal a szabalyokkal.
//
// Usage: node scripts/pcic-pos-gaps.mjs [--level a1|a2|b1|b2] (alap: mind)

import { readFileSync, readdirSync } from 'node:fs';

const ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una'];
const LEADING_ARTICLE = /^(el|la|los|las|un|una)\s+/;
const VERB_ENDING = /^[a-záéíóúñü]+(ar|er|ir|arse|erse|irse)$/i;
const CORPUS_POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'phrase']);

function normalizeLemma(es) {
  return es.trim().toLowerCase().replace(LEADING_ARTICLE, '');
}

// Lemma-index a fo korpuszbol (data/words/*.json), lib/pcicPos.ts getLemmaIndex()-szel azonos szabaly.
function buildLemmaIndex() {
  const map = new Map();
  const dir = 'data/words';
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const entries = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
    for (const w of entries) {
      if (!w.pos || !CORPUS_POS.has(w.pos)) continue;
      const lemma = normalizeLemma(w.es);
      if (!lemma) continue;
      const info = w.pos === 'noun' && w.gender ? { pos: w.pos, gender: w.gender } : { pos: w.pos };
      if (!map.has(lemma)) {
        map.set(lemma, info);
        continue;
      }
      const existing = map.get(lemma);
      if (existing === null) continue;
      if (!existing || existing.pos !== info.pos || existing.gender !== info.gender) {
        map.set(lemma, null);
      }
    }
  }
  return map;
}

// lib/pcicPos.ts posOf()-tal azonos logika, sentence/pattern guard nelkul
// (ide csak word/phrase tetelt hivunk).
function posOf(item, lemmaIndex, existingPos) {
  if (existingPos) return { pos: existingPos };
  const es = item.es.trim();
  if (!es) return null;
  const corpusHit = lemmaIndex.get(normalizeLemma(es));
  if (corpusHit !== undefined) return corpusHit;
  const parts = es.split(/\s+/);
  const first = parts[0]?.toLowerCase();
  if (ARTICLES.includes(first)) return { pos: 'noun' };
  if (parts.length === 1 && VERB_ENDING.test(es)) return { pos: 'verb' };
  if (item.kind === 'phrase' || parts.length > 1) return { pos: 'phrase' };
  return null;
}

const levelArgIdx = process.argv.indexOf('--level');
const levels = levelArgIdx !== -1 ? [process.argv[levelArgIdx + 1]] : ['a1', 'a2', 'b1', 'b2'];

const lemmaIndex = buildLemmaIndex();

let grandTotal = 0;
let grandGap = 0;
for (const level of levels) {
  const all = JSON.parse(readFileSync(`data/pcic/${level}-all.json`, 'utf8'));
  const wordish = all.filter((item) => item.kind === 'word' || item.kind === 'phrase');
  const gaps = wordish.filter((item) => posOf(item, lemmaIndex, item.pos) === null);
  grandTotal += wordish.length;
  grandGap += gaps.length;
  console.log(`${level}: ${gaps.length}/${wordish.length} word/phrase tetel pos nelkul`);
  for (const g of gaps) {
    console.log(`  ${g.id}\t${g.kind}\t${g.section}\t"${g.es}"`);
  }
}
console.log(`\nOsszesen: ${grandGap}/${grandTotal} word/phrase tetel pos nelkul (4 szint).`);
