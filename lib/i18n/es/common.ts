import type en from '../en/common';

const es: typeof en = {
  onboarding: {
    welcome: '¡Bienvenido a Kimacha! Gracias por usar la app, significa mucho.',
    start: 'Empezar',
    learnTitle: '¿Qué idioma quieres aprender?',
  },
  intro: {
    title: 'Así funciona',
    start: 'Empecemos',
    first: 'Aprender un idioma es un camino largo y difícil. Habrá días pesados, pero todos pueden lograrlo, y tú también.',
    words: 'Palabras: en tarjetas, un poquito cada día.',
    grammar: 'Gramática: lecciones cortas donde armas oraciones.',
    exam: 'Después, un examen: demuestras lo que sabes.',
    repetition: 'Repasar es la clave: la palabra regresa justo cuando la ibas a olvidar.',
    overdo:
      'No te pases: lo nuevo de hoy es repaso de mañana. Muchas palabras nuevas hoy = mucho trabajo mañana, cuando quizá tengas menos ganas.',
    closing: 'Cada día vas a saber un poquito más que ayer.',
  },
  onboardingTheme: {
    title: 'Elige un estilo',
    sampleWord: 'the car',
    know: 'Lo sé',
    later: 'Después puedes elegir entre 24 en Ajustes.',
    next: 'Continuar',
  },
  tabs: {
    settings: 'Ajustes',
    grammar: 'Gramática',
    stats: 'Estadísticas',
    pcic: 'Aprender',
    practice: 'Práctica',
    sentences: 'Frases',
    comingSoon: 'Próximamente',
  },
  a11y: {
    back: 'Atrás',
    close: 'Cerrar',
    speak: 'Reproducir audio',
    stopSpeaking: 'Detener audio',
    statusBarTint: 'Cambiar el color de la franja superior',
    weeklyGoal: { up: 'Aumentar el objetivo semanal de estudio', down: 'Disminuir el objetivo semanal de estudio' },
    dailyNewLimit: { up: 'Aumentar palabras nuevas al día', down: 'Disminuir palabras nuevas al día' },
    missedWordDelay: {
      up: 'Aumentar la espera antes de que vuelva una palabra fallada',
      down: 'Disminuir la espera antes de que vuelva una palabra fallada',
    },
  },
  header: {
    levelProgress: (known: number, total: number) => `${known} / ${total} palabras`,
  },
  notFound: {
    title: 'Esta página no existe',
    back: 'Volver al inicio',
  },
};

export default es;
