// PLAN-vizsga E. szakasz: a próbavizsga szerzői szövegei célnyelven, mint egy valódi papíron.
// A feladat-utasítások rövid, szint-hű mondatok; az írás-feladatokat a régi (4afeb8c^)
// data/exams/mock/{es/a1,es/a2}.json hivatalos felépítést követő, kézzel írt írás-részéből emeltük át
// (a tartalmi pontok kulcsszavai változatlanok); az angol írás-feladatok újak, a Kimacha angol
// vizsga-kutatásának két szintjéhez írva. Az olvasás
// és a hallás tartalma nem innen jön: azt lib/exam/mock/build.ts építi a szint szavaiból.

import { DEFAULT_PLAYS, type MockFormFillTask, type MockShortMessageTask, type MockTarget } from './types';

export type MockInstructionKind =
  | 'read_mc'
  | 'match'
  | 'true_false'
  | 'gap_mc'
  | 'gap_type'
  | 'listen_mc'
  | 'listen_match'
  | 'listen_dialogue'
  | 'listen_fill'
  | 'dictation';

// A {times} helyére a lejátszások száma kerül szóban (egyszer / kétszer).
const INSTRUCTIONS: Record<MockTarget, Record<MockInstructionKind, string>> = {
  es: {
    read_mc: 'Lea los textos y marque la opción correcta.',
    match: 'Lea las frases y relacione cada una con su significado. Hay más significados que frases.',
    true_false: 'Lea el texto y marque si las frases son verdaderas (✓) o falsas (✗).',
    gap_mc: 'Complete las frases. Elija la opción correcta para cada hueco.',
    gap_type: 'Complete las frases con una palabra.',
    listen_mc: 'Va a escuchar unas frases. Se escuchan {times}. Marque la opción correcta.',
    listen_match: 'Va a escuchar unas frases. Relacione cada una con su significado. Hay más significados que frases.',
    listen_dialogue: 'Va a escuchar una conversación. Se escucha {times}. Conteste a las preguntas.',
    listen_fill: 'Va a escuchar unas frases. Se escuchan {times}. Escriba la palabra que falta.',
    dictation: 'Va a escuchar un texto. Se escucha {times}. Escríbalo tal como lo oye.',
  },
  en: {
    read_mc: 'Read the texts and choose the correct option.',
    match: 'Read the sentences and match each one with its meaning. There are more meanings than sentences.',
    true_false: 'Read the text. Are the sentences right (✓) or wrong (✗)?',
    gap_mc: 'Complete the sentences. Choose the correct word for each gap.',
    gap_type: 'Complete the sentences with one word.',
    listen_mc: 'You will hear some sentences. You hear them {times}. Choose the correct option.',
    listen_match: 'You will hear some sentences. Match each one with its meaning. There are more meanings than sentences.',
    listen_dialogue: 'You will hear a conversation. You hear it {times}. Answer the questions.',
    listen_fill: 'You will hear some sentences. You hear them {times}. Write the missing word.',
    dictation: 'You will hear a text. You hear it {times}. Write it down exactly as you hear it.',
  },
};

const TIMES: Record<MockTarget, Record<number, string>> = {
  es: { 1: 'una vez', 2: 'dos veces' },
  en: { 1: 'once', 2: 'twice' },
};

/** A feladat sorszáma a papíron: spanyolul "TAREA 2.", angolul "PART 2."; a felvételes feladatban a lejátszások száma. */
export function mockInstruction(target: MockTarget, kind: MockInstructionKind, taskNumber: number, plays: number = DEFAULT_PLAYS): string {
  const text = INSTRUCTIONS[target][kind].replace('{times}', TIMES[target][plays] ?? TIMES[target][DEFAULT_PLAYS]);
  return `${target === 'es' ? 'TAREA' : 'PART'} ${taskNumber}. ${text}`;
}

