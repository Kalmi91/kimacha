// The authored A1 reading material of the Spanish practice exam (lib/exam/mock/build.ts, plan es-official, level A1):
// short texts of several sentences with a comprehension question (question and answers in Spanish: the answer is not the
// translation of one sentence), and short signs / notes with the Spanish sentence that explains each. All original,
// Mexican norm, neutral content. The builder picks some by the seed; the right answer's position is shuffled there.

export interface A1ReadingText {
  id: string;
  text: string;
  question: string;
  correct: string;
  /** Two wrong answers; each one is built from words that are in the text, so a word search does not find the answer. */
  wrong: [string, string];
}

export interface A1ReadingSign {
  id: string;
  /** The sign or note (what is read). */
  sign: string;
  /** What it means, in Spanish (one of the match options). */
  meaning: string;
}

export const ES_A1_READING_TEXTS: A1ReadingText[] = [
  {
    id: 'ana-semana',
    text: 'Ana vive en Guadalajara con su hermano. Él trabaja en un banco y ella estudia inglés por las tardes. Los sábados van al mercado y compran frutas.',
    question: '¿Qué hace Ana por las tardes?',
    correct: 'Estudia inglés.',
    wrong: ['Trabaja en un banco.', 'Compra frutas en el mercado.'],
  },
  {
    id: 'mensaje-mario',
    text: 'Hola, Pedro: mañana no tengo clase, así que voy a casa de mi abuela. Ella cocina muy bien. Llego a las dos de la tarde y regreso a mi casa a las ocho de la noche. ¿Quieres venir? Mario',
    question: '¿A qué hora regresa Mario a su casa?',
    correct: 'A las ocho de la noche.',
    wrong: ['A las dos de la tarde.', 'A las ocho de la mañana.'],
  },
  {
    id: 'cafe-luna',
    text: 'El Café Luna abre de lunes a viernes, de las ocho de la mañana a las seis de la tarde. Los sábados abre solo hasta las dos. Los domingos está cerrado. El café con leche cuesta treinta y cinco pesos.',
    question: '¿Cuándo está cerrado el café?',
    correct: 'Los domingos.',
    wrong: ['Los sábados.', 'Los lunes.'],
  },
  {
    id: 'casa-gato',
    text: 'Mi casa es pequeña, pero me gusta mucho. Tiene dos cuartos, una cocina y un baño. Delante de la casa hay un jardín con flores rojas. Mi gato duerme siempre en el sofá.',
    question: '¿Dónde duerme el gato?',
    correct: 'En el sofá.',
    wrong: ['En el jardín.', 'En la cocina.'],
  },
  {
    id: 'cumple-sofia',
    text: 'Hoy es el cumpleaños de Sofía. Tiene diez años. Su mamá hace un pastel de chocolate y sus amigos llegan a las cinco con regalos. Después de comer pastel, juegan en el patio.',
    question: '¿Qué hacen los amigos después de comer pastel?',
    correct: 'Juegan en el patio.',
    wrong: ['Hacen un pastel de chocolate.', 'Llegan con regalos.'],
  },
  {
    id: 'aviso-autobus',
    text: 'Aviso: el autobús número doce sale de la estación a las siete y cuarto y llega a la universidad a las siete cincuenta. Si no tiene boleto, puede comprarlo con el conductor. El boleto cuesta diez pesos.',
    question: '¿Cuánto cuesta el boleto?',
    correct: 'Diez pesos.',
    wrong: ['Doce pesos.', 'Cincuenta pesos.'],
  },
];

export const ES_A1_READING_SIGNS: A1ReadingSign[] = [
  { id: 'vacaciones', sign: 'Cerrado por vacaciones del 1 al 15 de agosto.', meaning: 'La tienda no abre en estas fechas.' },
  { id: 'fotos', sign: 'Prohibido tomar fotos.', meaning: 'Aquí no se puede sacar fotografías.' },
  { id: 'bicicleta', sign: 'Se vende bicicleta casi nueva, 800 pesos.', meaning: 'Una persona quiere vender su bicicleta.' },
  { id: 'piso', sign: 'Piso mojado.', meaning: 'Hay que caminar con cuidado.' },
  { id: 'empuje', sign: 'Empuje.', meaning: 'Para abrir la puerta, hay que empujarla.' },
  { id: 'menu', sign: 'Hoy: sopa, pollo y arroz por 70 pesos.', meaning: 'Es el menú del día de un restaurante.' },
  { id: 'silencio', sign: 'Silencio, por favor. Hay examen.', meaning: 'No se debe hacer ruido.' },
  { id: 'ninos', sign: 'Los niños menores de cinco años entran gratis.', meaning: 'Un niño pequeño no paga la entrada.' },
];

/** A text with Spanish statements, each decidable from the text: true / false marking (the builder takes 2 true and 2 false). */
export interface A1TrueFalseText {
  id: string;
  text: string;
  /** At least two true and two false statements. */
  statements: { s: string; answer: boolean }[];
}

export const ES_A1_TRUE_FALSE_TEXTS: A1TrueFalseText[] = [
  {
    id: 'biblioteca',
    text: 'La biblioteca de mi barrio abre a las nueve de la mañana. Tiene muchos libros para niños y una sala con mesas grandes. Los jueves hay una hora de cuentos para los más pequeños. La entrada es gratis.',
    statements: [
      { s: 'La biblioteca abre por la mañana.', answer: true },
      { s: 'Hay una hora de cuentos los jueves.', answer: true },
      { s: 'Para entrar hay que pagar.', answer: false },
      { s: 'En la biblioteca no hay libros para niños.', answer: false },
      { s: 'La sala tiene mesas grandes.', answer: true },
    ],
  },
  {
    id: 'viaje-playa',
    text: 'Este fin de semana vamos a la playa con mis primos. Salimos el sábado a las seis de la mañana en autobús. El viaje dura cuatro horas. Llevamos sándwiches, agua y una sombrilla.',
    statements: [
      { s: 'Van a la playa con sus primos.', answer: true },
      { s: 'Salen el domingo.', answer: false },
      { s: 'Viajan en autobús.', answer: true },
      { s: 'El viaje dura una hora.', answer: false },
      { s: 'Llevan agua y sándwiches.', answer: true },
    ],
  },
  {
    id: 'clase-musica',
    text: 'Lucía tiene clase de guitarra los martes y los viernes. La clase empieza a las cinco y termina a las seis. Su maestro se llama Rafael y es muy simpático. Lucía practica en casa todos los días.',
    statements: [
      { s: 'Lucía tiene clase dos veces por semana.', answer: true },
      { s: 'La clase termina a las cinco.', answer: false },
      { s: 'Su maestro es simpático.', answer: true },
      { s: 'Lucía solo toca la guitarra en la clase.', answer: false },
      { s: 'Rafael es el maestro de Lucía.', answer: true },
    ],
  },
  {
    id: 'tienda-ropa',
    text: 'En la tienda de la esquina venden ropa para toda la familia. Esta semana las camisas cuestan doscientos pesos y los zapatos tienen descuento. La tienda está abierta de diez a ocho, todos los días menos el domingo.',
    statements: [
      { s: 'En la tienda venden ropa.', answer: true },
      { s: 'La tienda abre los domingos.', answer: false },
      { s: 'Los zapatos tienen descuento esta semana.', answer: true },
      { s: 'Las camisas cuestan veinte pesos.', answer: false },
      { s: 'La tienda cierra a las ocho.', answer: true },
    ],
  },
];
