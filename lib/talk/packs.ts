// Átbeszélő — a makró×szint cellák tartalma.
//
// Egy pakk = egy cella (makró + szint), benne a cella sztorija és
// párbeszéde, ugyanabban a StoryData / ChatData alakban, amit a Game fül
// használ (lib/games/content.ts). Ezért a két meglévő, letesztelt képernyő
// (app/games/story.tsx, app/games/chat.tsx) rajzolja őket, nincs harmadik
// renderelő, és a scripts/audit-games.mjs korpusz-ellenőrzése is ugyanaz.
//
// A harmadik formátum, a szókvíz NEM ide íródik: azt a cella szókincséből
// futásidőben építi a lib/talk/quiz.ts, tehát minden olyan cellában
// azonnal játszható, ahol a fának van szava. Szerzői munkát csak a sztori
// és a párbeszéd igényel, ezért a rács nagy része „Hamarosan".
//
// ÚJ PAKK FELVÉTELE: 1. data/games/talk/<lang>/<macro>-<level>.json,
// 2. import + egy sor a PACKS tömbben, 3. node scripts/audit-games.mjs.

import type { ChatData, StoryData } from '@/lib/games/content';
import type { Level } from '@/data/words';

export interface TalkPack {
  macro: number;
  level: Level;
  story: StoryData;
  chat: ChatData;
}

import es12A1 from '@/data/games/talk/es/12-A1.json';
import es12B1 from '@/data/games/talk/es/12-B1.json';

const packsByLang: Partial<Record<string, TalkPack[]>> = {
  es: [es12A1, es12B1] as unknown as TalkPack[],
};

export function getTalkPacks(lang: string): TalkPack[] {
  return packsByLang[lang] ?? [];
}

export function getTalkPack(lang: string, macro: number, level: Level): TalkPack | undefined {
  return getTalkPacks(lang).find((p) => p.macro === macro && p.level === level);
}

/** Azok a szintek, ahol ennek a makrónak van megírt sztorija/párbeszéde. */
export function levelsWithPack(lang: string, macro: number): Level[] {
  return getTalkPacks(lang)
    .filter((p) => p.macro === macro)
    .map((p) => p.level);
}

/** Hány cellának van kész tartalma (a fül fejlécében ezt mutatjuk). */
export function packCount(lang: string): number {
  return getTalkPacks(lang).length;
}

export function getTalkStory(lang: string, id: string): StoryData | undefined {
  return getTalkPacks(lang).find((p) => p.story.id === id)?.story;
}

export function getTalkChat(lang: string, id: string): ChatData | undefined {
  return getTalkPacks(lang).find((p) => p.chat.id === id)?.chat;
}
