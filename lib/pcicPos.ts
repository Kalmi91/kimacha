// 5c (FB348/351/358/359, döntés 6b: nincs adat-generálás): a PCIC-tételnek
// (data/pcic/<szint>-all.json: id, order, es, kind, source, section,
// headword) nincs szófaj-mezője. Kálmán 2026-09-21 a (b) opciót választotta:
// olcsó szabály a spanyol alakból, generálás/adatbővítés nélkül. Ha egyszer
// lesz valódi `pos` mező a tételen, ez a függvény azt olvassa előbb.
//
// FB350 (3. commit, 2026-09-21): a PCIC névelő nélkül tárolja a spanyol
// alakot (`"es": "vida"`), ezért a főnevek a névelő-szabályból kimaradtak.
// A fő szókorpusz (data/words/*.json, FB184 óta `pos`+`gender`) viszont
// névelővel tárolja ("la vida"), és sokkal pontosabb, mint az olcsó szabály.
// Mostantól ez a korpusz az elsődleges forrás, a névelő/igevégződés-szabály
// csak akkor fut, ha a lemma nincs benne.
import type { PcicKind } from '@/data/pcic';
import { words, type WordGender, type WordPos } from '@/data/words';

export type Pos = 'noun' | 'verb' | 'phrase';

export interface PosInfo {
  pos: Pos;
  gender?: WordGender;
}

const ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una'];
const LEADING_ARTICLE = /^(el|la|los|las|un|una)\s+/;

// Egy szó és -ar/-er/-ir(se) végű: infinitivus alak.
const VERB_ENDING = /^[a-záéíóúñü]+(ar|er|ir|arse|erse|irse)$/i;

// A korpusz szélesebb szófaj-készletet visel (adj/adv/pron/...), mint a PCIC
// chip (csak noun/verb/phrase); ami nem esik ebbe a háromba, azt a lemma-index
// építése figyelmen kívül hagyja, és a lemma a régi szabályra esik vissza.
const CORPUS_POS_TO_PCIC: Partial<Record<WordPos, Pos>> = {
  noun: 'noun',
  verb: 'verb',
  phrase: 'phrase',
};

function normalizeLemma(es: string): string {
  return es.trim().toLowerCase().replace(LEADING_ARTICLE, '');
}

// Lusta, modul-szintű Map<lemma, PosInfo | null>. `null` = két korpusz-tétel
// ugyanarra a lemmára eltérő szófajt/nemet ad, tehát nem találgatunk.
let lemmaIndex: Map<string, PosInfo | null> | null = null;

function getLemmaIndex(): Map<string, PosInfo | null> {
  if (lemmaIndex) return lemmaIndex;
  const map = new Map<string, PosInfo | null>();
  for (const w of words) {
    const pos = w.pos ? CORPUS_POS_TO_PCIC[w.pos] : undefined;
    if (!pos) continue;
    const lemma = normalizeLemma(w.es);
    if (!lemma) continue;
    const info: PosInfo = pos === 'noun' && w.gender ? { pos, gender: w.gender } : { pos };
    if (!map.has(lemma)) {
      map.set(lemma, info);
      continue;
    }
    const existing = map.get(lemma);
    if (existing === null) continue; // már ütközőnek jelölve
    if (!existing || existing.pos !== info.pos || existing.gender !== info.gender) {
      map.set(lemma, null);
    }
  }
  lemmaIndex = map;
  return map;
}

export function posOf(item: { es: string; kind: PcicKind; pos?: Pos | null }): PosInfo | null {
  if (item.pos) return { pos: item.pos };

  const es = item.es.trim();
  if (!es) return null;

  const corpusHit = getLemmaIndex().get(normalizeLemma(es));
  if (corpusHit !== undefined) return corpusHit;

  const parts = es.split(/\s+/);
  const first = parts[0]?.toLowerCase();

  if (ARTICLES.includes(first)) return { pos: 'noun' };
  if (parts.length === 1 && VERB_ENDING.test(es)) return { pos: 'verb' };
  if (item.kind === 'phrase' || parts.length > 1) return { pos: 'phrase' };
  return null;
}
