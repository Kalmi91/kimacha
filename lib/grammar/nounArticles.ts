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
// Hungarian meaning of the same cards, [{ k: order, hu }]; the explanation texts below are generated, so the
// sidecar overlay of the other lessons (lib/grammar/huOverlay.ts) cannot reach them, their `hu` is written here.
import glossA1 from '@/data/words-open/gloss-hu/a1.json';
import glossA2 from '@/data/words-open/gloss-hu/a2.json';
import glossB1 from '@/data/words-open/gloss-hu/b1.json';
import glossB2 from '@/data/words-open/gloss-hu/b2.json';
import glossC1 from '@/data/words-open/gloss-hu/c1.json';
import type { GrammarGapItem } from '@/lib/games/content';
import type { Lang4, LessonV2 } from '@/lib/grammar/lessonTypes';

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

/** The Hungarian meaning of a card by `${level}-${order}` (the ArticleNoun id). */
function huGlossById(): Map<string, string> {
  const out = new Map<string, string>();
  const files: [string, unknown][] = [['a1', glossA1], ['a2', glossA2], ['b1', glossB1], ['b2', glossB2], ['c1', glossC1]];
  for (const [level, cards] of files) {
    for (const c of cards as { k: number; hu?: string }[]) if (c.hu?.trim()) out.set(`${level}-${c.k}`, c.hu.trim());
  }
  return out;
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
  const hu = huGlossById();
  for (const words of [openA1, openA2, openB1, openB2, openC1] as unknown as OpenWord[][]) {
    for (const w of words) {
      if (w.pos !== 'noun') continue;
      const first = w.es.split(' / ')[0].trim();
      const m = first.match(/^(el|la) ([^\s/]+)$/);
      if (!m) continue; // plural (las vacaciones), "el/la" common gender, multi-word: cannot be asked with a single article
      const noun = m[2];
      if (seen.has(noun)) continue;
      seen.add(noun);
      const id = `${w.level.toLowerCase()}-${w.order}`;
      const huMeaning = hu.get(id);
      out.push({ id, noun, article: m[1] as 'el' | 'la', es: w.es, en: w.en, tr: { en: w.en, es: w.en, ...(huMeaning ? { hu: huMeaning } : {}) }, sentence: w.sentence_es });
    }
  }
  cache = out;
  return out;
}

function whyText(n: ArticleNoun): Lang4 {
  const { noun: x, article: a } = n;
  if (a === 'el' && EL_FEMININE.has(x)) {
    return {
      en: `«${x}» is feminine, but before a stressed a- the singular takes «el»: el ${x} (plural: las ${x}s).`,
      es: `«${x}» es femenino, pero ante «a» tónica el singular lleva «el»: el ${x} (plural: las ${x}s).`,
      hu: `«${x}» nőnemű, de hangsúlyos a- előtt az egyes szám «el» névelőt kap: el ${x} (többes szám: las ${x}s).`,
      de: `„${x}“ ist feminin, aber vor betontem a- steht im Singular „el“: el ${x} (Plural: las ${x}s).`,
    };
  }
  if (a === 'el' && /o$/.test(x)) {
    return {
      en: `«${x}» ends in -o, so it is masculine: el ${x}.`,
      es: `«${x}» acaba en -o: es masculino, el ${x}.`,
      hu: `«${x}» -o végű, ezért hímnemű: el ${x}.`,
      de: `„${x}“ endet auf -o, deshalb ist es maskulin: el ${x}.`,
    };
  }
  if (a === 'el' && /a$/.test(x)) {
    return {
      en: `«${x}» ends in -a but is masculine: el ${x}.`,
      es: `«${x}» acaba en -a pero es masculino: el ${x}.`,
      hu: `«${x}» -a végű, mégis hímnemű: el ${x}.`,
      de: `„${x}“ endet auf -a, ist aber maskulin: el ${x}.`,
    };
  }
  if (a === 'la' && /(ción|sión|dad|tad)$/.test(x)) {
    return {
      en: `Words ending in -ción, -sión, -dad, -tad are feminine: la ${x}.`,
      es: `Las palabras en -ción, -sión, -dad y -tad son femeninas: la ${x}.`,
      hu: `A -ción, -sión, -dad, -tad végű szavak nőneműek: la ${x}.`,
      de: `Wörter auf -ción, -sión, -dad, -tad sind feminin: la ${x}.`,
    };
  }
  if (a === 'la' && /a$/.test(x)) {
    return {
      en: `«${x}» ends in -a, so it is feminine: la ${x}.`,
      es: `«${x}» acaba en -a: es femenino, la ${x}.`,
      hu: `«${x}» -a végű, ezért nőnemű: la ${x}.`,
      de: `„${x}“ endet auf -a, deshalb ist es feminin: la ${x}.`,
    };
  }
  return {
    en: `The correct form is ${a} ${x}. Always learn a noun together with its article.`,
    es: `La forma correcta es ${a} ${x}. Aprende siempre el sustantivo junto con su artículo.`,
    hu: `A helyes alak: ${a} ${x}. A főnevet mindig a névelőjével együtt tanuld meg.`,
    de: `Die richtige Form ist ${a} ${x}. Lerne ein Nomen immer zusammen mit seinem Artikel.`,
  };
}

