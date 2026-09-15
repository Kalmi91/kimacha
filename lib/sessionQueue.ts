// UTEMEZO: a sor motorja. Tiszta fuggvenyek, determinisztikus; a DB-t es az
// FSRS-t a hivo irja az `effects` alapjan.
//
// The learning session queue: due card rows in, the ordered card list the
// learner sees out. Extracted from app/(tabs)/index.tsx so it can be driven by
// tests without a device, because both halves of FB129 (a pair-blind daily
// budget and an id lookup that only knew the Spanish set) emptied the queue in
// ways no UI-free unit test could see.

import { cardFromRow } from '@/lib/database';
import { capSentencesToCadence } from '@/lib/sentenceMix';
import { lapShape } from '@/lib/lap';
import { findWordById, type WordEntry } from '@/data/words';
import type { Card } from 'ts-fsrs';

export type TypingDir = 'learned-to-native' | 'native-to-learned';

export interface DueItem {
  wordId: number;
  type: string;
  card: Card;
  word: WordEntry;
  isTyping: boolean;
  isEasySentence?: boolean;
  typingDirection?: TypingDir;
}

// FB26: reorder word cards so no more than `maxRun` of the same kind (flashcard
// vs typing) appear in a row, keeping a balanced flashcard/typing mix.
export function interleaveByType(items: DueItem[], maxRun: number): DueItem[] {
  const flash = items.filter((i) => !i.isTyping);
  const typing = items.filter((i) => i.isTyping);
  const out: DueItem[] = [];
  let fi = 0, ti = 0;
  let last: boolean | null = null;
  let run = 0;
  while (fi < flash.length || ti < typing.length) {
    let pullTyping: boolean;
    if (fi >= flash.length) pullTyping = true;
    else if (ti >= typing.length) pullTyping = false;
    else if (last !== null && run >= maxRun) pullTyping = !last; // force a switch
    else pullTyping = (typing.length - ti) > (flash.length - fi); // pull from the fuller bucket
    const item: DueItem = pullTyping ? typing[ti++] : flash[fi++];
    out.push(item);
    if (item.isTyping === last) run++;
    else { run = 1; last = item.isTyping; }
  }
  return out;
}

// FB225, Kálmán 2026-09-10: „azt szeretném hogy minden szintet ha elkezdek a
// régi szavak ismétlése legyen benne". A sor eddig a JELENLEGI szint (illetve az
// aktív téma) szavaira volt szűkítve, így egy A2-re lépés után az A1-en már
// megkezdett szavak esedékes ismétlései kiesődtek a forgásból: a szint be volt
// fejezve, a szavak nem. `carryRows` az ezen a szűkítésen KÍVÜL esedékes,
// már megkezdett szó-kártyák listája (lásd getDueCarryoverCards).
//
// Az osztás: az ismétlés-helyek CARRY_SHARE része a régi szavaké, de sosem
// több, mint amennyit hoztak, és ha az egyik oldalnak kevesebb jut, a másik
// tölti fel a helyet. Carryover nélkül a sor változatlan.
export const CARRY_SHARE = 0.4;

const isReviewWord = (row: any) => row.type === 'word' && (row.reps ?? 0) > 0;

export function mergeCarryover(levelRows: any[], carryRows: any[], reviewSlots: number): any[] {
  if (carryRows.length === 0) return levelRows;
  const levelReviews = levelRows.filter(isReviewWord);
  const rest = levelRows.filter((row) => !isReviewWord(row));
  const total = Math.min(reviewSlots, levelReviews.length + carryRows.length);
  const carryTake = Math.min(
    carryRows.length,
    Math.max(total - levelReviews.length, Math.round(total * CARRY_SHARE)),
  );
  const merged = [...levelReviews.slice(0, total - carryTake), ...carryRows.slice(0, carryTake)]
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));
  // A sorrend ugyanaz marad, mint a szint-lekérdezésnél: ismétlések elől,
  // mondatok és új szavak utánuk, a többit az applyCadence rendezi.
  return [...merged, ...rest];
}

