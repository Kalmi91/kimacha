// The authored A1 listening material of the Spanish practice exam (lib/exam/mock/build.ts, plan es-official, level A1):
// ONE coherent text per task (an announcement, a voice message, someone telling their day; or a conversation between two people)
// with Spanish comprehension questions that follow the order of the text, not unrelated sentences with a translation each.
// All original, Mexican norm, neutral content, present tense and `ir a` + infinitive. The builder picks one text by the seed and
// shuffles the answer positions there. In a conversation the lines alternate between the two speakers (the card reads the even
// lines with one voice and the odd ones with the other), so a line carries no speaker name.

export interface A1ListeningQuestion {
  /** The question, in Spanish. */
  question: string;
  /** The right answer, in Spanish. */
  correct: string;
  /** Two wrong answers, in Spanish; built from words that are heard in the text, so a word search does not find the answer. */
  wrong: [string, string];
  /** Index of the line in `lines` that holds the answer. */
  line: number;
}

export interface A1ListeningText {
  id: string;
  /** What is read aloud, in order; together ONE coherent text. */
  lines: string[];
  questions: A1ListeningQuestion[];
}

/** Short monologues: an announcement, a voice message, someone telling their day. */
export const ES_A1_LISTENING_TEXTS: A1ListeningText[] = [
  {
    id: 'aviso-biblioteca',
    lines: [
      'Atención, por favor. Este es un aviso de la biblioteca.',
      'Hoy la biblioteca abre a las nueve de la mañana y cierra a las cinco de la tarde.',
      'Mañana vamos a cerrar a la una porque hay una reunión.',
      'Si quiere llevar un libro a su casa, necesita su credencial.',
      'Puede llevar tres libros por dos semanas.',
      'Gracias por su visita.',
    ],
    questions: [
      { question: '¿A qué hora cierra hoy la biblioteca?', correct: 'A las cinco de la tarde.', wrong: ['A las nueve de la mañana.', 'A la una de la tarde.'], line: 1 },
      { question: '¿Qué pasa mañana?', correct: 'La biblioteca cierra a la una.', wrong: ['La biblioteca abre a la una.', 'La biblioteca cierra a las cinco.'], line: 2 },
      { question: '¿Qué necesita para llevar un libro a su casa?', correct: 'Necesita su credencial.', wrong: ['Necesita tres libros.', 'Necesita dos semanas.'], line: 3 },
      { question: '¿Cuántos libros puede llevar?', correct: 'Tres libros.', wrong: ['Dos libros.', 'Cinco libros.'], line: 4 },
      { question: '¿Por cuánto tiempo puede tener los libros?', correct: 'Por dos semanas.', wrong: ['Por tres semanas.', 'Por una semana.'], line: 4 },
    ],
  },
  {
    id: 'mensaje-carmen',
    lines: [
      'Hola, Luis, soy Carmen.',
      'Te llamo porque mañana voy a ir al cine con mi hermana.',
      'La película empieza a las siete de la noche.',
      'Primero vamos a comer unos tacos cerca del cine.',
      '¿Quieres venir con nosotras?',
      'Llámame antes de las cinco, por favor.',
    ],
    questions: [
      { question: '¿Con quién va Carmen al cine mañana?', correct: 'Con su hermana.', wrong: ['Con Luis.', 'Sola.'], line: 1 },
      { question: '¿A qué hora empieza la película?', correct: 'A las siete de la noche.', wrong: ['A las cinco de la noche.', 'A las siete de la mañana.'], line: 2 },
      { question: '¿Dónde van a comer los tacos?', correct: 'Cerca del cine.', wrong: ['En el cine.', 'Con su hermana.'], line: 3 },
      { question: '¿Qué le pregunta Carmen a Luis?', correct: 'Si quiere ir con ellas.', wrong: ['Si quiere llamar a Carmen.', 'Si quiere ir al cine solo.'], line: 4 },
      { question: '¿Cuándo debe llamar Luis a Carmen?', correct: 'Antes de las cinco.', wrong: ['Después de las cinco.', 'Después de las siete.'], line: 5 },
    ],
  },
  {
    id: 'dia-pablo',
    lines: [
      'Me llamo Pablo y trabajo en una tienda de ropa.',
      'Me levanto a las seis y media de la mañana.',
      'Desayuno en mi casa y voy al trabajo en autobús.',
      'Trabajo de nueve a cinco y como con mis compañeros.',
      'Por la tarde voy al parque con mi perro.',
      'En la noche veo la televisión y me acuesto a las diez.',
    ],
    questions: [
      { question: '¿Dónde trabaja Pablo?', correct: 'En una tienda de ropa.', wrong: ['En un parque.', 'En un autobús.'], line: 0 },
      { question: '¿A qué hora se levanta Pablo?', correct: 'A las seis y media.', wrong: ['A las nueve y media.', 'A las diez y media.'], line: 1 },
      { question: '¿Cómo va Pablo al trabajo?', correct: 'En autobús.', wrong: ['Con su perro.', 'Con sus compañeros.'], line: 2 },
      { question: '¿Adónde va Pablo con su perro?', correct: 'Al parque.', wrong: ['A la tienda.', 'Al trabajo.'], line: 4 },
      { question: '¿Qué hace Pablo en la noche?', correct: 'Ve la televisión.', wrong: ['Va al parque.', 'Trabaja en una tienda.'], line: 5 },
      { question: '¿A qué hora se acuesta Pablo?', correct: 'A las diez.', wrong: ['A las seis.', 'A las cinco.'], line: 5 },
    ],
  },
  {
    id: 'aviso-estacion',
    lines: [
      'Atención, señores pasajeros.',
      'El autobús a Puebla sale a las ocho y cuarto de la mañana.',
      'Hoy sale de la puerta número tres.',
      'El boleto cuesta ciento cincuenta pesos.',
      'Los niños pequeños no pagan.',
      'Por favor, lleguen diez minutos antes.',
    ],
    questions: [
      { question: '¿A qué hora sale el autobús?', correct: 'A las ocho y cuarto.', wrong: ['A las diez y cuarto.', 'A las tres y cuarto.'], line: 1 },
      { question: '¿De qué puerta sale el autobús?', correct: 'De la puerta tres.', wrong: ['De la puerta ocho.', 'De la puerta diez.'], line: 2 },
      { question: '¿Cuánto cuesta el boleto?', correct: 'Ciento cincuenta pesos.', wrong: ['Cincuenta pesos.', 'Diez pesos.'], line: 3 },
      { question: '¿Quién no paga?', correct: 'Los niños pequeños.', wrong: ['Los pasajeros.', 'Los señores.'], line: 4 },
      { question: '¿Cuándo deben llegar los pasajeros?', correct: 'Diez minutos antes.', wrong: ['Diez minutos después.', 'Tres minutos antes.'], line: 5 },
    ],
  },
];

