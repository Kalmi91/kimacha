// Generated exam tasks: what a paper falls back to when a language/level has no
// authored task file yet. They are built from material the app already owns and
// already audits (the corpus sentences, the placement gap questions and the
// story scenes), so a learner on any branch still gets a real exam shape
// instead of an empty paper.
//
// The instructions are in the TARGET language, as in a real exam paper, hence
// the small per-language string table; everything else is data-driven.

import { getExamQuestionsFor, type GapQuestion } from '@/data/exams';
import { getWordsForLevel, type Level, type WordEntry } from '@/data/words';
import { getStories } from '@/lib/games/content';
import { hashString, mulberry32, shuffleArray } from '@/lib/shuffle';
import type { ExamGapMcTask, ExamListenTask, ExamShortMessageTask, ExamSpeakingTask, ExamTextMcTask, ExamFormFillTask } from './types';

interface GeneratedStrings {
  gapInstruction: string;
  listenInstruction: string;
  listenQuestion: string;
  readInstruction: string;
  formInstruction: string;
  formContext: string;
  formFields: { id: string; label: string; type: 'text' | 'number' }[];
  messageInstruction: string;
  messagePrompt: string;
  messagePoints: { id: string; label: string; keywords: string[] }[];
  speakInstruction: string;
  speakPrompts: {
    prompt: string;
    model: string;
    minWords: number;
    points: { id: string; label: string; keywords: string[] }[];
  }[];
}

