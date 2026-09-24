// PLAN-fb0923 8. lépés (FB365-369), or-teszt (d): a data/pcic/a1-build.json
// minden hivatkozott id-ja létezik, minden "kimacha" forrású új tételnek van
// angol fordítása, és a lánc mondatainak (a nyolc célmondat + a bridge-ek)
// MINDEN szava vagy egy tag felszíni alakja, vagy funkciószó, vagy tulajdon-
// név (észak-csillag 4. pont: soha nincs mondat ismeretlen szóval).
import { CHAIN_FUNCTION_WORDS_ES } from '../pcicChains';
import a1Build from '../../data/pcic/a1-build.json';
import a1All from '../../data/pcic/a1-all.json';
import a1En from '../../data/pcic/a1-en.json';

interface RawItem {
  id: string;
  es: string;
  kind: string;
  source: string;
}

const ALL = a1All as RawItem[];
const BUILD = a1Build as Record<string, { tags: string[]; bridges?: string[] }>;
const BY_ID = new Map(ALL.map((i) => [i.id, i]));

// A jelen szelet (1.1 Existencia + 1.2 Presencia) tulajdonnevei; a szabály
// (PLAN-fb0923 7. lépés, PROMPT-POLICY-hoz kapcsolódó brief 1. pont): egy
// tulajdonnév sose tag. Bővítendő, ha egy újabb szelet újabb helynevet/nevet
// hoz be.
const PROPER_NOUNS = new Set(['toledo', 'vigo', 'luisa']);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Szabályos többes/nem-és egyeztetés a felszíni alakon (farmacias~farmacia,
// habitaciones~habitación, mucha~mucho): ékezet-semleges egyezés, és -s/-es
// levágásával képzett alak is elfogadott. Ha egy jövőbeli mondat olyan
// eltérést hoz, amit ez nem fed (pl. rendhagyó többes), egy explicit
// EXTRA_EQUIVALENTS bejegyzés kell ide, nem a szabály lazítása.
const EXTRA_EQUIVALENTS: Record<string, string> = {
  mucha: 'mucho',
  muchas: 'mucho',
  muchos: 'mucho',
  // a1-1b94c09a tagja "haber" (szótári alak), de a mondatban a rendhagyó,
  // ragozatlan "hay" alak áll (FB373: ugyanez a PCIC-tétel is "hay" néven fut).
  hay: 'haber',
};

function baseForms(word: string): string[] {
  const n = stripAccents(word.toLowerCase());
  const forms = new Set([n]);
  if (EXTRA_EQUIVALENTS[n]) forms.add(stripAccents(EXTRA_EQUIVALENTS[n]));
  if (n.endsWith('es')) forms.add(n.slice(0, -2));
  if (n.endsWith('s')) forms.add(n.slice(0, -1));
  return [...forms];
}

function tokens(es: string): string[] {
  return es.toLowerCase().match(/[a-záéíóúñü]+/g) ?? [];
}

function tagSurfaceForms(tagId: string): Set<string> {
  const item = BY_ID.get(tagId);
  const forms = new Set<string>();
  if (!item) return forms;
  for (const chunk of tokens(item.es)) {
    for (const f of baseForms(chunk)) forms.add(f);
  }
  return forms;
}

describe('a1-build.json lánc-audit (PLAN-fb0923 8. lépés, teszt d)', () => {
  it('minden hivatkozott tag/bridge id létezik az a1-all.json-ban', () => {
    const missing: string[] = [];
    for (const [sentenceId, entry] of Object.entries(BUILD)) {
      if (!BY_ID.has(sentenceId)) missing.push(sentenceId);
      for (const tagId of entry.tags) if (!BY_ID.has(tagId)) missing.push(tagId);
      for (const bridgeId of entry.bridges ?? []) if (!BY_ID.has(bridgeId)) missing.push(bridgeId);
    }
    expect(missing).toEqual([]);
  });

  it('minden "kimacha" forrású új tételnek van nem-üres angol fordítása', () => {
    const en = a1En as Record<string, string>;
    const missing = ALL.filter((i) => i.source === 'kimacha' && !(en[i.id] ?? '').trim()).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it('minden lánc-mondat minden szava tag, funkciószó vagy tulajdonnév', () => {
    const offenders: string[] = [];
    for (const [sentenceId, entry] of Object.entries(BUILD)) {
      const item = BY_ID.get(sentenceId);
      if (!item || item.kind !== 'sentence') continue; // csak a mondat-tételeket auditáljuk

      const covered = new Set<string>();
      for (const tagId of entry.tags) for (const f of tagSurfaceForms(tagId)) covered.add(f);

      for (const token of tokens(item.es)) {
        if (PROPER_NOUNS.has(token)) continue;
        if (CHAIN_FUNCTION_WORDS_ES.has(token)) continue;
        const forms = baseForms(token);
        if (forms.some((f) => covered.has(f))) continue;
        offenders.push(`${sentenceId} "${item.es}": "${token}" nincs se tagként, se funkciószóként lefedve`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
