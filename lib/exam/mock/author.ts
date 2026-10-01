// PLAN-vizsga E. szakasz: a próbavizsga szerzői szövegei célnyelven, mint egy valódi papíron.
// A feladat-utasítások rövid, szint-hű mondatok; az írás-feladatokat a régi (4afeb8c^)
// data/exams/mock/{es/a1,es/a2,en/a2}.json hivatalos felépítést követő, kézzel írt írás-részéből
// emeltük át (a tartalmi pontok kulcsszavai változatlanok). Az olvasás és a hallás tartalma
// nem innen jön: azt lib/exam/mock/build.ts építi a szint szavaiból.

import type { MockFormFillTask, MockShortMessageTask, MockTarget } from './types';

export type MockInstructionKind =
  | 'read_mc'
  | 'match'
  | 'true_false'
  | 'gap_mc'
  | 'listen_mc'
  | 'listen_match'
  | 'listen_dialogue';

const INSTRUCTIONS: Record<MockTarget, Record<MockInstructionKind, string>> = {
  es: {
    read_mc: 'Lea los textos y marque la opción correcta.',
    match: 'Lea las frases y relacione cada una con su significado. Hay más significados que frases.',
    true_false: 'Lea el texto y marque si las frases son verdaderas (✓) o falsas (✗).',
    gap_mc: 'Complete las frases. Elija la opción correcta para cada hueco.',
    listen_mc: 'Va a escuchar unas frases. Se escuchan dos veces. Marque la opción correcta.',
    listen_match: 'Va a escuchar unas frases. Relacione cada una con su significado. Hay más significados que frases.',
    listen_dialogue: 'Va a escuchar una conversación. Se escucha dos veces. Conteste a las preguntas.',
  },
  en: {
    read_mc: 'Read the texts and choose the correct option.',
    match: 'Read the sentences and match each one with its meaning. There are more meanings than sentences.',
    true_false: 'Read the text. Are the sentences right (✓) or wrong (✗)?',
    gap_mc: 'Complete the sentences. Choose the correct word for each gap.',
    listen_mc: 'You will hear some sentences. You hear them twice. Choose the correct option.',
    listen_match: 'You will hear some sentences. Match each one with its meaning. There are more meanings than sentences.',
    listen_dialogue: 'You will hear a conversation. You hear it twice. Answer the questions.',
  },
};

/** A feladat sorszáma a papíron: spanyolul "TAREA 2.", angolul "PART 2.". */
export function mockInstruction(target: MockTarget, kind: MockInstructionKind, taskNumber: number): string {
  return `${target === 'es' ? 'TAREA' : 'PART'} ${taskNumber}. ${INSTRUCTIONS[target][kind]}`;
}

type WritingTask = Omit<MockFormFillTask, 'id'> | Omit<MockShortMessageTask, 'id'>;

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
  'en:A2': [
    {
      kind: 'short_message',
      instruction: 'PART 1. Write an email of 50 to 60 words.',
      prompt: 'A friend has invited you to a party on Saturday, but you cannot go. Write an email: thank your friend for the invitation, explain why you cannot come, say what you did last weekend, and suggest another day to meet.',
      minWords: 45,
      points: [
        { id: 'thanks', label: 'Thanks for the invitation', keywords: ['thank', 'thanks'] },
        { id: 'reason', label: 'Explains why not', keywords: ['cannot', 'can\'t', 'because', 'have to', 'sorry'] },
        { id: 'past', label: 'Says something about the past', keywords: ['went', 'was', 'were', 'had', 'worked', 'visited', 'stayed'] },
        { id: 'propose', label: 'Suggests another day', keywords: ['next', 'how about', 'shall we', 'meet', 'another day'] },
      ],
    },
    {
      kind: 'short_message',
      instruction: 'PART 2. Write a text of 60 to 80 words.',
      prompt: 'Write about a trip or a special day last year: where you went, who with, what you did there, what you liked most and what you did not like.',
      minWords: 55,
      points: [
        { id: 'where', label: 'Says where', keywords: ['i went to', 'i was in', 'we visited', 'we travelled', 'we traveled'] },
        { id: 'who', label: 'Says who with', keywords: ['with my', 'with a', 'alone', 'with some'] },
        { id: 'what', label: 'Says what they did', keywords: ['we saw', 'we ate', 'we walked', 'we visited', 'we went'] },
        { id: 'opinion', label: 'Says what they liked and did not like', keywords: ['i liked', 'i did not like', 'didn\'t like', 'the best', 'the worst'] },
      ],
    },
  ],
};
