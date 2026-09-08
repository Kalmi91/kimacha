// Átbeszélő (Talk) fül — a szintfüggetlen témakatalógus.
//
// Kálmán kérése (2026-09-08): „legyen egy topic átbeszélő, ahol kiválasztod,
// hogy milyen szinten akarsz a témáról beszélgetni". A tanulófa (app/(tabs)/
// tree.tsx) témái SZINTHEZ KÖTÖTTEK: a `compras` csak A1-en létezik,
// a `compras_productos_b1` csak B1-en, tehát a fából nem lehet „ugyanaz a
// téma, másik szinten"-t kérdezni.
//
// A megoldás MÁR A DATÁBAN VAN: minden vocab-topic hordoz egy PCIC
// „Nociones específicas" makró-számot (`macro`, 0-20, lásd data/topics.ts).
// Ez a makró a szintfüggetlen téma-identitás: a 12-es makró alá esik a
// `compras` (A1), a `compras_servicios` (A2) és a `compras_productos_b1`
// (B1) is. Így 151 téma × 6 szint = 906 cella helyett 21 makró × 6 szint =
// 126 a valódi rács, és a fül minden témát meg tud mutatni anélkül, hogy
// mindegyikhez külön tartalmat kellene írni.
//
// A fül tehát a 151 témát a 21 makró alá csoportosítva listázza, a
// tartalom viszont makró+szint párra készül.

import {
  getTopicsForLevel,
  getTopicName,
  type TopicDef,
} from '@/data/topics';
import { LEVELS, getWordsForTopic, type Level, type WordEntry } from '@/data/words';

/** Az Átbeszélő szintjei. A0 kimarad (ott még nincs miről beszélgetni), C2 fagyasztva. */
export const TALK_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export interface MacroDef {
  /** PCIC makró-szám, 0 = általános fogalmak (számok, színek, idő). */
  macro: number;
  icon: string;
  name_hu: string;
  name_en: string;
  name_es: string;
  name_de: string;
}

// A PCIC (Plan curricular del Instituto Cervantes) „Nociones específicas"
// 20 makró-témája, + a 0 az általános fogalmaknak. A sorrend és a számozás a
// data/topics/*.json `macro` mezőjével egyezik, ezt NE számozd át.
export const MACROS: MacroDef[] = [
  { macro: 0, icon: '🔢', name_hu: 'Alapfogalmak', name_en: 'Basic concepts', name_es: 'Conceptos básicos', name_de: 'Grundbegriffe' },
  { macro: 1, icon: '🧍', name_hu: 'Test és megjelenés', name_en: 'Body and appearance', name_es: 'El cuerpo y la apariencia', name_de: 'Körper und Aussehen' },
  { macro: 2, icon: '💭', name_hu: 'Érzések és gondolatok', name_en: 'Feelings and thoughts', name_es: 'Sentimientos y pensamiento', name_de: 'Gefühle und Gedanken' },
  { macro: 3, icon: '🪪', name_hu: 'Bemutatkozás', name_en: 'Personal identity', name_es: 'Identidad personal', name_de: 'Persönliche Identität' },
  { macro: 4, icon: '👨‍👩‍👧', name_hu: 'Kapcsolatok és család', name_en: 'Relationships and family', name_es: 'Relaciones personales', name_de: 'Beziehungen und Familie' },
  { macro: 5, icon: '🍽️', name_hu: 'Étel és étkezés', name_en: 'Food and eating', name_es: 'Alimentación', name_de: 'Essen und Ernährung' },
  { macro: 6, icon: '🎓', name_hu: 'Tanulás és iskola', name_en: 'Education', name_es: 'Educación', name_de: 'Bildung und Schule' },
  { macro: 7, icon: '💼', name_hu: 'Munka és foglalkozás', name_en: 'Work', name_es: 'Trabajo', name_de: 'Arbeit und Beruf' },
  { macro: 8, icon: '⚽', name_hu: 'Szabadidő és sport', name_en: 'Free time and sport', name_es: 'Ocio', name_de: 'Freizeit und Sport' },
  { macro: 9, icon: '📰', name_hu: 'Média és kommunikáció', name_en: 'Media and communication', name_es: 'Información y medios', name_de: 'Medien und Kommunikation' },
  { macro: 10, icon: '🏠', name_hu: 'Lakás, otthon, környék', name_en: 'Home and neighbourhood', name_es: 'Vivienda, hogar y entorno', name_de: 'Wohnen und Umgebung' },
  { macro: 11, icon: '🏛️', name_hu: 'Ügyintézés és szolgáltatások', name_en: 'Services', name_es: 'Servicios', name_de: 'Ämter und Dienstleistungen' },
  { macro: 12, icon: '🛒', name_hu: 'Vásárlás és boltok', name_en: 'Shopping and stores', name_es: 'Compras y tiendas', name_de: 'Einkaufen und Geschäfte' },
  { macro: 13, icon: '🩺', name_hu: 'Egészség és orvos', name_en: 'Health', name_es: 'Salud e higiene', name_de: 'Gesundheit und Arzt' },
  { macro: 14, icon: '✈️', name_hu: 'Utazás és közlekedés', name_en: 'Travel and transport', name_es: 'Viajes y transporte', name_de: 'Reisen und Verkehr' },
  { macro: 15, icon: '🏭', name_hu: 'Gazdaság és ipar', name_en: 'Economy and industry', name_es: 'Economía e industria', name_de: 'Wirtschaft und Industrie' },
  { macro: 16, icon: '🔬', name_hu: 'Tudomány és technológia', name_en: 'Science and technology', name_es: 'Ciencia y tecnología', name_de: 'Wissenschaft und Technik' },
  { macro: 17, icon: '🗳️', name_hu: 'Politika és társadalom', name_en: 'Politics and society', name_es: 'Gobierno, política y sociedad', name_de: 'Politik und Gesellschaft' },
  { macro: 18, icon: '🎭', name_hu: 'Művészet és kultúra', name_en: 'Arts and culture', name_es: 'Actividades artísticas', name_de: 'Kunst und Kultur' },
  { macro: 19, icon: '⛪', name_hu: 'Vallás és filozófia', name_en: 'Religion and philosophy', name_es: 'Religión y filosofía', name_de: 'Religion und Philosophie' },
  { macro: 20, icon: '🌤️', name_hu: 'Természet és időjárás', name_en: 'Nature and weather', name_es: 'Geografía y naturaleza', name_de: 'Natur und Wetter' },
];