// Due rows → cards. `lang` is the language being learned: its branch owns the
// word ids (English from 5001, Hungarian from 6001), the shared Spanish set is
// the fallback. A row whose word cannot be resolved is dropped, so a wrong
// `lang` here silently empties the session (FB129).
export function buildQueue(rows: any[], lang: string): DueItem[] {
  return rows
    .map((row: any) => {
      const isWord = row.type === 'word';
      const isSentence = row.type === 'sentence';
      let isTyping = false;
      let typingDirection: TypingDir | undefined;

      if (isWord) {
        // UTEMEZO 11. szakasz: a lenti lekérdezések már csak MEGTANULT szavakat
        // adnak vissza (lap >= 3, in_hand = 0), egy review-lap tehát mindig a
        // 3. lap alakját hordozza (lásd lib/lap.ts lapShape).
        const shape = lapShape(3);
        isTyping = shape.isTyping;
        typingDirection = shape.typingDirection;
      } else {
        // Sentence: easy (tap-to-order) first time, hard (typing) after
        isTyping = row.reps > 0;
      }

      return {
        wordId: row.word_id,
        type: row.type,
        card: cardFromRow(row),
        word: findWordById(row.word_id, lang)!,
        isTyping,
        isEasySentence: isSentence && row.reps === 0,
        typingDirection,
      };
    })
    .filter((item: DueItem) => !!item.word);
}

export function applyCadence(items: DueItem[], wordsOnly: boolean, lang: string): DueItem[] {
  if (wordsOnly) {
    // FB24/26/27: words only, no sentences. Respect each word's natural phase
    // (flashcard L→N at reps0, flashcard N→L at reps1, typing N→L at reps>=2),
    // so a word becomes a typing card ONLY after it reached Good in BOTH
    // flashcard directions. Interleave so no >4 cards of one kind run, and the
    // first card is always a word flashcard (never a sentence build).
    const wordItems = items.filter((item) => item.type === 'word');
    return interleaveByType(wordItems, 4);
  }
  // FB31/FB36: repeating 4-words + 1-sentence unit (80% word / 20% sentence).
  // Sentence slots cycle easy → easy → typing on a counter that runs across
  // the whole queue, so the 2:1 easy:typing mix survives unit boundaries and
  // two sentence cards are never adjacent while words remain.
  const words: DueItem[] = [];
  const easy: DueItem[] = [];
  const typing: DueItem[] = [];
  // FB99: re-apply the cadence (and its 5-sentence ceiling) to the FINAL list,
  // after capNewWords removed the new words the daily budget cannot afford.
  for (const item of capSentencesToCadence(items, (i) => i.type !== 'word')) {
    if (item.type === 'word') words.push(item);
    else if (item.isEasySentence) easy.push(item);
    else typing.push(item);
  }
  // FB33/FB35: easy sentences come simplest-first (learned-language word
  // count, then character length; stable). Typing sentences are due FSRS
  // reviews, so their order stays untouched.
  const sentOf = (item: DueItem) => String(item.word[`sentence_${lang}`]).trim();
  easy.sort((a, b) => {
    const sa = sentOf(a), sb = sentOf(b);
    const wa = sa.split(/\s+/).filter(Boolean).length;
    const wb = sb.split(/\s+/).filter(Boolean).length;
    return wa - wb || sa.length - sb.length;
  });
  const result: DueItem[] = [];
  let wi = 0, ei = 0, ti = 0, slot = 0;
  while (wi < words.length) {
    const batch = words.slice(wi, wi + 4);
    wi += batch.length;
    result.push(...batch);
    if (ei >= easy.length && ti >= typing.length) continue; // no sentences left, words go on
    const wantTyping = slot % 3 === 2;
    slot++;
    // an empty scheduled bucket falls back to the other, no due sentence dropped
    if (wantTyping ? ti < typing.length : ei >= easy.length) { result.push(typing[ti]); ti++; }
    else { result.push(easy[ei]); ei++; }
  }
  // words exhausted: alternate remaining easy/typing so neither kind dumps
  // in one long run (FB31)
  let takeEasy = true;
  while (ei < easy.length || ti < typing.length) {
    if (takeEasy ? ei < easy.length : ti >= typing.length) { result.push(easy[ei]); ei++; }
    else { result.push(typing[ti]); ti++; }
    takeEasy = !takeEasy;
  }
  return result;
}

