// UTEMEZO 2.5: "Nincs 'congested' állapot: a kézben lévő szavak száma sosem
// tartja vissza a keretet." A régi FB77/FB103/FB210 napi-keret aritmetika
// (capNewWords/newWordsLeftToday/newWordIntake/newWordPauseReason/
// badgeNewWordsLeft) ezzel elesett, az ütemező motor (lib/sessionQueue.ts
// QueueState.black) vette át a helyét. Ez a típus marad, a Done-képernyő
// props-alakja még ezt hordozza (dies in step 5).
export type NewWordPause = 'none' | 'congested' | 'daily-limit';