export function getMacro(macro: number): MacroDef | undefined {
  return MACROS.find((m) => m.macro === macro);
}

export function macroName(m: MacroDef, lang: string): string {
  if (lang === 'hu') return m.name_hu;
  if (lang === 'es') return m.name_es;
  if (lang === 'de') return m.name_de;
  return m.name_en;
}

/** Egy makró alá eső fa-téma, azzal a szinttel, ahol a fában szerepel. */
export interface MacroTopic {
  topic: TopicDef;
  level: Level;
}

const topicsCache = new Map<string, Map<number, MacroTopic[]>>();

/**
 * Minden vocab-téma a saját makrója alá csoportosítva, szint szerinti
 * sorrendben. Ez adja a fül listáját: „az összes téma", ahogy Kálmán kérte,
 * csak nem szint-silókba zárva.
 */
export function topicsByMacro(lang: string = 'es'): Map<number, MacroTopic[]> {
  const cached = topicsCache.get(lang);
  if (cached) return cached;
  const out = new Map<number, MacroTopic[]>();
  for (const level of TALK_LEVELS) {
    for (const topic of getTopicsForLevel(level, lang)) {
      if (topic.type !== 'vocab') continue;
      const macro = topic.macro ?? 0;
      const list = out.get(macro) ?? [];
      list.push({ topic, level });
      out.set(macro, list);
    }
  }
  topicsCache.set(lang, out);
  return out;
}

/** Az adott makró témái, olvasható névvel (a fül kártyáin ez a felsorolás). */
export function macroTopicNames(macro: number, lang: string, uiLang: string): string[] {
  const list = topicsByMacro(lang).get(macro) ?? [];
  return list.map((mt) => getTopicName(mt.topic, uiLang));
}

const wordsCache = new Map<string, WordEntry[]>();

/**
 * Egy makró+szint cella szókincse: az adott szinten lévő, ehhez a makróhoz
 * tartozó ÖSSZES fa-téma szava. Ebből épül a szókvíz (lib/talk/quiz.ts),
 * tehát az a formátum minden olyan cellában azonnal játszható, ahol a fának
 * egyáltalán van szava, szerzői munka nélkül.
 */
export function macroWords(macro: number, level: Level, lang: string = 'es'): WordEntry[] {
  const key = `${lang}|${macro}|${level}`;
  const cached = wordsCache.get(key);
  if (cached) return cached;
  const out: WordEntry[] = [];
  for (const topic of getTopicsForLevel(level, lang)) {
    if (topic.type !== 'vocab') continue;
    if ((topic.macro ?? 0) !== macro) continue;
    out.push(...getWordsForTopic(level, topic.id, lang));
  }
  wordsCache.set(key, out);
  return out;
}

/** Azok a szintek, ahol ennek a makrónak egyáltalán van szókincse. */
export function levelsWithWords(macro: number, lang: string = 'es'): Level[] {
  return TALK_LEVELS.filter((l) => macroWords(macro, l, lang).length > 0);
}

/** A fa-szintek sorrendje összehasonlításhoz (A1 < A2 < B1 ...). */
export function levelIndex(level: Level): number {
  return LEVELS.indexOf(level);
}
