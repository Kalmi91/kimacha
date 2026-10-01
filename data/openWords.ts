// PLAN-regi-szavak-ki 5. lépés (2026-10-01): a spanyol szavak egyetlen forrása a
// data/words-open (601 kártya, A1-B2). A kártyák a régi `WordEntry` alakjában
// jönnek (id = a kártya `order`-e, 1-601), hogy a keresők és a hívóik (glossza,
// kevert felolvasás, szófaj-index, igealak-térkép) változatlan aláírással élnek.
// A words-openben nincs `id`, `gender` és A0/C1/C2 szint: a nemet a névelő adja
// (a régi annotáló script is a névelőből vette), a szélső szintek az A1-re és a
// B2-re esnek (lásd openLevelOf, ugyanaz a szabály, mint a tableDeck PCIC_LEVEL_CEILING-je).

import type { Level, WordEntry, WordGender, WordPos } from '@/data/words';
import { esFeminine, esPlural } from '@/lib/esInflect';
import { conjugate, TENSES } from '@/lib/games/conjugate';
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';

interface OpenCard {
  order: number;
  level: string;
  pos: string;
  lemma: string;
  es: string;
  hu: string;
  en: string;
  de: string;
  sentence_es: string;
  sentence_hu: string;
  sentence_en: string;
  sentence_de: string;
  hint_en?: string;
}

/** A words-open kártya WordEntry-alakban; `openPos` a words-open nyers szófaja (conj, det, interj is). */
export type OpenWord = WordEntry & { lemma: string; openPos: string };

export const OPEN_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2'];

// A WordPos-ba eső szófajok; conj/det/interj nem képezhető le, azoknak `pos` nélkül marad a kártya.
const OPEN_POS_TO_WORD_POS: Record<string, WordPos> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  pron: 'pron',
  prep: 'prep',
  num: 'num',
};

const ARTICLE_GENDER: Record<string, WordGender> = { el: 'm', los: 'm', la: 'f', las: 'f' };

function genderFromArticle(es: string): WordGender | undefined {
  return ARTICLE_GENDER[es.trim().toLowerCase().split(/\s+/)[0]];
}

function toWord(c: OpenCard): OpenWord {
  const pos = OPEN_POS_TO_WORD_POS[c.pos];
  const word: OpenWord = {
    id: c.order,
    level: c.level as Level,
    es: c.es,
    hu: c.hu,
    en: c.en,
    de: c.de,
    sentence_es: c.sentence_es,
    sentence_hu: c.sentence_hu,
    sentence_en: c.sentence_en,
    sentence_de: c.sentence_de,
    lemma: c.lemma,
    openPos: c.pos,
  };
  if (pos) word.pos = pos;
  if (c.pos === 'noun') {
    const gender = genderFromArticle(c.es);
    if (gender) word.gender = gender;
  }
  return word;
}

const FILES: OpenCard[][] = [openA1, openA2, openB1, openB2] as OpenCard[][];

export const openWords: OpenWord[] = FILES.flatMap((cards) => cards.map(toWord));

/** A words-open szintje: A0 → A1, C1/C2 → B2 (A1 az alsó, B2 a felső határ). */
export function openLevelOf(level: Level): Level {
  if (level === 'A0') return 'A1';
  if (level === 'C1' || level === 'C2') return 'B2';
  return level;
}

export function getOpenWordsForLevel(level: Level): OpenWord[] {
  return openWords.filter((w) => w.level === level);
}

/** A szinttől (a clamp után) kumulatívan A1-ig visszamenően minden kártya. */
export function getOpenWordsUpToLevel(level: Level): OpenWord[] {
  const idx = OPEN_LEVELS.indexOf(openLevelOf(level));
  const allowed = new Set(OPEN_LEVELS.slice(0, idx + 1));
  return openWords.filter((w) => allowed.has(w.level));
}

// Ragozott alak -> words-open lemma (glossza-lefedettség, a PLAN-regi-szavak-ki 5. lépése
// utáni javítás): a régi lista a ragozott alakokat is hordozta, a words-open csak a
// tőalakot. Az index kizárólag words-open kártyából épül: igéknél a ragozó motor
// (lib/games/conjugate) alakjai, főnév/melléknévnél a többes és a nemi alak
// (lib/esInflect). Amit a motor bizonytalannak tart (conjugate -> null), kimarad.
const ES_INFINITIVE = /^[a-záéíóúñü]*(ar|er|ir)$/;
const FORM_ARTICLE = /^(el|la|los|las|un|una|unos|unas)\s+/;

let formIndex: Map<string, OpenWord> | null = null;

function buildFormIndex(): Map<string, OpenWord> {
  const index = new Map<string, OpenWord>();
  const add = (form: string | null, card: OpenWord) => {
    const key = form?.trim().toLowerCase();
    // Az első kártya nyer, így az alacsonyabb szint birtokol egy többkártyás alakot.
    if (key && !index.has(key)) index.set(key, card);
  };
  for (const card of openWords) {
    for (const alt of card.es.split(' / ')) {
      const head = alt.trim().toLowerCase();
      if (!head) continue;
      if (card.openPos === 'verb') {
        if (!ES_INFINITIVE.test(head)) continue;
        for (const tense of TENSES) for (const f of conjugate(head, tense) ?? []) add(f.form, card);
      } else if (card.openPos === 'noun' || card.openPos === 'adj') {
        const bare = head.replace(FORM_ARTICLE, '');
        if (!bare || bare.includes(' ') || /^(los|las)\s/.test(head)) continue;
        add(esPlural(bare), card);
        if (card.openPos === 'adj') {
          const fem = esFeminine(bare);
          add(fem, card);
          if (fem) add(esPlural(fem), card);
        }
      }
    }
  }
  return index;
}

/** A ragozott, többes vagy nemi alak words-open kártyája (a tőalakot a hívó már megkereste); csak spanyolra. */
export function findOpenWordByForm(norm: string): OpenWord | undefined {
  if (!formIndex) formIndex = buildFormIndex();
  return formIndex.get(norm) ?? formIndex.get(norm.replace(FORM_ARTICLE, ''));
}