const STRINGS: Record<string, GeneratedStrings> = {
  es: {
    gapInstruction: 'Complete las frases. Elija la opción correcta.',
    listenInstruction: 'Va a escuchar cinco frases. Cada frase se repite dos veces. Elija la opción correcta.',
    listenQuestion: '¿Qué ha escuchado?',
    readInstruction: 'Lea el texto y conteste a las preguntas.',
    formInstruction: 'Complete el formulario con sus datos.',
    formContext: 'Usted quiere apuntarse a un curso de español. Complete el formulario.',
    formFields: [
      { id: 'nombre', label: 'Nombre y apellidos', type: 'text' },
      { id: 'edad', label: 'Edad', type: 'number' },
      { id: 'ciudad', label: 'Ciudad', type: 'text' },
      { id: 'telefono', label: 'Teléfono', type: 'number' },
      { id: 'correo', label: 'Correo electrónico', type: 'text' },
    ],
    messageInstruction: 'Escriba un mensaje corto.',
    messagePrompt: 'Escriba un mensaje a un amigo nuevo. Diga cómo se llama, dónde vive y qué hace los fines de semana.',
    messagePoints: [
      { id: 'name', label: 'Dice su nombre', keywords: ['me llamo', 'soy', 'mi nombre'] },
      { id: 'city', label: 'Dice dónde vive', keywords: ['vivo', 'vivo en'] },
      { id: 'weekend', label: 'Dice qué hace el fin de semana', keywords: ['fin de semana', 'sábado', 'domingo'] },
    ],
    speakInstruction: 'Hable en voz alta. Después compare su respuesta con el modelo.',
    speakPrompts: [
      {
        prompt: 'Preséntese: nombre, edad, país, trabajo o estudios.',
        model: 'Me llamo Ana. Tengo treinta años. Soy de Hungría y ahora vivo en México. Trabajo en una oficina.',
        minWords: 25,
        points: [
          { id: 'nombre', label: 'Dice cómo se llama', keywords: ['me llamo', 'mi nombre'] },
          { id: 'edad', label: 'Dice su edad', keywords: ['años', 'edad'] },
          { id: 'pais', label: 'Dice de dónde es', keywords: ['soy de', 'vivo en', 'nacionalidad'] },
          { id: 'trabajo', label: 'Dice qué hace', keywords: ['trabajo', 'estudio', 'estudiante'] },
        ],
      },
      {
        prompt: 'Describa su día normal: qué hace por la mañana, por la tarde y por la noche.',
        model: 'Por la mañana desayuno y voy al trabajo. Por la tarde como con mi familia. Por la noche leo un libro.',
        minWords: 25,
        points: [
          { id: 'manana', label: 'Habla de la mañana', keywords: ['por la mañana', 'desayuno', 'me levanto'] },
          { id: 'tarde', label: 'Habla de la tarde', keywords: ['por la tarde', 'como', 'almuerzo'] },
          { id: 'noche', label: 'Habla de la noche', keywords: ['por la noche', 'ceno', 'duermo'] },
        ],
      },
    ],
  },
  en: {
    gapInstruction: 'Complete the sentences. Choose the correct option.',
    listenInstruction: 'You will hear five sentences. Each one is played twice. Choose the correct option.',
    listenQuestion: 'What did you hear?',
    readInstruction: 'Read the text and answer the questions.',
    formInstruction: 'Fill in the form with your details.',
    formContext: 'You want to join an English course. Fill in the form.',
    formFields: [
      { id: 'name', label: 'Full name', type: 'text' },
      { id: 'age', label: 'Age', type: 'number' },
      { id: 'city', label: 'City', type: 'text' },
      { id: 'phone', label: 'Phone number', type: 'number' },
      { id: 'email', label: 'Email', type: 'text' },
    ],
    messageInstruction: 'Write a short message.',
    messagePrompt: 'Write a message to a new friend. Say your name, where you live and what you do at the weekend.',
    messagePoints: [
      { id: 'name', label: 'Says their name', keywords: ['my name is', "i'm", 'i am'] },
      { id: 'city', label: 'Says where they live', keywords: ['i live', 'live in'] },
      { id: 'weekend', label: 'Says what they do at the weekend', keywords: ['weekend', 'saturday', 'sunday'] },
    ],
    speakInstruction: 'Speak out loud, then compare your answer with the model.',
    speakPrompts: [
      {
        prompt: 'Introduce yourself: name, age, country, work or studies.',
        model: 'My name is Ana. I am thirty years old. I am from Hungary and I live in Mexico now. I work in an office.',
        minWords: 25,
        points: [
          { id: 'name', label: 'Says their name', keywords: ['my name is', 'i am called'] },
          { id: 'age', label: 'Says their age', keywords: ['years old', 'age'] },
          { id: 'country', label: 'Says where they are from', keywords: ['i am from', "i'm from", 'i live in'] },
          { id: 'work', label: 'Says what they do', keywords: ['i work', 'i study', 'student'] },
        ],
      },
      {
        prompt: 'Describe your normal day: morning, afternoon and evening.',
        model: 'In the morning I have breakfast and go to work. In the afternoon I eat with my family. In the evening I read a book.',
        minWords: 25,
        points: [
          { id: 'morning', label: 'Talks about the morning', keywords: ['in the morning', 'breakfast', 'get up'] },
          { id: 'afternoon', label: 'Talks about the afternoon', keywords: ['in the afternoon', 'lunch', 'i eat'] },
          { id: 'evening', label: 'Talks about the evening', keywords: ['in the evening', 'at night', 'dinner'] },
        ],
      },
    ],
  },
  de: {
    gapInstruction: 'Ergänzen Sie die Sätze. Wählen Sie die richtige Lösung.',
    listenInstruction: 'Sie hören fünf Sätze. Jeder Satz wird zweimal gespielt. Wählen Sie die richtige Lösung.',
    listenQuestion: 'Was haben Sie gehört?',
    readInstruction: 'Lesen Sie den Text und beantworten Sie die Fragen.',
    formInstruction: 'Füllen Sie das Formular aus.',
    formContext: 'Sie möchten sich für einen Deutschkurs anmelden. Füllen Sie das Formular aus.',
    formFields: [
      { id: 'name', label: 'Vor- und Nachname', type: 'text' },
      { id: 'alter', label: 'Alter', type: 'number' },
      { id: 'stadt', label: 'Wohnort', type: 'text' },
      { id: 'telefon', label: 'Telefonnummer', type: 'number' },
      { id: 'email', label: 'E-Mail', type: 'text' },
    ],
    messageInstruction: 'Schreiben Sie eine kurze Nachricht.',
    messagePrompt: 'Schreiben Sie einer neuen Freundin. Sagen Sie, wie Sie heißen, wo Sie wohnen und was Sie am Wochenende machen.',
    messagePoints: [
      { id: 'name', label: 'Nennt den Namen', keywords: ['ich heiße', 'ich bin', 'mein name'] },
      { id: 'city', label: 'Sagt, wo er/sie wohnt', keywords: ['ich wohne', 'wohne in'] },
      { id: 'weekend', label: 'Sagt, was am Wochenende passiert', keywords: ['wochenende', 'samstag', 'sonntag'] },
    ],
    speakInstruction: 'Sprechen Sie laut, dann vergleichen Sie mit dem Modell.',
    speakPrompts: [
      {
        prompt: 'Stellen Sie sich vor: Name, Alter, Land, Arbeit oder Studium.',
        model: 'Ich heiße Ana. Ich bin dreißig Jahre alt. Ich komme aus Ungarn und wohne jetzt in Mexiko. Ich arbeite in einem Büro.',
        minWords: 25,
        points: [
          { id: 'name', label: 'Sagt den Namen', keywords: ['ich heiße', 'ich heisse', 'mein name'] },
          { id: 'alter', label: 'Sagt das Alter', keywords: ['jahre alt', 'jahre'] },
          { id: 'land', label: 'Sagt, woher er kommt', keywords: ['ich komme aus', 'ich wohne in'] },
          { id: 'arbeit', label: 'Sagt, was er macht', keywords: ['ich arbeite', 'ich studiere', 'student'] },
        ],
      },
      {
        prompt: 'Beschreiben Sie Ihren normalen Tag: morgens, nachmittags und abends.',
        model: 'Morgens frühstücke ich und fahre zur Arbeit. Nachmittags esse ich mit meiner Familie. Abends lese ich ein Buch.',
        minWords: 25,
        points: [
          { id: 'morgens', label: 'Spricht über den Morgen', keywords: ['morgens', 'am morgen', 'frühstück'] },
          { id: 'nachmittags', label: 'Spricht über den Nachmittag', keywords: ['nachmittags', 'am nachmittag', 'mittagessen'] },
          { id: 'abends', label: 'Spricht über den Abend', keywords: ['abends', 'am abend', 'abendessen'] },
        ],
      },
    ],
  },
  hu: {
    gapInstruction: 'Egészítse ki a mondatokat. Válassza ki a helyes megoldást.',
    listenInstruction: 'Öt mondatot fog hallani. Mindegyik kétszer hangzik el. Válassza ki a helyes megoldást.',
    listenQuestion: 'Mit hallott?',
    readInstruction: 'Olvassa el a szöveget, és válaszoljon a kérdésekre.',
    formInstruction: 'Töltse ki az űrlapot.',
    formContext: 'Be szeretne iratkozni egy magyar nyelvtanfolyamra. Töltse ki az űrlapot.',
    formFields: [
      { id: 'nev', label: 'Név', type: 'text' },
      { id: 'kor', label: 'Életkor', type: 'number' },
      { id: 'varos', label: 'Város', type: 'text' },
      { id: 'telefon', label: 'Telefonszám', type: 'number' },
      { id: 'email', label: 'E-mail', type: 'text' },
    ],
    messageInstruction: 'Írjon egy rövid üzenetet.',
    messagePrompt: 'Írjon egy üzenetet egy új ismerősének. Mondja meg, hogy hívják, hol lakik, és mit csinál hétvégén.',
    messagePoints: [
      { id: 'name', label: 'Megmondja a nevét', keywords: ['a nevem', 'vagyok', 'hívnak'] },
      { id: 'city', label: 'Megmondja, hol lakik', keywords: ['lakom', 'élek'] },
      { id: 'weekend', label: 'Megmondja, mit csinál hétvégén', keywords: ['hétvégén', 'szombat', 'vasárnap'] },
    ],
    speakInstruction: 'Mondja el hangosan, aztán hasonlítsa össze a mintával.',
    speakPrompts: [
      {
        prompt: 'Mutatkozzon be: név, életkor, ország, munka vagy tanulás.',
        model: 'A nevem Ana. Harminc éves vagyok. Magyarországról jöttem, most Mexikóban élek. Egy irodában dolgozom.',
        minWords: 25,
        points: [
          { id: 'nev', label: 'Megmondja a nevét', keywords: ['a nevem', 'vagyok', 'hívnak'] },
          { id: 'kor', label: 'Megmondja, hány éves', keywords: ['éves', 'életkor'] },
          { id: 'orszag', label: 'Megmondja, honnan jött', keywords: ['magyar', 'magyarország', 'élek', 'lakom'] },
          { id: 'munka', label: 'Megmondja, mit csinál', keywords: ['dolgozom', 'tanulok', 'diák'] },
        ],
      },
      {
        prompt: 'Mesélje el egy átlagos napját: reggel, délután, este.',
        model: 'Reggel reggelizem és munkába megyek. Délután a családommal ebédelek. Este olvasok egy könyvet.',
        minWords: 25,
        points: [
          { id: 'reggel', label: 'Beszél a reggelről', keywords: ['reggel', 'reggelizem', 'felkelek'] },
          { id: 'delutan', label: 'Beszél a délutánról', keywords: ['délután', 'ebédelek', 'ebéd'] },
          { id: 'este', label: 'Beszél az estéről', keywords: ['este', 'vacsora', 'alszom'] },
        ],
      },
    ],
  },
};

