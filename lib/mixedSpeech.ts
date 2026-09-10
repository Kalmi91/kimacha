// FB216, Kálmán 2026-09-09 (grammar:clases-de-palabras:lesson): „amikor nagy
// szöveg van akkor legyen egy lehetoseg, hogy felolvassa. ez nehéz lesz mert
// vannak benne angol és spanyol szavak is, ezeket csináld meg, hogy mind a két
// nyelven értelmesen olvassa fel."
//
// A nyelvtan-lecke szövege kevert: a magyarázat a tanuló saját nyelvén megy, a
// benne lévő PÉLDÁK spanyolul („FŐNÉV: dolog vagy személy (casa, perro)"). Egy
// hanggal felolvasva a spanyol példa magyar kiejtéssel szól, ami pont azt rontja
// el, amit tanítani akar. Ez a modul vágja szét a szöveget nyelv-szakaszokra; a
// felolvasás maga a lib/speech.ts dolga.
//
// A döntés a KORPUSZBÓL jön, nem nyelvfelismerő találgatásból: egy szó akkor
// spanyol, ha a spanyol szólistában szerepel ÉS a tanuló saját nyelvében nem
// (a „mi", „no", „un" típusú átfedés így a natív hangnál marad, tehát nem
// kapkod ide-oda a két hang egyetlen mondaton belül).

import { findWordByText, normalizeWordToken } from '@/data/words';

export interface SpeechSegment {
  text: string;
  /** A szakasz nyelve: a tanult nyelv kódja, vagy a tartalom nyelvéé. */
  lang: string;
}

export interface SplitOptions {
  learnedLang: string;
  nativeLang: string;
}

function inCorpus(token: string, lang: string): boolean {
  return !!findWordByText(token, lang, lang);
}

// A névelő és a leggyakoribb kötőszavak-elöljárók nem önálló korpusz-szavak
// („la casa" egy kártya), tehát a fenti korpusz-teszt nem ismerné fel őket, és a
// „la casa" közepén hangot váltana a felolvasó. Ezek a szavak akkor tartoznak a
// tanult nyelvhez, ha tanult nyelvű szó áll mellettük; magukban (magyar mondat
// közepén álló „de") maradnak a natív hangnál.
const FUNCTION_WORDS: Record<string, ReadonlySet<string>> = {
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'y', 'o', 'que',
  ]),
};

type TokenKind = 'learned' | 'native' | 'function';

/**
 * Egy token a tanult nyelvhez tartozik-e. Csak az „ismerem spanyolul, és nem
 * ismerem magyarul" eset számít; ami mindkettőben megvan, azt a natív hang
 * mondja.
 */
export function isLearnedToken(token: string, opts: SplitOptions): boolean {
  const norm = normalizeWordToken(token);
  if (!norm) return false;
  if (opts.learnedLang === opts.nativeLang) return false;
  return inCorpus(norm, opts.learnedLang) && !inCorpus(norm, opts.nativeLang);
}

function kindOf(token: string, opts: SplitOptions): TokenKind {
  // A függő szó akkor is a szomszédjától kap nyelvet, ha egyébként korpusz-szó
  // (a spanyol „de" kártya létezik, de a magyar mondat közepén álló „de" nem
  // spanyolul hangzik el).
  const norm = normalizeWordToken(token);
  if (norm && opts.learnedLang !== opts.nativeLang && FUNCTION_WORDS[opts.learnedLang]?.has(norm)) {
    return 'function';
  }
  return isLearnedToken(token, opts) ? 'learned' : 'native';
}

/**
 * A szöveg nyelv szerinti szakaszai, eredeti sorrendben. A szakaszok szövege
 * trimmelt (a hangmotor úgyis szünetet tart két utterance között), a szavak
 * sorrendje és írásmódja viszont érintetlen.
 */
export function splitByLanguage(text: string, opts: SplitOptions): SpeechSegment[] {
  const parts = text.split(/(\s+)/).filter((p) => p !== '');
  const words = parts.filter((p) => !/^\s+$/.test(p));
  const kinds = words.map((w) => kindOf(w, opts));

  // A függő szavak a SZOMSZÉDJUKTÓL kapják a nyelvüket: „la casa" egy spanyol
  // szakasz, a magyar mondatban magában álló „de" viszont magyar marad. A
  // döntés balról jobbra fut, hogy az „el perro" elején álló „el" is a mögötte
  // lévő spanyol szóhoz igazodjon.
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== 'function') continue;
    const before = kinds[i - 1];
    let after: TokenKind | undefined;
    for (let j = i + 1; j < kinds.length; j++) {
      if (kinds[j] === 'function') continue;
      after = kinds[j];
      break;
    }
    kinds[i] = before === 'learned' || after === 'learned' ? 'learned' : 'native';
  }

  const segments: SpeechSegment[] = [];
  let buffer = '';
  let bufferLang: string | null = null;
  let wordIndex = 0;

  const flush = () => {
    if (buffer.trim() && bufferLang) segments.push({ text: buffer.trim(), lang: bufferLang });
    buffer = '';
  };

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      buffer += part;
      continue;
    }
    const lang = kinds[wordIndex++] === 'learned' ? opts.learnedLang : opts.nativeLang;
    if (bufferLang !== null && lang !== bufferLang) flush();
    bufferLang = lang;
    buffer += part;
  }
  flush();
  return segments;
}
