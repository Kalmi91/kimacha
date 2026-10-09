// (döntés 6b: nincs adat-generálás): a PCIC-tételnek
// (a régi PCIC-korpusz: id, order, es, kind, source, section,
// headword) nincs szófaj-mezője. A (b) opciót választottuk:
// olcsó szabály a spanyol alakból, generálás/adatbővítés nélkül. Ha egyszer
// lesz valódi `pos` mező a tételen, ez a függvény azt olvassa előbb.
//
// (3. commit, 2026-09-21): a PCIC névelő nélkül tárolja a spanyol
// alakot (`"es": "vida"`), ezért a főnevek a névelő-szabályból kimaradtak.
// A fő szókorpusz viszont névelővel tárolja ("la vida"), és sokkal pontosabb,
// mint az olcsó szabály. Mostantól ez a korpusz az elsődleges forrás, a
// névelő/igevégződés-szabály csak akkor fut, ha a lemma nincs benne.
// a fő korpusz a data/words-open (data/openWords.ts),
// a főnév neme a névelőből jön (a régi annotáló is onnan vette).
import type { PcicKind } from '@/data/pcic';
import { openWords } from '@/data/openWords';
import type { WordGender, WordPos } from '@/data/words';

// a chip minden korpusz-szófajt kaphat (nem csak noun/verb/phrase),
// ezért a Pos lefedi a teljes WordPos-készletet. A `conj`
// csak a PCIC oldalon létezik (kötőszó), a korpusz WordPos típusát ez nem
// bővíti, azt kézzel írt PCIC `pos` mező adja; a lemma-index (korpuszból) csak a `conj`-ot adja (a words-open kötőszavai).
// a words-open `det` (determináns) és `interj` (indulatszó) szófaja is chipet kap.
export type Pos = WordPos | 'conj' | 'det' | 'interj';

export interface PosInfo {
  pos: Pos;
  gender?: WordGender;
}

const ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una'];
const LEADING_ARTICLE = /^(el|la|los|las|un|una)\s+/;

// Egy szó és -ar/-er/-ir(se) végű: infinitivus alak.
const VERB_ENDING = /^[a-záéíóúñü]+(ar|er|ir|arse|erse|irse)$/i;

// a Pos lefedi a teljes WordPos-készletet, ezért minden
// korpusz-szófaj átjön a lemma-indexbe (korábban csak noun/verb/phrase).
// A words-open nyers szófajából (OpenWord.openPos).
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

// Lusta, modul-szintű Map<lemma, PosInfo | null>. `null` = két korpusz-tétel
// ugyanarra a lemmára eltérő szófajt/nemet ad, tehát nem találgatunk.
let lemmaIndex: Map<string, PosInfo | null> | null = null;

function getLemmaIndex(): Map<string, PosInfo | null> {
  if (lemmaIndex) return lemmaIndex;
  const map = new Map<string, PosInfo | null>();
  for (const w of openWords) {
    const pos = CORPUS_POS_TO_PCIC[w.openPos];
    if (!pos) continue;
    const info: PosInfo = pos === 'noun' && w.gender ? { pos, gender: w.gender } : { pos };
    // A perjeles alak ("el carro / el coche") minden alternatívája külön lemma.
    for (const alt of w.es.split(' / ')) {
      const lemma = normalizeLemma(alt);
      if (!lemma) continue;
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
  }
  lemmaIndex = map;
  return map;
}

export function posOf(item: { es: string; kind: PcicKind; pos?: Pos | null }): PosInfo | null {
  // mondat-tételnek sose jár szófaj-chip, még akkor sem, ha
  // volna `pos` mezője vagy a korpusz ismerné a spanyol alakot.
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