type WritingTask = Omit<MockFormFillTask, 'id' | 'skill'> | Omit<MockShortMessageTask, 'id' | 'skill'>;

/** Az írás-papír feladatai (kulcs: `<irány>:<szint>`). */
export const MOCK_WRITING: Record<string, WritingTask[]> = {
  'es:A1': [
    {
      kind: 'form_fill',
      instruction: 'TAREA 1. Complete el formulario con sus datos.',
      context: 'Usted quiere apuntarse a un curso de español en una escuela de la Ciudad de México. Complete la ficha de inscripción.',
      fields: [
        { id: 'nombre', label: 'Nombre y apellidos', type: 'text', check: 'fullname' },
        { id: 'edad', label: 'Edad', type: 'number', check: 'age' },
        { id: 'nacionalidad', label: 'Nacionalidad', type: 'text', check: 'word' },
        { id: 'direccion', label: 'Dirección (calle y número)', type: 'text', check: 'address' },
        { id: 'telefono', label: 'Teléfono', type: 'number', check: 'phone' },
        { id: 'correo', label: 'Correo electrónico', type: 'text', check: 'email' },
        { id: 'nivel', label: '¿Qué nivel estudia? (A1, A2...)', type: 'text', check: 'level' },
      ],
    },
    {
      kind: 'short_message',
      instruction: 'TAREA 2. Escriba un texto de 30 a 40 palabras.',
      prompt: 'Un amigo mexicano quiere conocerlo. Escríbale un mensaje y diga: cómo se llama y de dónde es; dónde vive ahora; qué hace los fines de semana; y pregúntele algo a él.',
      minWords: 30,
      points: [
        { id: 'name', label: 'Dice su nombre o de dónde es', keywords: ['me llamo', 'soy de', 'mi nombre'] },
        { id: 'live', label: 'Dice dónde vive', keywords: ['vivo', 'vivo en'] },
        { id: 'weekend', label: 'Habla del fin de semana', keywords: ['fin de semana', 'fines de semana', 'sábado', 'domingo'] },
        { id: 'question', label: 'Hace una pregunta', keywords: ['?', '¿'] },
      ],
    },
  ],
  'es:A2': [
    {
      kind: 'short_message',
      instruction: 'TAREA 1. Escriba un correo de 60 a 70 palabras.',
      prompt: 'Un amigo le invitó a una fiesta el sábado, pero usted no puede ir. Escríbale un correo: dele las gracias por la invitación, explique por qué no puede ir, diga qué hizo el fin de semana pasado y propóngale otro día para verse.',
      minWords: 55,
      points: [
        { id: 'thanks', label: 'Da las gracias por la invitación', keywords: ['gracias', 'te agradezco'] },
        { id: 'reason', label: 'Explica por qué no puede ir', keywords: ['no puedo', 'porque', 'tengo que'] },
        { id: 'past', label: 'Cuenta algo en pasado', keywords: ['fui', 'estuve', 'hice', 'comí', 'trabajé', 'salí', 'pasé'] },
        { id: 'propose', label: 'Propone otro día', keywords: ['podemos', 'qué te parece', 'nos vemos', 'quedamos', 'próxim'] },
      ],
    },
    {
      kind: 'short_message',
      instruction: 'TAREA 2. Escriba un texto de 70 a 80 palabras.',
      prompt: 'Escriba sobre un viaje o un día especial del año pasado: adónde fue, con quién, qué hizo allí, qué le gustó más y qué no le gustó.',
      minWords: 65,
      points: [
        { id: 'where', label: 'Dice adónde fue', keywords: ['fui a', 'estuve en', 'viajé a', 'visité'] },
        { id: 'who', label: 'Dice con quién', keywords: ['con mi', 'con mis', 'con un', 'con una', 'solo', 'sola'] },
        { id: 'what', label: 'Cuenta qué hizo', keywords: ['visitamos', 'comimos', 'vimos', 'fuimos', 'hicimos', 'caminamos'] },
        { id: 'opinion', label: 'Dice qué le gustó y qué no', keywords: ['me gustó', 'no me gustó', 'lo mejor', 'lo peor'] },
      ],
    },
  ],
  // Angol A1: két rövid szöveg (a nemzetközi minta 30-50 és 50-80 szavas írásának kicsinyített, kép nélküli változata).
  'en:A1': [
    {
      kind: 'short_message',
      instruction: 'PART 1. Write a short message of 24 words or more.',
      prompt: 'An English friend wants to get to know you. Write a message: say your name and where you are from, where you live now, what you do at the weekend, and ask your friend a question.',
      minWords: 24,
      points: [
        { id: 'name', label: 'Gives a name or where they are from', keywords: ['my name is', 'i am', "i'm", 'i come from'] },
        { id: 'live', label: 'Says where they live', keywords: ['i live', 'live in'] },
        { id: 'weekend', label: 'Talks about the weekend', keywords: ['weekend', 'saturday', 'sunday'] },
        { id: 'question', label: 'Asks a question', keywords: ['?'] },
      ],
    },
    {
      kind: 'short_message',
      instruction: 'PART 2. Write a text of 30 words or more.',
      prompt: 'Write about your home and your day. Say where you live, who lives with you, when you get up and what you like to do after work or school.',
      minWords: 30,
      points: [
        { id: 'home', label: 'Says where they live', keywords: ['i live', 'my house', 'my flat', 'my home', 'my apartment'] },
        { id: 'people', label: 'Says who lives with them', keywords: ['my mother', 'my father', 'my wife', 'my husband', 'my family', 'my friend', 'with my', 'alone'] },
        { id: 'time', label: 'Says when they get up', keywords: ['get up', 'wake up', "o'clock", 'in the morning', 'every day'] },
        { id: 'like', label: 'Says what they like to do', keywords: ['i like', 'i love', 'i enjoy', 'my favourite', 'my favorite'] },
      ],
    },
  ],
  // Angol A2: irányított üzenet (legalább 25 szó, minden pontra válasz) és történet (legalább 35 szó).
  'en:A2': [
    {
      kind: 'short_message',
      instruction: 'PART 1. Write an email of 25 words or more.',
      prompt: 'A friend has invited you to a party on Saturday, but you cannot go. Write an email: thank your friend for the invitation, explain why you cannot come, say what you did last weekend, and suggest another day to meet.',
      minWords: 25,
      points: [
        { id: 'thanks', label: 'Thanks for the invitation', keywords: ['thank', 'thanks'] },
        { id: 'reason', label: 'Explains why not', keywords: ['cannot', "can't", 'because', 'have to', 'sorry'] },
        { id: 'past', label: 'Says something about the past', keywords: ['went', 'was', 'were', 'had', 'worked', 'visited', 'stayed'] },
        { id: 'propose', label: 'Suggests another day', keywords: ['next', 'how about', 'shall we', 'meet', 'another day'] },
      ],
    },
    {
      kind: 'short_message',
      instruction: 'PART 2. Write a story of 35 words or more.',
      prompt: 'Write a short story about a day out: where you went, who was with you, what happened and how you felt at the end of the day.',
      minWords: 35,
      points: [
        { id: 'where', label: 'Says where they went', keywords: ['i went to', 'i was in', 'we visited', 'we travelled', 'we traveled', 'we went'] },
        { id: 'who', label: 'Says who was with them', keywords: ['with my', 'with a', 'alone', 'with some'] },
        { id: 'what', label: 'Says what happened', keywords: ['we saw', 'we ate', 'we walked', 'then', 'after that', 'we played'] },
        { id: 'feeling', label: 'Says how they felt', keywords: ['i felt', 'i was happy', 'i was tired', 'we had fun', 'i liked', 'it was great'] },
      ],
    },
  ],
};