function stringsFor(lang: string): GeneratedStrings {
  return STRINGS[lang] ?? STRINGS.en;
}

/** Sentence-gap task from the placement question bank (level-appropriate). */
export function generatedGapTask(lang: string, level: string, count = 6): ExamGapMcTask | null {
  const questions = getExamQuestionsFor(lang, level).filter((q): q is GapQuestion => q.type === 'gap');
  if (questions.length === 0) return null;
  const picked = shuffleArray(questions, hashString(`gap:${lang}:${level}`)).slice(0, count);
  const s = stringsFor(lang);
  return {
    id: 'gen-gap',
    kind: 'gap_mc',
    instruction: s.gapInstruction,
    // One sentence per line, each with its own gap: the reader sees the whole
    // set at once, as on a printed paper.
    text: picked.map((q) => q.sentence.replace(/_{2,}/g, '___')).join('\n'),
    gaps: picked.map((q) => ({ options: q.options, correct: q.correctIndex })),
  };
}

/** Reading text + questions from an authored story of the same level. */
export function generatedReadingTask(lang: string, level: string): ExamTextMcTask | null {
  const stories = getStories(lang).filter((st) => st.level === level);
  if (stories.length === 0) return null;
  const story = stories[hashString(`read:${lang}:${level}`) % stories.length];
  const scenes = story.scenes.filter((sc) => sc.question).slice(0, 3);
  if (scenes.length === 0) return null;

  const s = stringsFor(lang);
  const text = scenes.map((sc) => sc.text[lang] ?? Object.values(sc.text)[0]).join(' ');
  const questions = scenes.map((sc) => {
    const q = sc.question!;
    const options = q.options.map((opt) => String(opt[lang] ?? Object.values(opt).find((v) => typeof v === 'string') ?? ''));
    const correct = Math.max(0, q.options.findIndex((opt) => opt.correct === true));
    return { q: String(q.prompt[lang] ?? Object.values(q.prompt)[0]), options, correct };
  });

  return {
    id: 'gen-read',
    kind: 'text_mc',
    instruction: s.readInstruction,
    title: String(story.title[lang] ?? Object.values(story.title)[0]),
    text,
    questions,
  };
}

