// PLAN-vizsga D. szakasz 13. lépés (Kálmán, 2026-10-01, D1 b + D3): a szóbeli tétel a billentyűzet
// mikrofonjával megy, az app saját beszédfelismerőt nem használ. A diktált szöveg egy szövegmezőbe
// kerül; ez az összevető a diktált szöveget veti össze a várt mondattal és megmondja, mely szavak
// térnek el (explicit visszajelzés). Tiszta függvény, a próbavizsga szóbeli része és a későbbi
// beszéd-gyakorló is ezt használja.
//
// Szabály: kis- és nagybetű, valamint írásjel nem számít (a billentyűzet maga teszi a pontot és a
// nagybetűt). Az ékezet a meglévő "Accents count" beállítást követi (lib/pcicMatch.ts): bekapcsolva
// az ékezethiba hiba, kikapcsolva nem; az ñ külön betű, nem ékezet (año ≠ ano). A spanyol
// mondat elején álló alany-névmás elhagyható (FB399, mint a begépelt mondatnál).

import { withoutLeadingSubjectPronoun } from '@/lib/pcicMatch';

export interface DictationWord {
  /** A szó ahogy a mondatban áll (a hozzá tapadó írásjellel együtt, a megjelenítéshez). */
  text: string;
  /** Igaz, ha a másik oldalon van párja; hamis = eltérő (várt oldalon: hiányzik, diktált oldalon: felesleges). */
  ok: boolean;
}

export interface DictationResult {
  /** Minden szó egyezik (a beállított szabály szerint). */
  correct: boolean;
  /** A várt mondat szavai, `ok: false` = az a szó nem hangzott el (vagy más szó hangzott el helyette). */
  expected: DictationWord[];
  /** A diktált szöveg szavai, `ok: false` = felesleges vagy téves szó. */
  heard: DictationWord[];
  /** A várt mondatból hiányzó szavak, a mondat sorrendjében. */
  missing: string[];
  /** A diktált szövegből a várt mondatba nem illő szavak, az elhangzás sorrendjében. */
  extra: string[];
}

export interface DictationOptions {
  /** A "Accents count" beállítás: igaz = az ékezet számít. */
  strictAccents: boolean;
  /** Spanyol célnyelvnél igaz: a mondat eleji alany-névmás elhagyható. */
  subjectDrop?: boolean;
}

// Írásjel, ami sosem hiba (a billentyűzet teszi, vagy a tanuló nem mondja ki). Az aposztróf és a
// kötőjel marad (angolul "don't", "well-known" a szó része), mint a lib/pcicMatch.ts-ben.
const PUNCT = /[¿?¡!.,;:…"“”«»()[\]{}\u2014\u2013]/g;

function foldAccents(s: string): string {
  // Az ñ külön betű: NFD előtt védjük, különben "año" és "ano" egynek számítana.
  return s.normalize('NFC').replace(/ñ/g, '\uE000').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\uE000/g, 'ñ');
}

/** A szó összevetési kulcsa: kisbetű, írásjel nélkül, ékezet-szigor KI mellett ékezet nélkül. */
function keyOf(token: string, strictAccents: boolean): string {
  // A gördülő aposztróf (’) a billentyűzettől jöhet, ugyanaz, mint az egyenes.
  const lower = token.toLowerCase().replace(/[’‘]/g, "'").replace(PUNCT, '').trim();
  return strictAccents ? lower.normalize('NFC') : foldAccents(lower);
}

/** A szöveg szavai: szóközzel tördelve, a csak írásjelből (vagy magányos kötőjelből, aposztrófból) álló darabok nélkül. */
function tokens(text: string, strictAccents: boolean): { text: string; key: string }[] {
  return text
    .split(/\s+/)
    .map((raw) => ({ text: raw, key: keyOf(raw, strictAccents) }))
    .filter((t) => /[^-']/.test(t.key));
}

/** A leghosszabb közös részsorozat: melyik várt és diktált szónak van párja (a sorrendet megtartva). */
function alignedPairs(expected: string[], heard: string[]): Set<string> {
  const n = expected.length;
  const m = heard.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = expected[i] === heard[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === heard[j]) {
      pairs.add(`e${i}`);
      pairs.add(`h${j}`);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

function diff(heardText: string, expectedText: string, strictAccents: boolean): DictationResult {
  const exp = tokens(expectedText, strictAccents);
  const heard = tokens(heardText, strictAccents);
  const matched = alignedPairs(
    exp.map((t) => t.key),
    heard.map((t) => t.key),
  );
  const expected = exp.map((t, i) => ({ text: t.text, ok: matched.has(`e${i}`) }));
  const heardWords = heard.map((t, j) => ({ text: t.text, ok: matched.has(`h${j}`) }));
  const missing = expected.filter((w) => !w.ok).map((w) => w.text);
  const extra = heardWords.filter((w) => !w.ok).map((w) => w.text);
  return { correct: missing.length === 0 && extra.length === 0 && exp.length > 0, expected, heard: heardWords, missing, extra };
}

/** A diktált szöveg összevetése a várt mondattal; az eltérő szavak mindkét oldalon megjelölve. */
export function compareDictation(heard: string, expected: string, options: DictationOptions): DictationResult {
  const full = diff(heard, expected, options.strictAccents);
  if (full.correct || !options.subjectDrop) return full;
  const short = withoutLeadingSubjectPronoun(expected);
  if (short && diff(heard, short, options.strictAccents).correct) {
    // A névmás nélküli mondat is jó: a hiányzó névmás nem hiba, minden szó párosítva.
    return { correct: true, expected: full.expected.map((w) => ({ ...w, ok: true })), heard: full.heard.map((w) => ({ ...w, ok: true })), missing: [], extra: [] };
  }
  return full;
}