function wrongText(n: ArticleNoun, wrongArticle: 'el' | 'la'): Lang4 {
  const { noun: x, article: a } = n;
  return {
    en: `«${wrongArticle} ${x}» is not correct; the right form is ${a} ${x}.`,
    es: `«${wrongArticle} ${x}» no es correcto; lo correcto es ${a} ${x}.`,
    hu: `«${wrongArticle} ${x}» nem helyes; a jó alak: ${a} ${x}.`,
    de: `„${wrongArticle} ${x}“ ist nicht richtig; die richtige Form ist ${a} ${x}.`,
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

// ---------------------------------------------------------------------------
// The German course: the same task for the artikel-genus lesson, "___ Hund" -> der / die / das, from the nouns of the
// German deck (data/words/de, all levels). Built at runtime like the Spanish one, so a deck expansion gets in by itself.
// ---------------------------------------------------------------------------

export const ARTICLE_LESSON_ID_DE = 'artikel-genus';

/** The lessons that carry the article task (articulos-genero in the Spanish course, artikel-genus in the German one). */
export function isArticleLesson(topicId: string): boolean {
  return topicId === ARTICLE_LESSON_ID || topicId === ARTICLE_LESSON_ID_DE;
}

export type GermanArticle = 'der' | 'die' | 'das';

interface DeCard {
  id: number;
  level: string;
  pos?: string;
  de: string;
  es: string;
  en: string;
  hu: string;
  sentence_de?: string;
}

export interface ArticleNounDe {
  id: string; // `d${card id}`, unique across levels
  noun: string; // the noun without an article: "Hund"
  article: GermanArticle;
  /** the meaning of the noun in the interface language (English, Spanish or Hungarian); visible after the answer. */
  tr: Lang4;
  sentence?: string;
}

let cacheDe: ArticleNounDe[] | null = null;

/**
 * All singular nouns of the German deck with their article. The first alternative of a headword counts ("das Haus / das
 * Zuhause" -> Haus); plural-only (die Leute (Pl.)), several-word and der/die cards are left out, and so is a noun that
 * stands with two articles (nothing in the gap would say which one is meant).
 */
export function articleNounsDe(): ArticleNounDe[] {
  if (cacheDe) return cacheDe;
  // required here, not imported: the deck stays unparsed until the German article task is first asked for
  const files: DeCard[][] = [
    require('@/data/words/de/a1.json'),
    require('@/data/words/de/a2.json'),
    require('@/data/words/de/b1.json'),
    require('@/data/words/de/b2.json'),
    require('@/data/words/de/c1.json'),
  ];
  const articlesOf = new Map<string, Set<GermanArticle>>();
  const picked: ArticleNounDe[] = [];
  for (const cards of files) {
    for (const w of cards) {
      if (w.pos !== 'noun') continue;
      const m = w.de.split(' / ')[0].trim().match(/^(der|die|das) ([^\s/]+)$/);
      if (!m) continue;
      const noun = m[2];
      articlesOf.set(noun, (articlesOf.get(noun) ?? new Set()).add(m[1] as GermanArticle));
      picked.push({
        id: `d${w.id}`,
        noun,
        article: m[1] as GermanArticle,
        tr: { en: w.en, es: w.es, ...(w.hu ? { hu: w.hu } : {}) },
        sentence: w.sentence_de || undefined,
      });
    }
  }
  const seen = new Set<string>();
  cacheDe = picked.filter((n) => {
    if (articlesOf.get(n.noun)!.size > 1 || seen.has(n.noun)) return false;
    seen.add(n.noun);
    return true;
  });
  return cacheDe;
}

// The weekdays, months and seasons are masculine; the reliable endings point to one article.
const DER_TIME = new Set([
  'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', 'Frühling', 'Sommer', 'Herbst', 'Winter',
]);
const DIE_ENDING = /(ung|heit|keit|schaft|tion|sion|tät|erei)$/;
const DAS_ENDING = /(chen|lein)$/;

function whyTextDe(n: ArticleNounDe): Lang4 {
  const { noun: x, article: a } = n;
  if (a === 'der' && DER_TIME.has(x)) {
    return {
      en: `Days of the week, months and seasons are masculine: der ${x}.`,
      es: `Los días de la semana, los meses y las estaciones son masculinos: der ${x}.`,
      hu: `A hét napjai, a hónapok és az évszakok hímneműek: der ${x}.`,
      de: `Wochentage, Monate und Jahreszeiten sind maskulin: der ${x}.`,
    };
  }
  if (a === 'die' && DIE_ENDING.test(x)) {
    const ending = x.match(DIE_ENDING)![1];
    return {
      en: `Nouns ending in -${ending} are feminine: die ${x}.`,
      es: `Los sustantivos que acaban en -${ending} son femeninos: die ${x}.`,
      hu: `A -${ending} végű főnevek nőneműek: die ${x}.`,
      de: `Nomen auf -${ending} sind feminin: die ${x}.`,
    };
  }
  if (a === 'das' && DAS_ENDING.test(x)) {
    const ending = x.match(DAS_ENDING)![1];
    return {
      en: `Nouns ending in -${ending} are neuter: das ${x}.`,
      es: `Los sustantivos que acaban en -${ending} son neutros: das ${x}.`,
      hu: `A -${ending} végű főnevek semlegesneműek: das ${x}.`,
      de: `Nomen auf -${ending} sind neutral: das ${x}.`,
    };
  }
  return {
    en: `The correct form is ${a} ${x}. Always learn a noun together with its article.`,
    es: `La forma correcta es ${a} ${x}. Aprende siempre el sustantivo junto con su artículo.`,
    hu: `A helyes alak: ${a} ${x}. A főnevet mindig a névelőjével együtt tanuld meg.`,
    de: `Die richtige Form ist ${a} ${x}. Lerne ein Nomen immer zusammen mit seinem Artikel.`,
  };
}

function wrongTextDe(n: ArticleNounDe, wrongArticle: GermanArticle): Lang4 {
  const { noun: x, article: a } = n;
  return {
    en: `«${wrongArticle} ${x}» is not correct; the right form is ${a} ${x}.`,
    es: `«${wrongArticle} ${x}» no es correcto; lo correcto es ${a} ${x}.`,
    hu: `«${wrongArticle} ${x}» nem helyes; a jó alak: ${a} ${x}.`,
    de: `„${wrongArticle} ${x}“ ist nicht richtig; die richtige Form ist ${a} ${x}.`,
  };
}

const DE_ARTICLES: GermanArticle[] = ['der', 'die', 'das'];

/** The items of the der / die / das chooser: "___ Hund" -> der. Members of the `article` set of GrammarGapItem. */
export function articleNounItemsDe(): GrammarGapItem[] {
  return articleNounsDe().map((n) => ({
    id: `art-n-${n.id}`,
    set: 'article',
    sentence: `___ ${n.noun}`,
    options: [...DE_ARTICLES],
    correct: DE_ARTICLES.indexOf(n.article),
    why: whyTextDe(n),
    wrong: Object.fromEntries(DE_ARTICLES.filter((a) => a !== n.article).map((a) => [a, wrongTextDe(n, a)])),
    examples: n.sentence ? [n.sentence] : [],
    tr: n.tr,
  }));
}

/** Adds all nouns of the German deck to the artikel-genus lesson as a der / die / das task; does not touch other lessons. */
export function withArticleNounsDe<T extends LessonV2>(lesson: T): T {
  if (lesson.topic !== ARTICLE_LESSON_ID_DE) return lesson;
  return { ...lesson, items: [...lesson.items, ...articleNounItemsDe()] };
}
