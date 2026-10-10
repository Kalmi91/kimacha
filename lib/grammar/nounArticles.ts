// User feedback ("I want this task in this lesson: a word comes up,
// say agua, and I have to choose whether it is la or el … and I want all the nouns
// that are in the app in this task, and I want a card deck from it"): the el / la
// task and the word deck of the articulos-genero lesson from the app's OWN nouns
// (data/words-open, all levels), built at runtime, so a new vocabulary expansion
// (e.g. words-open-2) gets in by itself.
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';
import openC1 from '@/data/words-open/c1.json';
import type { GrammarGapItem } from '@/lib/games/content';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

interface OpenWord {
  order: number;
  level: string;
  pos: string;
  lemma: string;
  es: string;
  hu?: string;
  en: string;
  de?: string;
  sentence_es?: string;
}

export const ARTICLE_LESSON_ID = 'articulos-genero';

/** One run of the el / la task is this many nouns (a sample seeded from the full set). */
export const ARTICLE_ROUND_SIZE = 20;

interface ArticleNoun {
  id: string; // `${level}-${order}`, unique across levels
  noun: string; // the noun without an article: "agua"
  article: 'el' | 'la';
  es: string; // the full Spanish side of the card: "el agua" (or "el carro / el coche / el auto")
  en: string;
  /** the meaning of the noun in the interface language (words-open hu / en / de; English for es); visible after the answer. */
  tr: Lang4;
  sentence?: string;
}

// Feminine nouns that take «el» in the singular before a stressed a-.
const EL_FEMININE = new Set(['agua', 'águila', 'alma', 'arma', 'hada', 'hambre', 'área', 'aula', 'ala', 'asa', 'ancla']);

let cache: ArticleNoun[] | null = null;

/** All singular nouns of the app with their article (el / la), by level and order number. */
export function articleNouns(): ArticleNoun[] {
  if (cache) return cache;
  const out: ArticleNoun[] = [];
  const seen = new Set<string>();
  for (const words of [openA1, openA2, openB1, openB2, openC1] as unknown as OpenWord[][]) {
    for (const w of words) {
      if (w.pos !== 'noun') continue;
      const first = w.es.split(' / ')[0].trim();
      const m = first.match(/^(el|la) ([^\s/]+)$/);
      if (!m) continue; // plural (las vacaciones), "el/la" common gender, multi-word: cannot be asked with a single article
      const noun = m[2];
      if (seen.has(noun)) continue;
      seen.add(noun);
      out.push({ id: `${w.level.toLowerCase()}-${w.order}`, noun, article: m[1] as 'el' | 'la', es: w.es, en: w.en, tr: { en: w.en, es: w.en }, sentence: w.sentence_es });
    }
  }
  cache = out;
  return out;
}

type Lang4 = Record<'en' | 'es', string>;

function whyText(n: ArticleNoun): Lang4 {
  const { noun: x, article: a } = n;
  if (a === 'el' && EL_FEMININE.has(x)) {
    return {
      en: `«${x}» is feminine, but before a stressed a- the singular takes «el»: el ${x} (plural: las ${x}s).`,
      es: `«${x}» es femenino, pero ante «a» tónica el singular lleva «el»: el ${x} (plural: las ${x}s).`,
    };
  }
  if (a === 'el' && /o$/.test(x)) {
    return {
      en: `«${x}» ends in -o, so it is masculine: el ${x}.`,
      es: `«${x}» acaba en -o: es masculino, el ${x}.`,
    };
  }
  if (a === 'el' && /a$/.test(x)) {
    return {
      en: `«${x}» ends in -a but is masculine: el ${x}.`,
      es: `«${x}» acaba en -a pero es masculino: el ${x}.`,
    };
  }
  if (a === 'la' && /(ción|sión|dad|tad)$/.test(x)) {
    return {
      en: `Words ending in -ción, -sión, -dad, -tad are feminine: la ${x}.`,
      es: `Las palabras en -ción, -sión, -dad y -tad son femeninas: la ${x}.`,
    };
  }
  if (a === 'la' && /a$/.test(x)) {
    return {
      en: `«${x}» ends in -a, so it is feminine: la ${x}.`,
      es: `«${x}» acaba en -a: es femenino, la ${x}.`,
    };
  }
  return {
    en: `The correct form is ${a} ${x}. Always learn a noun together with its article.`,
    es: `La forma correcta es ${a} ${x}. Aprende siempre el sustantivo junto con su artículo.`,
  };
}

function wrongText(n: ArticleNoun, wrongArticle: 'el' | 'la'): Lang4 {
  const { noun: x, article: a } = n;
  return {
    en: `«${wrongArticle} ${x}» is not correct; the right form is ${a} ${x}.`,
    es: `«${wrongArticle} ${x}» no es correcto; lo correcto es ${a} ${x}.`,
  };
}

/** The items of the el / la chooser: "___ agua" -> el. Members of the `article` set of GrammarGapItem. */
export function articleNounItems(): GrammarGapItem[] {
  return articleNouns().map((n) => {
    const wrong: 'el' | 'la' = n.article === 'el' ? 'la' : 'el';
    return {
      id: `art-n-${n.id}`,
      set: 'article',
      sentence: `___ ${n.noun}`,
      options: ['el', 'la'],
      correct: n.article === 'el' ? 0 : 1,
      why: whyText(n),
      wrong: { [wrong]: wrongText(n, wrong) },
      examples: n.sentence ? [n.sentence] : [],
      tr: n.tr,
    };
  });
}

/** Adds all nouns of the app to the articulos-genero lesson as an el / la task; does not touch other lessons. */
export function withArticleNouns<T extends LessonV2>(lesson: T): T {
  if (lesson.topic !== ARTICLE_LESSON_ID) return lesson;
  return { ...lesson, items: [...lesson.items, ...articleNounItems()] };
}
