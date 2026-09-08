// FB187: a két diktálós játék logikája. A képernyő felolvassa a spanyol alakot, a
// tanuló beírja, amit hallott, és Kálmán döntése szerint MINDEN ésszerű alakot
// elfogadunk („mindegyiket fogadja el"): a számot számjeggyel és betűvel is, a
// dátumot számjeggyel, hónapnévvel, vagy teljesen spanyolul kimondva.

import { mulberry32 } from '../shuffle';
import {
  MONTHS_ES,
  WEEKDAYS_ES,
  dateToSpanish,
  monthName,
  numberToSpanish,
} from './spanishNumbers';

export type DictationMode = 'number' | 'date';

export interface NumberItem {
  mode: 'number';
  value: number;
  /** Amit a felolvasó kimond. */
  spoken: string;
}

export interface DateItem {
  mode: 'date';
  day: number;
  month: number;
  /** undefined = ebben a körben nincs kimondva a hét napja. */
  weekday?: number;
  spoken: string;
}

export type DictationItem = NumberItem | DateItem;

/** Ékezet- és írásjel-tűrő összehasonlító alak. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Szintenként más nagyságrend: A1 még kétjegyűig, C1 már ezresekig hall. */
export function numberRangeForLevel(level: string): number {
  switch (level) {
    case 'A0':
    case 'A1':
      return 100;
    case 'A2':
      return 1000;
    default:
      return 10000;
  }
}

export function buildNumberItem(seed: number, max: number): NumberItem {
  const rnd = mulberry32(seed);
  const value = Math.floor(rnd() * max);
  return { mode: 'number', value, spoken: numberToSpanish(value) };
}

export function buildDateItem(seed: number): DateItem {
  const rnd = mulberry32(seed);
  const month = 1 + Math.floor(rnd() * 12);
  // 28 nap minden hónapban létezik, így nincs érvénytelen dátum.
  const day = 1 + Math.floor(rnd() * 28);
  // A hét napja a körök felében hangzik el, hogy mindkét alak gyakorlódjon.
  const weekday = rnd() < 0.5 ? Math.floor(rnd() * 7) : undefined;
  return { mode: 'date', day, month, weekday, spoken: dateToSpanish(day, month, weekday) };
}

export function buildDictationItem(mode: DictationMode, seed: number, max: number): DictationItem {
  return mode === 'number' ? buildNumberItem(seed, max) : buildDateItem(seed);
}

/** A számjáték elfogadott válaszai: a számjegy és a spanyol betűs alak. */
function numberAnswers(item: NumberItem): string[] {
  return [String(item.value), item.spoken];
}

/**
 * A dátumjáték elfogadott válaszai. Kálmán döntése: mindegyik alak jó, mert a
 * cél a MEGÉRTÉS, nem az, hogy melyik írásmódot választja.
 */
function dateAnswers(item: DateItem): string[] {
  const d = String(item.day);
  const dd = d.padStart(2, '0');
  const m = String(item.month);
  const mm = m.padStart(2, '0');
  const month = monthName(item.month);
  const dayWord = numberToSpanish(item.day);
  const out: string[] = [];
  for (const day of [d, dd, dayWord]) {
    for (const mon of [m, mm, month]) {
      out.push(`${day} ${mon}`);
      out.push(`${day} de ${mon}`);
    }
  }
  // Fordított, „hónap nap" sorrend is átmegy: a számjegyes írásban ez a szokás
  // több országban, és a játék a megértést méri, nem a formátumot.
  for (const mon of [m, mm, month]) {
    for (const day of [d, dd, dayWord]) out.push(`${mon} ${day}`);
  }
  return out;
}

export function acceptedAnswers(item: DictationItem): string[] {
  const base = item.mode === 'number' ? numberAnswers(item) : dateAnswers(item);
  // A hét napja soha nem kötelező a válaszban, de ha leírja, az se hiba.
  if (item.mode === 'date' && item.weekday !== undefined) {
    const wd = WEEKDAYS_ES[item.weekday];
    return [...base, ...base.map((a) => `${wd} ${a}`), ...base.map((a) => `el ${wd} ${a}`)];
  }
  return base;
}

export function checkDictation(item: DictationItem, typed: string): boolean {
  const given = normalize(typed);
  if (!given) return false;
  return acceptedAnswers(item).some((a) => normalize(a) === given);
}

/** A felfedéskor mutatott „helyes válasz" sor. */
export function canonicalAnswer(item: DictationItem): string {
  if (item.mode === 'number') return `${item.value} = ${item.spoken}`;
  return `${item.day}.${String(item.month).padStart(2, '0')}. = ${item.spoken}`;
}

export const MONTH_COUNT = MONTHS_ES.length;