// ---------------------------------------------------------------------------
// UTEMEZO 2-9. szakasz: a kor-motor. Egy "lap" a tanulo elott: vagy egy kezben
// levo szo kovetkezo lapja (1/2/3), vagy egy esedekes review-lap (mindig a 3.
// lap, ide ertve a mondat-lapokat is). A motor sosem ir DB-t vagy FSRS-t
// kozvetlenul: a hivo az `answer()` altal visszaadott `effects` listat irja
// vissza a DB-be es az FSRS-be.

export type LapNo = 1 | 2 | 3;

// lap = a szo KOVETKEZO felkinalando lapja (1..3); lastShown = a `step`
// ertek, amikor ennek a szonak egy lapja utoljara feljott (-Infinity, ha meg
// egyszer sem ebben a korben); repair = ez a lap egy rontas utan jott vissza
// (cimkeje "javitas").
export interface HandWord {
  wordId: number;
  lap: LapNo;
  lastShown: number;
  repair: boolean;
}

export interface ReviewLap {
  wordId: number;
  type: 'word' | 'sentence';
  isTyping: boolean;
  isEasySentence?: boolean;
  typingDirection?: TypingDir;
  repair: boolean;
}

export interface QueueConfig {
  hand: number; // P: hany szo lehet egyszerre kezben (UTEMEZO 3.1)
  gap: number; // R: minimum res ket lap kozt ugyanabbol a szobol (UTEMEZO 4.2)
  rhythm: number; // hany review-lap jon egy kezben-levo lap elott (UTEMEZO 4.1)
}

export interface QueueStats {
  reviewsAnswered: number;
  wordsStarted: number;
  wordsLearned: number;
  wrongLaps: number;
}

export interface Shown {
  kind: 'hand' | 'review';
  wordId: number;
  type: 'word' | 'sentence';
  lap?: LapNo;
  label: string;
  isTyping: boolean;
  typingDirection?: TypingDir;
  isEasySentence?: boolean;
  repair: boolean;
}

export interface QueueState {
  config: QueueConfig;
  step: number; // ez idaig feljott lapok szama ebben a korben (a res-ora)
  black: number; // UTEMEZO 6: ma meg indithato uj szavak szama ezen a szinten
  hand: HandWord[]; // kezben levo szavak; a sorrend a bekerules sorrendje, a
  // kivalasztas lastShown szerint rendez
  reviews: ReviewLap[]; // hatralevo review-lapok sorban (a lista sorrendje
  // maga hordozza a res-t, lasd answer())
  fresh: number[]; // a szint erintetlen szo-id-jei, abban a sorrendben, ahogy
  // a hivo inditani akarja oket (a temasorrend/veletlen az EGYETLEN veletlen,
  // a hivo dontese)
  sinceHand: number; // hany review-lap jott a legutobbi kezben-levo lap ota
  current: Shown | null; // a kepernyon levo lap
  stats: QueueStats;
}

// UTEMEZO 2.2: `answer()` maga sosem ad startWord effectet, mert a keret nem a
// valaszkor, hanem akkor fogy, amikor egy szo 1. lapja FELJON (startNew, lasd
// nextLap). A hivo ezert a nextLap() korul dont: ha `header(next).black <
// header(prev).black`, hivja meg db.startWord-ot az uj kezben-levo szora.
export type Effect =
  | { type: 'passLap'; wordId: number } // DB: passLap
  | { type: 'learned'; wordId: number } // a 3. lap helyes volt: a DB passLap
      // mar lefutott, a hivo adja a szonak az ELSO FSRS-ertekelest (Good)
  | { type: 'grade'; wordId: number; cardType: 'word' | 'sentence'; correct: boolean } // review-lap: FSRS-ertekeles
  | { type: 'attempt'; wordId: number; cardType: 'word' | 'sentence'; correct: boolean }; // stats-sor minden megvalaszolt laphoz

export const DEFAULT_QUEUE_CONFIG: QueueConfig = { hand: 5, gap: 5, rhythm: 4 };

