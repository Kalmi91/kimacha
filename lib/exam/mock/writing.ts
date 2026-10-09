// az írás-papír szigorítása (koordinátori észrevétel, 2026-10-01: a
// kulcsszavas pontozás túl laza volt: egy beillesztett feladat-szöveg, egy sokszor ismételt szó
// vagy értelmetlen betűhalmaz is kapott pontot a szószám miatt, az űrlap pedig bármilyen
// kitöltött mezőt elfogadott).
//
// Egy üzenet csak akkor ér pontot, ha ÉRTELMES szöveg: a feladat szövegéből bemásolt hosszú
// szakaszok nem számítanak, az értelmetlen szavak (magánhangzó nélküli, ismételt betűs) nem
// számítanak, a szöveg nem lehet szóismétlés, és (ha van szótár) a szavai nagyrészt a
// célnyelv ismert szavai. A tartalmi pont a szöveg legalább fele minimum-szószámát követeli,
// így egy-két szóba zsúfolt kulcsszó sem pontot. A hosszú, jó válasz továbbra is mind megkapja.

import type { PcicItem } from '@/data/pcic';
import type { MockFormField, MockTarget } from './types';

/** Kis/nagybetű és ékezet nélküli összevetés a kulcsszavakhoz. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Az ékezet nélküli, kisbetűs szavak (csak betűk és aposztróf; a számok és írásjelek kiesnek). */
export function foldedTokens(text: string): string[] {
  return fold(text)
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** Minimum ennyi egymás utáni szó egyezése a feladat szövegével "bemásolt" szakasz (természetes visszhang ennél rövidebb). */
const COPY_RUN = 5;
/** A szavak legalább ekkora hányada különböző (a sokszor ismételt szó nem szöveg). */
const MIN_DISTINCT_RATIO = 0.5;
/** A szavak legalább ekkora hányada ismert szótári szó (csak ha van szótár). */
const MIN_KNOWN_RATIO = 0.4;

const VOWELS = /[aeiouy]/;

// A billentyűzet sorai: 4 egymás melletti billentyű ("asdf", "qwer", "zxcv", visszafelé is) nem szó.
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KEY_RUNS = ROWS.flatMap((row) => {
  const out: string[] = [];
  for (let i = 0; i + 4 <= row.length; i++) {
    const run = row.slice(i, i + 4);
    out.push(run, [...run].reverse().join(''));
  }
  return out;
});

/** Értelmetlen szó: magánhangzó nélküli (3+ betű), ugyanaz a betű 4+ szer, 6+ mássalhangzó egymás után, vagy 4 egymás melletti billentyű. */
export function isNonsenseToken(tok: string): boolean {
  if (tok.length >= 3 && !VOWELS.test(tok)) return true;
  if (/([a-z])\1{3,}/.test(tok)) return true;
  if (/[^aeiouy']{6,}/.test(tok)) return true;
  return KEY_RUNS.some((run) => tok.includes(run));
}

// --- Szótár: a célnyelv ismert szavai a betöltött korpuszból + a leggyakoribb funkciószavak.

const FREE: Record<MockTarget, string> = {
  es: 'de la que el en y a los se del las un por con no una su para es al lo como mas pero sus le ya o fue este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho nada muchos cual poco ella estar estas algo nosotros mis tu te ti tus ellas soy eres somos son estoy estas esta estan tengo tiene tienen vivo vive trabajo quiero puedo voy va vamos hago hace gusta gustan llamo llama hola gracias adios por favor aqui alli hoy manana ayer',
  en: 'the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were am been has had does did said went made got very much more here where why yes hello thanks please today tomorrow yesterday live name',
};

const stripPunct = /[¿?¡!.,;:()"«»/]/g;

/** A célnyelvi szótár: a korpusz tételeinek célnyelvi alakja + példamondatai (a hívó adja a szintek tételeit). */
export function buildLexicon(items: PcicItem[], target: MockTarget): Set<string> {
  const lex = new Set<string>(FREE[target].split(' '));
  for (const it of items) {
    const forms = target === 'es' ? [it.es, it.exampleEs] : [it.en, it.exampleEn];
    for (const text of forms) {
      if (!text) continue;
      for (const tok of foldedTokens(text.replace(stripPunct, ' '))) lex.add(tok);
    }
  }
  return lex;
}

/** Ragozott/többes alakok is ismertnek számítanak (a szótár a szótári alakokat és a példamondatokat tartalmazza). */
function isKnown(tok: string, lex: ReadonlySet<string>): boolean {
  if (lex.has(tok)) return true;
  for (const suffix of ['s', 'es', 'ed', 'd', 'ing', 'a', 'as', 'o', 'os']) {
    if (tok.length > suffix.length + 2 && tok.endsWith(suffix) && lex.has(tok.slice(0, -suffix.length))) return true;
  }
  return false;
}

interface MessageAssessment {
  /** Az értelmes, nem bemásolt szavak száma. */
  words: number;
  /** Egyáltalán szövegnek számít-e (különben semmi nem ér pontot). */
  valid: boolean;
  /** A számításba vett szavak, szóközzel összefűzve (a kulcsszavas egyeztetés ezen fut). */
  text: string;
}

/**
 * Egy üzenet értékelése: a feladat szövegéből bemásolt szakaszokat és az értelmetlen szavakat
 * kihagyja, aztán ellenőrzi, hogy a maradék szöveg elég változatos és (ha van szótár) ismert
 * szavakból áll.
 */
export function assessMessage(text: string, reference: string[], lexicon?: ReadonlySet<string>): MessageAssessment {
  const tokens = foldedTokens(text);
  const ref = foldedTokens(reference.join(' '));
  const refRuns = new Set<string>();
  for (let i = 0; i + COPY_RUN <= ref.length; i++) refRuns.add(ref.slice(i, i + COPY_RUN).join(' '));
  const copied = new Array<boolean>(tokens.length).fill(false);
  for (let i = 0; i + COPY_RUN <= tokens.length; i++) {
    if (refRuns.has(tokens.slice(i, i + COPY_RUN).join(' '))) for (let k = i; k < i + COPY_RUN; k++) copied[k] = true;
  }
  const kept = tokens.filter((tok, i) => !copied[i] && !isNonsenseToken(tok));
  const distinctOk = kept.length < 6 || new Set(kept).size / kept.length >= MIN_DISTINCT_RATIO;
  const knownOk = !lexicon || kept.length === 0 || kept.filter((tok) => isKnown(tok, lexicon)).length / kept.length >= MIN_KNOWN_RATIO;
  return { words: kept.length, valid: kept.length > 0 && distinctOk && knownOk, text: kept.join(' ') };
}

/** Az űrlap egy mezőjének ellenőrzése: kitöltve és a mező fajtájának megfelelő, értelmes érték. */
export function checkField(field: MockFormField, raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  const tokens = foldedTokens(value);
  const sensible = tokens.length > 0 && !tokens.every(isNonsenseToken);
  const check = field.check ?? (field.type === 'number' ? 'age' : 'word');
  switch (check) {
    case 'fullname':
      return tokens.length >= 2 && tokens.every((t) => t.length >= 2) && sensible && !/\d/.test(value);
    case 'word':
      return tokens.some((t) => t.length >= 3) && sensible && !/\d/.test(value);
    case 'address':
      return tokens.some((t) => t.length >= 3) && /\d/.test(value) && sensible;
    case 'age': {
      const n = /^\d{1,3}$/.test(value) ? Number(value) : NaN;
      return n >= 5 && n <= 110;
    }
    case 'phone': {
      const digits = value.replace(/[\s+\-().]/g, '');
      return /^\d{7,15}$/.test(digits);
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    case 'level':
      return /^[abc][12]$/i.test(value);
  }
}
