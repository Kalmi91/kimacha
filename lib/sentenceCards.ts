// a mondatkártya kadenciája és a mondat-választás a
// pakli-menetben. Tiszta modul: a pakli-képernyő (app/(tabs)/index.tsx) adja be
// a kártyákat, a keresőt és a szókincs-listát, itt nincs állapot és nincs
// adatbázis. A kártya eredménye nem ír SRS-t (K3): csak gyakorlás.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { nearMissDistractors } from '@/lib/distractors';
import { isLearnedCard, isSentenceKnown, type LearnedEntry, type ResolvedTense } from '@/lib/knownSentence';
import { posOf } from '@/lib/pcicPos';
import type { Sm2Card } from '@/lib/sm2';

/** Ennyi ÚJ szó után jön egy mondatkártya (az ismétlő kártyák nem számítanak). */
export const NEW_WORDS_PER_SENTENCE = 4;

export type SentenceKind = 'tiles' | 'typing';

export interface CadenceState {
  /** A mondatot még nem kapott legutóbbi új szavak id-je (a számláló). */
  recent: string[];
  /** A következő mondatkártya fajtája; csak akkor vált, ha kártya jelent meg. */
  next: SentenceKind;
}

export const INITIAL_CADENCE: CadenceState = { recent: [], next: 'tiles' };

export type SentenceCardData =
  | { kind: 'tiles'; itemId: string; source: string; target: string; targetWords: string[]; trapWords: string[] }
  | { kind: 'typing'; itemId: string; source: string; target: string };

export interface SentenceDeps {
  target: PcicTarget;
  /** A pakli minden kártyája, a most értékelt is (a „tanult" kapu ebből épül). */
  cards: Iterable<Sm2Card>;
  /** A nyelvtani leckékkel feloldott igeidők (csak spanyol célnyelven számít). */
  tenses?: ReadonlySet<ResolvedTense>;
  findItem: (id: string) => PcicItem | undefined;
  /** A csapda-csempék forrása: az aktuális szint célnyelvi szavai (K4). */
  vocab: () => string[];
}

/** A tanult kártyákból a kapu szókincse: célnyelvi alak + szófaj. */
export function learnedEntries(
  cards: Iterable<Sm2Card>,
  target: PcicTarget,
  findItem: (id: string) => PcicItem | undefined,
): LearnedEntry[] {
  const out: LearnedEntry[] = [];
  for (const card of cards) {
    if (!isLearnedCard(card)) continue;
    const item = findItem(card.itemId);
    if (!item) continue;
    out.push({
      text: target === 'es' ? item.es : item.en,
      pos: item.pos ?? (target === 'es' ? posOf(item)?.pos : undefined),
    });
  }
  return out;
}

const SENTENCE_PUNCT = /[.!?¡¿,;:]/g;

/** A mondat írásjel nélkül, egyetlen szóközzel (összerakós és begépelős kártya közös alakja). */
export function stripSentencePunct(sentence: string): string {
  return sentence.replace(SENTENCE_PUNCT, '').replace(/\s+/g, ' ').trim();
}

/**
 * A csempék: a mondat szavai írásjel nélkül, az első kisbetűvel (a nagy
 * kezdőbetű elárulná, melyik csempe áll elöl; a bírálás kisbetű-független).
 */
export function tileWords(sentence: string): string[] {
  return sentence
    .replace(SENTENCE_PUNCT, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w));
}

function sentencePair(item: PcicItem, target: PcicTarget): { source: string; target: string } | null {
  const targetSentence = (target === 'es' ? item.exampleEs : item.exampleEn)?.trim();
  const sourceSentence = (target === 'es' ? item.exampleEn : item.exampleEs)?.trim();
  if (!targetSentence || !sourceSentence) return null;
  return { source: sourceSentence, target: targetSentence };
}

/**
 * Egy új szó értékelése után lép a kadencia: a NEW_WORDS_PER_SENTENCE-edik új
 * szónál a csoport szavainak saját példamondataiból az első, ami átmegy a
 * „csak tanult szó" kapun, mondatkártya lesz. Ha egy sem megy át, nincs kártya,
 * a számláló nullázódik, és a következő csoportnál újra próbál.
 */
export function nextSentenceStep(
  state: CadenceState,
  newItemId: string,
  deps: SentenceDeps,
): { state: CadenceState; card: SentenceCardData | null } {
  const recent = [...state.recent, newItemId];
  if (recent.length < NEW_WORDS_PER_SENTENCE) return { state: { ...state, recent }, card: null };

  const ctx = { learned: learnedEntries(deps.cards, deps.target, deps.findItem), tenses: deps.tenses };
  for (const id of recent) {
    const item = deps.findItem(id);
    const pair = item ? sentencePair(item, deps.target) : null;
    if (!pair || !isSentenceKnown(pair.target, deps.target, ctx)) continue;
    const other: SentenceKind = state.next === 'tiles' ? 'typing' : 'tiles';
    if (state.next === 'typing') {
      return { state: { recent: [], next: other }, card: { kind: 'typing', itemId: id, ...pair } };
    }
    const targetWords = tileWords(pair.target);
    const trapWords = nearMissDistractors(targetWords, deps.vocab().map((w) => w.split(' / ')[0]), deps.target);
    return {
      state: { recent: [], next: other },
      card: { kind: 'tiles', itemId: id, ...pair, targetWords, trapWords },
    };
  }
  return { state: { recent: [], next: state.next }, card: null };
}