export function createQueue(init: {
  config?: Partial<QueueConfig>;
  black: number;
  hand: { wordId: number; lap: LapNo }[];
  reviews: ReviewLap[];
  fresh: number[];
}): QueueState {
  return {
    config: { ...DEFAULT_QUEUE_CONFIG, ...init.config },
    step: 0,
    black: init.black,
    // -Infinity: meg egyik sem jott fel ebben az uj korben, mind azonnal
    // eselyes (UTEMEZO 3.5/3.6: a kezben levo szavak athozodnak, de a res-ora
    // az uj korrel ujraindul).
    hand: init.hand.map((h) => ({ wordId: h.wordId, lap: h.lap, lastShown: -Infinity, repair: false })),
    reviews: [...init.reviews],
    fresh: [...init.fresh],
    sinceHand: 0,
    current: null,
    stats: { reviewsAnswered: 0, wordsStarted: 0, wordsLearned: 0, wrongLaps: 0 },
  };
}

// UTEMEZO 6. szakasz: a fejlec harom szama. `blue` es `pink` a hatralevo
// LAPOKAT szamolja, a kepernyon levot is bele ertve; a kezben levo szo `lap`
// mezeje mar a kepernyon levo lap, ezert a `blue` osszegnek nincs kulon
// korrekcioja kellene. A `pink` a reviews[] listahoz +1-et ad, ha eppen egy
// review-lap van a kepernyon (a reviews[] csak a meg fel NEM jott lapokat
// tartalmazza).
export function header(state: QueueState): { black: number; blue: number; pink: number } {
  const blue = state.hand.reduce((sum, h) => sum + (4 - h.lap), 0);
  const pink = state.reviews.length + (state.current?.kind === 'review' ? 1 : 0);
  return { black: state.black, blue, pink };
}

// UTEMEZO 7. szakasz: minden lapon egy cimke.
export function labelOf(shown: Shown): string {
  if (shown.kind === 'hand') {
    return `${shown.repair ? 'javítás' : 'új'} · ${shown.lap}/3`;
  }
  if (shown.type === 'sentence') return 'mondat';
  return shown.repair ? 'javítás' : 'ismétlés';
}

function shownFromReview(lap: ReviewLap): Shown {
  const shown: Shown = {
    kind: 'review',
    wordId: lap.wordId,
    type: lap.type,
    label: '',
    isTyping: lap.isTyping,
    typingDirection: lap.typingDirection,
    isEasySentence: lap.isEasySentence,
    repair: lap.repair,
  };
  shown.label = labelOf(shown);
  return shown;
}

function shownFromHand(word: HandWord): Shown {
  const shape = lapShape(word.lap);
  const shown: Shown = {
    kind: 'hand',
    wordId: word.wordId,
    type: 'word',
    lap: word.lap,
    label: '',
    isTyping: shape.isTyping,
    typingDirection: shape.typingDirection,
    repair: word.repair,
  };
  shown.label = labelOf(shown);
  return shown;
}

// Review-slot: a legelso review-lap jon, a lista sorrendje hordozza a rest
// (lasd answer()). `sinceHand` no, akkor is, ha ezt a hivo a kezben-slot
// helyett hivja (UTEMEZO 4.4c: nincs eselyes kezben-levo lap es nincs uj szo,
// a review tartja a ritmust).
function showReview(state: QueueState, newStep: number): QueueState {
  const [lap, ...rest] = state.reviews;
  return {
    ...state,
    step: newStep,
    reviews: rest,
    sinceHand: state.sinceHand + 1,
    current: shownFromReview(lap),
  };
}

// Kezben-slot, egy mar kezben levo szo lapja: `sinceHand` nullazodik, a szo
// `lastShown` erteke erre a lepesre all.
function showHand(state: QueueState, newStep: number, idx: number): QueueState {
  const word = state.hand[idx];
  const hand = state.hand.map((h, i) => (i === idx ? { ...h, lastShown: newStep } : h));
  return {
    ...state,
    step: newStep,
    hand,
    sinceHand: 0,
    current: shownFromHand(word),
  };
}

