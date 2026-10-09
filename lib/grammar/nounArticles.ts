// („ebbe a leckébe akarom azt a feladatot, hogy feljön egy szó,
// mondjuk agua, és ki kell választani, hogy la vagy el … és az összes nount akarom ebbe a feladatba,
// ami az appba van, és egy kártya paklit akarok belőle”): az articulos-genero lecke el / la
// feladata és szó-paklija az app SAJÁT főneveiből (data/words-open, minden szint), futásidőben
// előállítva, így egy új szókészlet-bővítés (pl. words-open-2) magától bekerül.
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';
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

/** Az el / la feladat egy futása ennyi főnév (a teljes készletből seedelt minta). */
export const ARTICLE_ROUND_SIZE = 20;

interface ArticleNoun {
  id: string; // `${szint}-${order}`, a szintek közt egyedi
  noun: string; // a főnév névelő nélkül: "agua"
  article: 'el' | 'la';
  es: string; // a kártya teljes spanyol oldala: "el agua" (vagy "el carro / el coche / el auto")
  en: string;
  /** a főnév jelentése a felület nyelvén (words-open hu / en / de; es-nél az angol); a válasz után látszik. */
  tr: Lang4;
  sentence?: string;
}

// Nőnemű főnevek, amik egyes számban hangsúlyos a- előtt «el»-t kapnak.
const EL_FEMININE = new Set(['agua', 'águila', 'alma', 'arma', 'hada', 'hambre', 'área', 'aula', 'ala', 'asa', 'ancla']);

let cache: ArticleNoun[] | null = null;

/** Az app összes egyes számú főneve névelővel (el / la), szint és sorszám szerint. */
export function articleNouns(): ArticleNoun[] {
  if (cache) return cache;
  const out: ArticleNoun[] = [];
  const seen = new Set<string>();
  for (const words of [openA1, openA2, openB1, openB2] as unknown as OpenWord[][]) {
    for (const w of words) {
      if (w.pos !== 'noun') continue;
      const first = w.es.split(' / ')[0].trim();
      const m = first.match(/^(el|la) ([^\s/]+)$/);
      if (!m) continue; // többes (las vacaciones), "el/la" közös nemű, többszavas: nem kérdezhető egyetlen névelővel
      const noun = m[2];
      if (seen.has(noun)) continue;
      seen.add(noun);
      out.push({ id: `${w.level.toLowerCase()}-${w.order}`, noun, article: m[1] as 'el' | 'la', es: w.es, en: w.en, tr: { hu: w.hu ?? w.en, en: w.en, es: w.en, de: w.de ?? w.en }, sentence: w.sentence_es });
    }
  }
  cache = out;
  return out;
}

type Lang4 = Record<'hu' | 'en' | 'es' | 'de', string>;

function whyText(n: ArticleNoun): Lang4 {
  const { noun: x, article: a } = n;
  if (a === 'el' && EL_FEMININE.has(x)) {
    return {
      hu: `A(z) ${x} nőnemű, de hangsúlyos a- előtt egyes számban «el» áll: el ${x} (többes számban: las ${x}s).`,
      en: `«${x}» is feminine, but before a stressed a- the singular takes «el»: el ${x} (plural: las ${x}s).`,
      es: `«${x}» es femenino, pero ante «a» tónica el singular lleva «el»: el ${x} (plural: las ${x}s).`,
      de: `«${x}» ist feminin, aber vor betontem a- steht im Singular «el»: el ${x} (Plural: las ${x}s).`,
    };
  }
  if (a === 'el' && /o$/.test(x)) {
    return {
      hu: `A(z) ${x} -o végű, ezért hímnemű: el ${x}.`,
      en: `«${x}» ends in -o, so it is masculine: el ${x}.`,
      es: `«${x}» acaba en -o: es masculino, el ${x}.`,
      de: `«${x}» endet auf -o, also maskulin: el ${x}.`,
    };
  }
  if (a === 'el' && /a$/.test(x)) {
    return {
      hu: `A(z) ${x} -a végű, mégis hímnemű: el ${x}.`,
      en: `«${x}» ends in -a but is masculine: el ${x}.`,
      es: `«${x}» acaba en -a pero es masculino: el ${x}.`,
      de: `«${x}» endet auf -a, ist aber maskulin: el ${x}.`,
    };
  }
  if (a === 'la' && /(ción|sión|dad|tad)$/.test(x)) {
    return {
      hu: `A -ción, -sión, -dad, -tad végű szavak nőneműek: la ${x}.`,
      en: `Words ending in -ción, -sión, -dad, -tad are feminine: la ${x}.`,
      es: `Las palabras en -ción, -sión, -dad y -tad son femeninas: la ${x}.`,
      de: `Wörter auf -ción, -sión, -dad, -tad sind feminin: la ${x}.`,
    };
  }
  if (a === 'la' && /a$/.test(x)) {
    return {
      hu: `A(z) ${x} -a végű, ezért nőnemű: la ${x}.`,
      en: `«${x}» ends in -a, so it is feminine: la ${x}.`,
      es: `«${x}» acaba en -a: es femenino, la ${x}.`,
      de: `«${x}» endet auf -a, also feminin: la ${x}.`,
    };
  }
  return {
    hu: `Így helyes: ${a} ${x}. A főnevet mindig a névelőjével együtt tanuld.`,
    en: `The correct form is ${a} ${x}. Always learn a noun together with its article.`,
    es: `La forma correcta es ${a} ${x}. Aprende siempre el sustantivo junto con su artículo.`,
    de: `Richtig ist ${a} ${x}. Lerne ein Nomen immer zusammen mit seinem Artikel.`,
  };
}

function wrongText(n: ArticleNoun, wrongArticle: 'el' | 'la'): Lang4 {
  const { noun: x, article: a } = n;
  return {
    hu: `A «${wrongArticle} ${x}» nem helyes; helyesen: ${a} ${x}.`,
    en: `«${wrongArticle} ${x}» is not correct; the right form is ${a} ${x}.`,
    es: `«${wrongArticle} ${x}» no es correcto; lo correcto es ${a} ${x}.`,
    de: `«${wrongArticle} ${x}» ist nicht richtig; richtig ist ${a} ${x}.`,
  };
}

/** Az el / la választó tételei: „___ agua” -> el. A GrammarGapItem `article` készletének tagjai. */
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

/** Az articulos-genero leckéhez hozzáadja az app összes főnevét el / la feladatként; más leckét nem érint. */
export function withArticleNouns<T extends LessonV2>(lesson: T): T {
  if (lesson.topic !== ARTICLE_LESSON_ID) return lesson;
  return { ...lesson, items: [...lesson.items, ...articleNounItems()] };
}
