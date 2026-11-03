import type en from '../en/stats';

const es: typeof en = {
  progress: {
    wordsKnown: 'Palabras conocidas',
  },
  // Kimacha Play: single en-es pair. This is no longer a
  // full UI translation, the hu/es/de translation files were cut. This file
  // survives only because the product wants the usage toasts (per-minute
  // pill, milestones, daily greeting, midnight rollover) to speak the
  // language being LEARNED, which for Kimacha Play is always Spanish.
  // `lib/i18n/index.ts`'s `stringsFor()` reads this `usage` object. Content
  // kept 1:1 with the pre-cut Spanish strings, nothing paraphrased.
  usage: {
    plusOneMinute: '¡+1 minuto, guau!',
    milestoneSession: '🔥 ¡Guau, {min} minutos seguidos!',
    milestoneDaily: '🎉 ¡{min} minutos hoy, lo estás haciendo genial!',
    // past the first hour, every quarter of an hour, random line.
    milestoneLong: [
      '🔥 ¡{hours} horas hoy! Esto ya no es estudiar, es entrenar.',
      '💪 {min} minutos de botín. El idioma ya no puede escaparse.',
      '🚀 Otro cuarto de hora, otro tramo ganado: {min} minutos sin parar.',
      '🧠 {min} minutos en un día. Tu cerebro está cableando algo nuevo.',
      '⚡ ¡{hours} horas! A este ritmo son semanas, no años.',
      '🏔️ {min} minutos y sigues subiendo. Ahí está la diferencia.',
      '🌊 {min} minutos seguidos. Hoy las palabras vienen solas.',
      '🎯 {hours} horas en la sesión de hoy. El que mete tanto, saca tanto.',
    ],
    dailyGreeting: '👋 ¡Hola! ¡Empecemos el estudio de hoy!',
    dailyGoalReached: (goal: number) => `¡Objetivo diario cumplido! ${goal} XP`,
    // midnight rollover, the finished day's stats plus a celebration.
    // Picked at random, so the lines come back around over time.
    dayRollover: [
      '🌙 ¡Medianoche! Ayer: {words} palabras, {min} minutos. Quien estudia a medianoche no lo hace por casualidad.',
      '✨ Día cerrado con {words} palabras y {min} minutos. La ciudad duerme y tú sueñas en español.',
      '🕛 ¡El reloj ha girado! {min} minutos, {words} palabras, un día entero de trabajo. Precioso.',
      '🚀 Empieza un día nuevo, el anterior cerró con {words} palabras y {min} minutos. Eso es costumbre, no suerte.',
      '🏆 {min} minutos, {words} palabras, y sigues aquí a medianoche. Eso es constancia.',
      '🌟 Ayer está hecho: {words} palabras, {min} minutos. Cada palabra es un ladrillo, y volviste a construir.',
    ],
  },
  stats: {
    title: 'Estadísticas de uso',
    today: 'Hoy',
    thisWeek: 'Esta semana',
    allTime: 'Total histórico',
    bestDay: 'Mejor día',
    daysActive: 'Días activos',
    minutes: (n: number) => `${n} min`,
    last7Days: 'Últimos 7 días',
    weeklyGoal: 'Objetivo semanal',
    goalProgress: (done: string, goal: string) => `${done} / ${goal} horas`,
    goalBehind: (left: string) => `⚠️ Te faltan ${left} horas para tu objetivo`,
    goalReached: '🏆 ¡Objetivo semanal cumplido!',
    noData: '¡Todavía no hay actividad, ve a aprender algo!',
    learningProgress: 'Progreso de aprendizaje',
    reviewsToday: 'Repasos de hoy',
    known21: 'Conocidas (21+ días)',
    graduatedLabel: 'Aprendiendo → dominadas',
    knownAtLevel: (level: string, known: number) => `${level} ${known}`,
    schedule: 'Calendario',
    scheduleDueNow: 'Esperando ahora',
    scheduleWaiting: (n: number) => `${n} palabras guardadas`,
    scheduleToday: 'Más tarde hoy',
    scheduleTomorrow: 'Mañana',
    scheduleDays2to3: 'En 2-3 días',
    scheduleDays4to7: 'En 4-7 días',
    scheduleLater: 'En más de una semana',
    scheduleWords: (n: number) => `${n} palabras`,
    scheduleNext: (when: string) => `Próxima repetición: ${when}`,
    scheduleNextToday: (time: string) => `hoy ${time}`,
    scheduleNextTomorrow: (time: string) => `mañana ${time}`,
    scheduleNextDays: (days: number) => `en ${days} ${days === 1 ? 'día' : 'días'}`,
    scheduleEmpty: '¡Todavía no hay nada guardado, aprende algunas palabras!',
  },
  board: {
    title: 'Ranking semanal',
    rankLine: (rank: number, xp: number) => `Lugar ${rank} · ${xp} XP`,
    resets: 'Se reinicia el lunes',
    joinPrompt: 'Escribe un nombre y descubre en qué lugar estás frente a los demás estudiantes.',
    joinWarning: 'Los demás estudiantes pueden ver tu nombre y tus XP de la semana.',
    namePlaceholder: 'Apodo',
    join: 'Unirme',
    nameTaken: 'Ese nombre ya está en uso, elige otro.',
    badName: 'Escribe un nombre (2-24 caracteres).',
    tooManyJoins: 'Hoy se unieron demasiadas personas desde esta red. Inténtalo de nuevo mañana.',
    offline: 'El ranking no está disponible por ahora.',
    loading: 'Cargando...',
    empty: 'Nadie ha ganado XP esta semana todavía.',
    xp: (xp: number) => `${xp} XP`,
    leave: 'Salir del ranking',
    leaveConfirm: 'Seguro que quieres salir? Tu nombre y tus XP de la semana se borrarán del ranking.',
    leaveYes: 'Salir',
  },
};

export default es;
