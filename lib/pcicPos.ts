// 5c (FB348/351/358/359, döntés 6b: nincs adat-generálás): a PCIC-tételnek
// (data/pcic/<szint>-all.json: id, order, es, kind, source, section,
// headword) nincs szófaj-mezője. Kálmán 2026-09-21 a (b) opciót választotta:
// olcsó szabály a spanyol alakból, generálás/adatbővítés nélkül. Ha egyszer
// lesz valódi `pos` mező a tételen, ez a függvény azt olvassa előbb.
import type { PcicKind } from '@/data/pcic';

export type Pos = 'noun' | 'verb' | 'phrase';

const ARTICLES = ['el', 'la', 'los', 'las', 'un', 'una'];

// Egy szó és -ar/-er/-ir(se) végű: infinitivus alak.
const VERB_ENDING = /^[a-záéíóúñü]+(ar|er|ir|arse|erse|irse)$/i;

export function posOf(item: { es: string; kind: PcicKind; pos?: Pos | null }): Pos | null {
  if (item.pos) return item.pos;

  const es = item.es.trim();
  if (!es) return null;
  const words = es.split(/\s+/);
  const first = words[0]?.toLowerCase();

  if (ARTICLES.includes(first)) return 'noun';
  if (words.length === 1 && VERB_ENDING.test(es)) return 'verb';
  if (item.kind === 'phrase' || words.length > 1) return 'phrase';
  return null;
}
