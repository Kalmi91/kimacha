// Kimacha Play: single en-es pair, UI always English (Kálmán, 2026-09-22).
// This is no longer a full UI translation, the hu/es/de translation files
// were cut. This file survives only because FB63/76/108/149 want the usage
// toasts (per-minute pill, milestones, daily greeting, midnight rollover) to
// speak the language being LEARNED, which for Kimacha Play is always Spanish.
// `lib/i18n/index.ts`'s `stringsFor()` reads this `usage` object. Content
// kept 1:1 with the pre-cut Spanish strings, nothing paraphrased.
export default {
  usage: {
    plusOneMinute: '¡+1 minuto, guau!',
    milestoneSession: '🔥 ¡Guau, {min} minutos seguidos!',
    milestoneDaily: '🎉 ¡{min} minutos hoy, lo estás haciendo genial!',
    // FB149: pasada la primera hora, cada cuarto de hora, línea al azar.
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
    // FB108: cambio de día a medianoche, resumen del día cerrado + felicitación.
    // Se elige al azar, así que las frases vuelven a aparecer con el tiempo.
    dayRollover: [
      '🌙 ¡Medianoche! Ayer: {words} palabras, {min} minutos. Quien estudia a medianoche no lo hace por casualidad.',
      '✨ Día cerrado con {words} palabras y {min} minutos. La ciudad duerme y tú sueñas en español.',
      '🕛 ¡El reloj ha girado! {min} minutos, {words} palabras, un día entero de trabajo. Precioso.',
      '🚀 Empieza un día nuevo, el anterior cerró con {words} palabras y {min} minutos. Eso es costumbre, no suerte.',
      '🏆 {min} minutos, {words} palabras, y sigues aquí a medianoche. Eso es constancia.',
      '🌟 Ayer está hecho: {words} palabras, {min} minutos. Cada palabra es un ladrillo, y hoy también construiste.',
    ],
  },
};
