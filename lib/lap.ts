// UTEMEZO 1. es 11. szakasz: egy szonak 3 lapja van (1=spanyol->angol felismeres,
// 2=angol->spanyol felismeres, 3=angol->spanyol gepeles). A `cards` tablan ket
// mezo tarolja ezt:
//   lap (0..3)      = hany lapot valaszolt HELYESEN a szo. A kovetkezo felkinalt
//                     lap `lap + 1`. lap = 3 <=> a szo megtanult.
//   in_hand (0/1)   = 1 attol a pillanattol, hogy a szo 1. lapja eloszor
//                     feljott, addig, amig a 3. lapjat helyesen nem valaszolja.
//                     Kulon mezo kell ra, mert a lap=0 onmagaban nem
//                     kulonbozteti meg az erintetlen szot attol, aminek az
//                     1. lapja mar feljott, de rontottak (rontott lap ugyanaz a
//                     lap marad, a szo nem esik vissza).
// Rossz valasz sosem valtoztatja a lap vagy in_hand erteket.

export type Lap = 0 | 1 | 2 | 3;

export const LAPS = 3;

export interface LapCard {
  lap: Lap;
  in_hand: 0 | 1;
}

export function isLearned(card: { lap?: number }): boolean {
  return (card.lap ?? 0) >= LAPS;
}

export function nextLap(card: { lap?: number }): 1 | 2 | 3 {
  return Math.min(LAPS, (card.lap ?? 0) + 1) as 1 | 2 | 3;
}

// Ugyanazok az alakok mint a regi phaseShape(0|1|2), csak egyestol indexelve.
export function lapShape(lap: 1 | 2 | 3): { isTyping: boolean; typingDirection?: 'native-to-learned' } {
  if (lap === 3) return { isTyping: true, typingDirection: 'native-to-learned' };
  if (lap === 2) return { isTyping: false, typingDirection: 'native-to-learned' };
  return { isTyping: false };
}

// CSAK a spec elotti sorok egyszeri DB-migraciojahoz (UTEMEZO 11. szakasz): a
// regi lap-allas a reps-lapses kulonbsegbol volt szamolva, ez a fuggveny azt a
// szamitast oriti meg a backfillhez, uj hivo ne hasznalja.
export function backfillLap(reps: number, lapses: number): Lap {
  return Math.min(LAPS, Math.max(0, reps - lapses)) as Lap;
}

// CSAK a fenti backfillLap UTANI, masodik, egyszeri DB-migraciohoz (UTEMEZO
// 12/4, 2026-09-17): az FSRS egy szot mar 2 helyes valasz utan Review allapotba
// leptethetett (FB111), a gepeles (3. lap) elott, tehat a reps-lapses szamitas
// utan is maradhatott olyan sor, ahol az FSRS mar Review (state >= 2), de a lap
// meg < 3. Innentol a fa csempeje es a tema-lezaras is a Stats-kartyaval egyezo
// definiciot hasznalja (lap >= 3 VAGY eltemetve), ezert ezeket a sorokat egyszer
// 3-ra kell allitani, kulonben a mar regen "kesz" temak visszanyilnanak. A
// nativ SQLite migraciot (lib/database.ts) jesttel nem lehet lefuttatni (kivul
// dob), ezert a szabalyt itt, tiszta JS-ben teszteljuk; a SQL UPDATE WHERE-je
// szo szerint ugyanezt a feltetelt irja le.
export function needsReviewLapBackfill(card: { state: number; lap?: number }): boolean {
  return card.state >= 2 && (card.lap ?? 0) < LAPS;
}