/**
 * Listening task from corpus sentences: the recording is the target-language
 * sentence, the options are its meaning and two same-level decoys, so it tests
 * comprehension rather than spelling.
 */
export function generatedListeningTask(lang: string, nativeLang: string, level: Level, count = 5): ExamListenTask | null {
  const words = getWordsForLevel(level, lang).filter(
    (w) => typeof w[`sentence_${lang}`] === 'string' && typeof w[`sentence_${nativeLang}`] === 'string'
  );
  if (words.length < count + 3) return null;

  const rng = mulberry32(hashString(`listen:${lang}:${level}`));
  const picked = shuffleArray(words, hashString(`listen-pick:${lang}:${level}`)).slice(0, count);
  const s = stringsFor(lang);
  const sentenceOf = (w: WordEntry, code: string) => String(w[`sentence_${code}`] ?? '');

  const audio: string[] = [];
  const questions: ExamListenTask['questions'] = [];
  for (const word of picked) {
    audio.push(sentenceOf(word, lang));
    const decoys = shuffleArray(
      words.filter((w) => w.id !== word.id),
      Math.floor(rng() * 100000)
    )
      .slice(0, 2)
      .map((w) => sentenceOf(w, nativeLang));
    const options = shuffleArray([sentenceOf(word, nativeLang), ...decoys], Math.floor(rng() * 100000));
    questions.push({ q: s.listenQuestion, options, correct: options.indexOf(sentenceOf(word, nativeLang)) });
  }

  return { id: 'gen-listen', kind: 'listen_mc', instruction: s.listenInstruction, audio, questions };
}

export function generatedWritingTasks(lang: string): [ExamFormFillTask, ExamShortMessageTask] {
  const s = stringsFor(lang);
  return [
    {
      id: 'gen-form',
      kind: 'form_fill',
      instruction: s.formInstruction,
      context: s.formContext,
      fields: s.formFields,
    },
    {
      id: 'gen-message',
      kind: 'short_message',
      instruction: s.messageInstruction,
      prompt: s.messagePrompt,
      minWords: 25,
      points: s.messagePoints,
    },
  ];
}

export function generatedSpeakingTasks(lang: string): ExamSpeakingTask[] {
  const s = stringsFor(lang);
  return s.speakPrompts.map((p, i) => ({
    id: `gen-speak-${i + 1}`,
    kind: 'speaking_prompt' as const,
    instruction: s.speakInstruction,
    prompt: p.prompt,
    model: p.model,
    minWords: p.minWords,
    points: p.points,
  }));
}