/** Conversations between two people: the lines alternate, the even lines are one speaker and the odd lines the other. */
export const ES_A1_LISTENING_DIALOGUES: A1ListeningText[] = [
  {
    id: 'mercado-fruta',
    lines: [
      'Buenas tardes. ¿Qué desea?',
      'Buenas tardes. Quiero un kilo de manzanas, por favor.',
      'Muy bien. ¿Algo más?',
      'Sí, también dos mangos. ¿Cuánto es todo?',
      'Las manzanas cuestan treinta pesos y los mangos veinte. Son cincuenta pesos.',
      'Aquí tiene. Gracias.',
      'De nada. Que tenga buen día.',
    ],
    questions: [
      { question: '¿Qué quiere comprar la persona primero?', correct: 'Un kilo de manzanas.', wrong: ['Dos mangos.', 'Un kilo de mangos.'], line: 1 },
      { question: '¿Cuántos mangos compra?', correct: 'Dos mangos.', wrong: ['Un mango.', 'Veinte mangos.'], line: 3 },
      { question: '¿Cuánto cuestan las manzanas?', correct: 'Treinta pesos.', wrong: ['Veinte pesos.', 'Cincuenta pesos.'], line: 4 },
      { question: '¿Cuánto paga en total?', correct: 'Cincuenta pesos.', wrong: ['Treinta pesos.', 'Veinte pesos.'], line: 4 },
    ],
  },
  {
    id: 'amigos-sabado',
    lines: [
      'Hola, Sofía. ¿Qué vas a hacer el sábado?',
      'Voy a visitar a mis abuelos. Ellos viven en Querétaro.',
      '¡Qué bien! ¿Cómo vas a viajar?',
      'Voy en autobús. Salgo a las ocho de la mañana.',
      'Yo no voy a salir. Voy a jugar futbol con mis amigos en el parque.',
      '¡Qué divertido! ¿A qué hora juegan?',
      'A las cuatro de la tarde. Nos vemos el domingo.',
    ],
    questions: [
      { question: '¿A quién va a visitar Sofía?', correct: 'A sus abuelos.', wrong: ['A sus amigos.', 'A Miguel.'], line: 1 },
      { question: '¿A qué hora sale Sofía?', correct: 'A las ocho de la mañana.', wrong: ['A las cuatro de la mañana.', 'A las ocho de la tarde.'], line: 3 },
      { question: '¿Qué va a hacer Miguel el sábado?', correct: 'Va a jugar futbol.', wrong: ['Va a visitar a sus abuelos.', 'Va a viajar en autobús.'], line: 4 },
      { question: '¿A qué hora juegan?', correct: 'A las cuatro de la tarde.', wrong: ['A las ocho de la mañana.', 'A las cuatro de la mañana.'], line: 6 },
    ],
  },
  {
    id: 'hotel-cuarto',
    lines: [
      'Buenas tardes. Habla el hotel. ¿En qué le puedo ayudar?',
      'Quiero un cuarto para dos personas, por favor.',
      '¿Para qué días?',
      'Para el viernes y el sábado.',
      'Tenemos un cuarto con baño por mil doscientos pesos la noche.',
      'Está bien. ¿El desayuno está incluido?',
      'Sí, el desayuno es de siete a diez de la mañana.',
    ],
    questions: [
      { question: '¿Para cuántas personas es el cuarto?', correct: 'Para dos personas.', wrong: ['Para una persona.', 'Para tres personas.'], line: 1 },
      { question: '¿Para qué días quiere el cuarto?', correct: 'El viernes y el sábado.', wrong: ['El sábado y el domingo.', 'El jueves y el viernes.'], line: 3 },
      { question: '¿Cuánto cuesta el cuarto?', correct: 'Mil doscientos pesos la noche.', wrong: ['Mil pesos la noche.', 'Doscientos pesos la noche.'], line: 4 },
      { question: '¿Hasta qué hora es el desayuno?', correct: 'Hasta las diez de la mañana.', wrong: ['Hasta las siete de la mañana.', 'Hasta las diez de la noche.'], line: 6 },
    ],
  },
  {
    id: 'cafe-mesa',
    lines: [
      'Hola, buenas tardes. ¿Qué quiere tomar?',
      'Un café con leche y un pan dulce, por favor.',
      'Lo siento, hoy no hay pan dulce. Hay galletas.',
      'Está bien. Una galleta, por favor.',
      'Son cuarenta pesos. ¿Para tomar aquí o para llevar?',
      'Para tomar aquí. ¿Dónde puedo sentarme?',
      'Hay una mesa libre junto a la ventana.',
    ],
    questions: [
      { question: '¿Qué pide la persona para tomar?', correct: 'Un café con leche.', wrong: ['Un pan dulce.', 'Una galleta.'], line: 1 },
      { question: '¿Qué no hay hoy?', correct: 'Pan dulce.', wrong: ['Galletas.', 'Café con leche.'], line: 2 },
      { question: '¿Cuánto cuesta todo?', correct: 'Cuarenta pesos.', wrong: ['Catorce pesos.', 'Cuatrocientos pesos.'], line: 4 },
      { question: '¿Dónde hay una mesa libre?', correct: 'Junto a la ventana.', wrong: ['Junto a la puerta.', 'Junto al café.'], line: 6 },
    ],
  },
];