// Kezben-slot, uj szo inditasa (UTEMEZO 3.2): fekete −1, a szo bekerul kezbe
// az 1. lapjaval.
function startNew(state: QueueState, newStep: number): QueueState {
  const wordId = state.fresh[0];
  const newWord: HandWord = { wordId, lap: 1, lastShown: newStep, repair: false };
  return {
    ...state,
    step: newStep,
    black: state.black - 1,
    hand: [...state.hand, newWord],
    fresh: state.fresh.slice(1),
    sinceHand: 0,
    current: shownFromHand(newWord),
    stats: { ...state.stats, wordsStarted: state.stats.wordsStarted + 1 },
  };
}

// UTEMEZO 4. szakasz: a sor. Determinisztikus, tiszta fuggveny: sosem
// mutalja a bemenetet, mindig uj allapotot ad vissza. `current === null` a
// visszateresi ertekben azt jelenti, hogy a kor veget ert (UTEMEZO 4.5).
export function nextLap(state: QueueState): QueueState {
  const { config } = state;
  const newStep = state.step + 1;
  const wantHand = state.reviews.length === 0 || state.sinceHand >= config.rhythm;

  if (!wantHand) {
    return showReview(state, newStep);
  }

  // (a) van-e olyan kezben levo szo, aminek megvan a rese (never shown =
  // eselyes); a legregebb ota varo (legkisebb lastShown) jon, dontetlennel a
  // hand[] tomb sorrendje dont.
  let bestIdx = -1;
  for (let i = 0; i < state.hand.length; i++) {
    const w = state.hand[i];
    if (newStep - w.lastShown > config.gap) {
      if (bestIdx === -1 || w.lastShown < state.hand[bestIdx].lastShown) bestIdx = i;
    }
  }
  if (bestIdx !== -1) return showHand(state, newStep, bestIdx);

  // (b) nincs eselyes kezben levo lap: uj szo, ha van hely es fekete > 0.
  if (state.hand.length < config.hand && state.black > 0 && state.fresh.length > 0) {
    return startNew(state, newStep);
  }

  // (c) uj szo sem johet: egy review-lap tartja a ritmust, a kezben-slot
  // legkozelebb ujra probalkozik.
  if (state.reviews.length > 0) {
    return showReview(state, newStep);
  }

  // (d) sem review, sem eselyes kezben-lap, sem uj szo: a legregebb ota varo
  // kezben levo lap jon, roviddebb ressel.
  if (state.hand.length > 0) {
    let idx = 0;
    for (let i = 1; i < state.hand.length; i++) {
      if (state.hand[i].lastShown < state.hand[idx].lastShown) idx = i;
    }
    return showHand(state, newStep, idx);
  }

  // (e) minden 0: a kor veget ert.
  return { ...state, step: newStep, current: null };
}

