import type en from '../en/stats';

const hu: typeof en = {
  progress: {
    wordsKnown: 'Ismert szavak',
  },
  // the usage toasts speak the language being LEARNED (stringsFor in lib/i18n/index.ts), so for
  // hu this block is shown to people learning Hungarian: simple A1-level Hungarian, {placeholders} kept.
  usage: {
    plusOneMinute: '+1 perc, hurrá!',
    milestoneSession: '🔥 Hű, {min} perc megállás nélkül!',
    milestoneDaily: '🎉 Ma már {min} perc! Nagyon ügyes vagy!',
    // past the first hour, every quarter of an hour, random line.
    milestoneLong: [
      '🔥 Ma már {hours} óra! Ez nem tanulás, ez edzés.',
      '💪 {min} perc kész! A nyelv most már nem tud elfutni.',
      '🚀 Még egy negyedóra! Már {min} perc, és te mész tovább.',
      '🧠 {min} perc egy nap alatt. Az agyad most valami újat tanul.',
      '⚡ {hours} óra! Így pár hét elég, nem kell sok év.',
      '🏔️ {min} perc, és még mész felfelé. Ez a nagy különbség.',
      '🌊 {min} perc szünet nélkül. Ma jönnek hozzád a szavak.',
      '🎯 Ma már {hours} óra. Aki sokat tesz bele, sokat kap vissza.',
    ],
    dailyGreeting: '👋 Szia! Kezdjük a mai tanulást!',
    dailyGoalReached: (goal: number) => `Megvan a napi cél! ${goal} XP`,
    // midnight rollover, the finished day's stats plus a celebration.
    // Picked at random, so the lines come back around over time.
    dayRollover: [
      '🌙 Éjfél! Tegnap: {words} szó, {min} perc. Aki éjfélkor tanul, az komolyan gondolja.',
      '✨ A nap kész: {words} szó és {min} perc. A város alszik, te pedig magyarul álmodsz.',
      '🕛 Éjfél van! {min} perc, {words} szó, egy egész nap munka. Szép volt.',
      '🚀 Új nap kezdődik. A tegnap {words} szóval és {min} perccel ért véget. Ez nem szerencse, ez szokás.',
      '🏆 {min} perc, {words} szó, és éjfélkor is itt vagy. Ez kitartás.',
      '🌟 A tegnap kész: {words} szó, {min} perc. Minden szó egy tégla, te pedig megint építettél.',
    ],
  },
  stats: {
    title: 'Használati statisztika',
    today: 'Ma',
    thisWeek: 'Ezen a héten',
    allTime: 'Összesen',
    bestDay: 'Legjobb nap',
    daysActive: 'Aktív napok',
    minutes: (n: number) => `${n} perc`,
    last7Days: 'Elmúlt 7 nap',
    weeklyGoal: 'Heti cél',
    goalProgress: (done: string, goal: string) => `${done} / ${goal} óra`,
    goalBehind: (left: string) => `⚠️ Még ${left} óra a célodig`,
    goalReached: '🏆 A heti cél teljesítve!',
    noData: 'Még nincs adat, tanulj valamit!',
    learningProgress: 'Tanulási haladás',
    reviewsToday: 'Mai ismétlések',
    known21: 'Ismert (21+ nap)',
    graduatedLabel: 'Tanulás → elsajátítva',
    knownAtLevel: (level: string, known: number) => `${level} ${known}`,
    schedule: 'Ütemezés',
    scheduleDueNow: 'Most esedékes',
    scheduleWaiting: (n: number) => `${n} szó elrakva`,
    scheduleToday: 'Ma később',
    scheduleTomorrow: 'Holnap',
    scheduleDays2to3: '2-3 nap múlva',
    scheduleDays4to7: '4-7 nap múlva',
    scheduleLater: 'Egy hétnél később',
    scheduleWords: (n: number) => `${n} szó`,
    scheduleNext: (when: string) => `Következő ismétlés: ${when}`,
    scheduleNextToday: (time: string) => `ma ${time}`,
    scheduleNextTomorrow: (time: string) => `holnap ${time}`,
    scheduleNextDays: (days: number) => `${days} nap múlva`,
    scheduleEmpty: 'Még nincs elrakott szó, tanulj párat!',
  },
};

export default hu;
