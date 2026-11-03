import type en from '../en/stats';

const de: typeof en = {
  progress: {
    wordsKnown: 'Bekannte Wörter',
  },
  // the usage toasts speak the language being LEARNED (stringsFor in lib/i18n/index.ts), so for
  // de this block is shown to people learning German: simple A1-level German, {placeholders} kept.
  usage: {
    plusOneMinute: '+1 Minute, super!',
    milestoneSession: '🔥 Wow, {min} Minuten ohne Pause!',
    milestoneDaily: '🎉 Heute schon {min} Minuten, du machst das toll!',
    // past the first hour, every quarter of an hour, random line.
    milestoneLong: [
      '🔥 Heute schon {hours} Stunden! Das ist kein Lernen mehr, das ist Training.',
      '💪 {min} Minuten geschafft! Die Sprache kann jetzt nicht mehr weglaufen.',
      '🚀 Noch eine Viertelstunde! Schon {min} Minuten, und du lernst weiter.',
      '🧠 {min} Minuten an einem Tag. Dein Kopf lernt gerade etwas Neues.',
      '⚡ {hours} Stunden! So brauchst du nur Wochen, nicht Jahre.',
      '🏔️ {min} Minuten, und du gehst weiter nach oben. Das macht den Unterschied.',
      '🌊 {min} Minuten ohne Pause. Heute kommen die Wörter zu dir.',
      '🎯 Heute schon {hours} Stunden. Wer viel gibt, bekommt auch viel zurück.',
    ],
    dailyGreeting: '👋 Hallo! Fangen wir mit dem Lernen an!',
    dailyGoalReached: (goal: number) => `Tagesziel erreicht! ${goal} XP`,
    // midnight rollover, the finished day's stats plus a celebration.
    // Picked at random, so the lines come back around over time.
    dayRollover: [
      '🌙 Mitternacht! Gestern: {words} Wörter, {min} Minuten. Wer um Mitternacht lernt, meint es ernst.',
      '✨ Der Tag ist zu Ende: {words} Wörter und {min} Minuten. Die Stadt schläft, du träumst auf Deutsch.',
      '🕛 Es ist Mitternacht! {min} Minuten, {words} Wörter, ein ganzer Arbeitstag. Schön!',
      '🚀 Ein neuer Tag beginnt. Der alte Tag endet mit {words} Wörtern und {min} Minuten. Das ist kein Glück, das ist Gewohnheit.',
      '🏆 {min} Minuten, {words} Wörter, und um Mitternacht bist du noch hier. Das ist Ausdauer.',
      '🌟 Gestern ist vorbei: {words} Wörter, {min} Minuten. Jedes Wort ist ein Stein, und du hast wieder gebaut.',
    ],
  },
  stats: {
    title: 'Nutzungsstatistik',
    today: 'Heute',
    thisWeek: 'Diese Woche',
    allTime: 'Gesamt',
    bestDay: 'Bester Tag',
    daysActive: 'Aktive Tage',
    minutes: (n: number) => `${n} Min.`,
    last7Days: 'Letzte 7 Tage',
    weeklyGoal: 'Wochenziel',
    goalProgress: (done: string, goal: string) => `${done} / ${goal} Stunden`,
    goalBehind: (left: string) => `⚠️ Noch ${left} Stunden bis zu deinem Ziel`,
    goalReached: '🏆 Wochenziel erreicht!',
    noData: 'Noch keine Daten. Los, lern etwas!',
    learningProgress: 'Lernfortschritt',
    reviewsToday: 'Wiederholungen heute',
    known21: 'Bekannt (21+ Tage)',
    graduatedLabel: 'Lernen → abgeschlossen',
    knownAtLevel: (level: string, known: number) => `${level} ${known}`,
    schedule: 'Zeitplan',
    scheduleDueNow: 'Jetzt fällig',
    scheduleWaiting: (n: number) => `${n} Wörter weggelegt`,
    scheduleToday: 'Später heute',
    scheduleTomorrow: 'Morgen',
    scheduleDays2to3: 'In 2-3 Tagen',
    scheduleDays4to7: 'In 4-7 Tagen',
    scheduleLater: 'In über einer Woche',
    scheduleWords: (n: number) => `${n} Wörter`,
    scheduleNext: (when: string) => `Nächste Wiederholung: ${when}`,
    scheduleNextToday: (time: string) => `heute ${time}`,
    scheduleNextTomorrow: (time: string) => `morgen ${time}`,
    scheduleNextDays: (days: number) => `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`,
    scheduleEmpty: 'Noch nichts weggelegt, lerne ein paar Wörter!',
  },
  // The Stats tab's weekly leaderboard (components/stats/WeeklyBoardCard.tsx).
  board: {
    title: 'Wochenrangliste',
    rankLine: (rank: number, xp: number) => `Platz ${rank} · ${xp} XP`,
    resets: 'Wird am Montag zurückgesetzt',
    joinPrompt: 'Wähle einen Namen und sieh, wo du unter den anderen Lernenden stehst.',
    joinWarning: 'Andere Lernende sehen deinen Namen und deine Wochen-XP.',
    namePlaceholder: 'Spitzname',
    join: 'Mitmachen',
    nameTaken: 'Dieser Name ist vergeben, wähle einen anderen.',
    badName: 'Gib einen Namen ein (2-24 Zeichen).',
    tooManyJoins: 'Aus diesem Netz sind heute schon zu viele beigetreten. Versuche es morgen wieder.',
    offline: 'Die Rangliste ist gerade nicht erreichbar.',
    loading: 'Wird geladen...',
    empty: 'Diese Woche hat noch niemand XP gesammelt.',
    xp: (xp: number) => `${xp} XP`,
    leave: 'Rangliste verlassen',
    leaveConfirm: 'Verlassen? Dein Name und deine Wochen-XP werden aus der Rangliste gelöscht.',
    leaveYes: 'Verlassen',
  },
};

export default de;