// UTEMEZO 3.3/3.4 es 4.2: a valasz alkalmazasa a kepernyon levo lapra.
// Tiszta fuggveny: uj allapotot ad vissza, `current`-et nullazza, es az
// `effects` listat, amit a hivo ir vissza a DB-be/FSRS-be.
export function answer(state: QueueState, correct: boolean): { state: QueueState; effects: Effect[] } {
  const shown = state.current;
  if (!shown) return { state, effects: [] };

  if (shown.kind === 'hand') {
    const idx = state.hand.findIndex((h) => h.wordId === shown.wordId);
    const word = state.hand[idx];
    const effects: Effect[] = [{ type: 'attempt', wordId: shown.wordId, cardType: 'word', correct }];

    if (correct) {
      effects.push({ type: 'passLap', wordId: shown.wordId });
      if (word.lap < 3) {
        const hand = state.hand.map((h, i) =>
          i === idx ? { ...h, lap: (h.lap + 1) as LapNo, repair: false } : h,
        );
        return { state: { ...state, hand, current: null }, effects };
      }
      // 3. lap helyes: a szo MEGTANULT, kikerul kezbol, elso FSRS-ertekeles.
      effects.push({ type: 'learned', wordId: shown.wordId });
      const hand = state.hand.filter((_, i) => i !== idx);
      return {
        state: {
          ...state,
          hand,
          current: null,
          stats: { ...state.stats, wordsLearned: state.stats.wordsLearned + 1 },
        },
        effects,
      };
    }

    // rontott lap: ugyanaz a lap marad, csak a cimke valt "javitas"-ra.
    const hand = state.hand.map((h, i) => (i === idx ? { ...h, repair: true } : h));
    return {
      state: {
        ...state,
        hand,
        current: null,
        stats: { ...state.stats, wrongLaps: state.stats.wrongLaps + 1 },
      },
      effects,
    };
  }

  // review-lap
  const effects: Effect[] = [
    { type: 'attempt', wordId: shown.wordId, cardType: shown.type, correct },
    { type: 'grade', wordId: shown.wordId, cardType: shown.type, correct },
  ];

  if (correct) {
    return {
      state: {
        ...state,
        current: null,
        stats: { ...state.stats, reviewsAnswered: state.stats.reviewsAnswered + 1 },
      },
      effects,
    };
  }

  // rontott review-lap: visszakerul a sorba R hellyel kesobb (vagy a vegere,
  // ha rovidebb a lista), UTEMEZO 4.2.
  const requeued: ReviewLap = {
    wordId: shown.wordId,
    type: shown.type,
    isTyping: shown.isTyping,
    isEasySentence: shown.isEasySentence,
    typingDirection: shown.typingDirection,
    repair: true,
  };
  const at = Math.min(state.config.gap, state.reviews.length);
  const reviews = [...state.reviews.slice(0, at), requeued, ...state.reviews.slice(at)];
  return {
    state: {
      ...state,
      reviews,
      current: null,
      stats: { ...state.stats, wrongLaps: state.stats.wrongLaps + 1 },
    },
    effects,
  };
}

// UTEMEZO 3.5: a kepernyon levo lap valasz nelkul tavozik (snooze, vagy ures
// begepelt valasz). Nincs stat, nincs effect. Review-lap: `drop` eseten
// kikerul a korbol (pink -1, mert mar ugyis kikerult a reviews[]-bol amikor
// feljott, lasd showReview); kulonben visszakerul R hellyel kesobb, a repair
// jelzo valtozatlan marad. Kezben-levo lap: `drop` eseten a szo kikerul a
// `hand`-bol ERRE a korre (a DB in_hand=1 marad, a szo a kovetkezo korben
// legelsokent jon vissza, UTEMEZO 3.5); kulonben a helyen marad, a lastShown
// mar erre a lepesre all (showHand), tehat a res utan ujra eselyes lesz.
export function defer(state: QueueState, opts: { drop: boolean }): QueueState {
  const shown = state.current;
  if (!shown) return state;

  if (shown.kind === 'review') {
    if (opts.drop) {
      return { ...state, current: null };
    }
    const requeued: ReviewLap = {
      wordId: shown.wordId,
      type: shown.type,
      isTyping: shown.isTyping,
      isEasySentence: shown.isEasySentence,
      typingDirection: shown.typingDirection,
      repair: shown.repair,
    };
    const at = Math.min(state.config.gap, state.reviews.length);
    const reviews = [...state.reviews.slice(0, at), requeued, ...state.reviews.slice(at)];
    return { ...state, reviews, current: null };
  }

  // kezben-levo lap
  if (opts.drop) {
    const hand = state.hand.filter((h) => h.wordId !== shown.wordId);
    return { ...state, hand, current: null };
  }
  return { ...state, current: null };
}

// UTEMEZO: a "mutasd mondatban" gomb segedje. A hivo elobb answer(state,
// false)-t hiv a kepernyon levo lapra, majd ezt: az uj lap a reviews[]
// LEGELEJERE kerul (a kovetkezo nextLap() azt mutatja), miutan minden mas,
// ugyanerre a szora es tipusra szolo review-lapot kivett a listabol (nem
// lehet ket varakozo lap ugyanarra a szora/mondatra).
export function insertNext(state: QueueState, lap: ReviewLap): QueueState {
  const reviews = state.reviews.filter((r) => !(r.wordId === lap.wordId && r.type === lap.type));
  return { ...state, reviews: [lap, ...reviews] };
}
