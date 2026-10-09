// A PCIC item
// (the old PCIC corpus: id, order, es, kind, source, section,
// headword) has no part-of-speech field. We chose a
// cheap rule on the Spanish form, with no generation/data expansion. If a real
// `pos` field ever appears on the item, this function reads that first.
//
// PCIC stores the Spanish form
// without the article (`"es": "vida"`), so nouns were missed by the article rule.
// The main word corpus, however, stores it with the article ("la vida") and is far more
// precise than the cheap rule. From now on this corpus is the primary source; the
// article/verb-ending rule only runs if the lemma is not in it.
// The main corpus is data/words-open (data/openWords.ts);
// the gender of a noun comes from the article (the old annotator took it from there too).
import type { PcicKind } from '@/data/pcic';
import { openWords } from '@/data/openWords';
import type { WordGender, WordPos } from '@/data/words';

// the chip can get any corpus part of speech (not only noun/verb/phrase),
// so Pos covers the full WordPos set. `conj`
// exists only on the PCIC side (conjunction); it does not extend the corpus WordPos type,
// it comes from a hand-written PCIC `pos` field; the lemma index (from the corpus) yields only `conj` (the conjunctions of words-open).
// The words-open parts of speech `det` (determiner) and `interj` (interjection) also get a chip.
export type Pos = WordPos | 'conj' | 'det' | 'interj';

export interface PosInfo {
  pos: Pos;
  gender?: WordGender;
}

const ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una'];
const LEADING_ARTICLE = /^(el|la|los|las|un|una)\s+/;

// A single word ending in -ar/-er/-ir(se): an infinitive form.
const VERB_ENDING = /^[a-záéíóúñü]+(ar|er|ir|arse|erse|irse)$/i;

// Pos covers the full WordPos set, so every
// corpus part of speech makes it into the lemma index (previously only noun/verb/phrase).
// Taken from the raw part of speech of words-open (OpenWord.openPos).
const CORPUS_POS_TO_PCIC: Partial<Record<string, Pos>> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  pron: 'pron',
  prep: 'prep',
  num: 'num',
  conj: 'conj',
  det: 'det',
  interj: 'interj',
};

function normalizeLemma(es: string): string {
  return es.trim().toLowerCase().replace(LEADING_ARTICLE, '');
}

// Lazy, module-level Map<lemma, PosInfo | null>. `null` = two corpus items
// give the same lemma a different part of speech/gender, so we do not guess.
let lemmaIndex: Map<string, PosInfo | null> | null = null;

function getLemmaIndex(): Map<string, PosInfo | null> {
  if (lemmaIndex) return lemmaIndex;
  const map = new Map<string, PosInfo | null>();
  for (const w of openWords) {
    const pos = CORPUS_POS_TO_PCIC[w.openPos];
    if (!pos) continue;
    const info: PosInfo = pos === 'noun' && w.gender ? { pos, gender: w.gender } : { pos };
    // Every alternative of a slash form ("el carro / el coche") is its own lemma.
    for (const alt of w.es.split(' / ')) {
      const lemma = normalizeLemma(alt);
      if (!lemma) continue;
      if (!map.has(lemma)) {
        map.set(lemma, info);
        continue;
      }
      const existing = map.get(lemma);
      if (existing === null) continue; // already marked as colliding
      if (!existing || existing.pos !== info.pos || existing.gender !== info.gender) {
        map.set(lemma, null);
      }
    }
  }
  lemmaIndex = map;
  return map;
}

export function posOf(item: { es: string; kind: PcicKind; pos?: Pos | null }): PosInfo | null {
  // a sentence item never gets a part-of-speech chip, even if it
  // had a `pos` field or the corpus knew the Spanish form.
  if (item.kind === 'sentence') return null;
  if (item.pos) return { pos: item.pos };

  const es = item.es.trim();
  if (!es) return null;

  const corpusHit = getLemmaIndex().get(normalizeLemma(es.split(' / ')[0]));
  if (corpusHit !== undefined) return corpusHit;

  const parts = es.split(/\s+/);
  const first = parts[0]?.toLowerCase();

  if (ARTICLES.includes(first)) return { pos: 'noun' };
  if (parts.length === 1 && VERB_ENDING.test(es)) return { pos: 'verb' };
  if (item.kind === 'phrase' || parts.length > 1) return { pos: 'phrase' };
  return null;
}
