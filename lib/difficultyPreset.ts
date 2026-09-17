// UTEMEZO 8/0: a "Nehézség" tárcsa preset-táblája (FB279, Kálmán 2026-09-17,
// "difficulty nem működik, vagy van egy szabály, ami feleslegesen felülír
// valamit"). A tárcsa a napi új szót és a kézben lévő szavak plafonját (P)
// állítja EGYÜTT, öt fokozaton. A fokozat NEM külön tárolt beállítás: mindig a
// tárolt (napi új szó, P) párból számoljuk vissza, ezért nincs "szabály, ami
// felülír", a tárcsa csak ír, sosem ír vissza magától. Ha a pár nem egyezik
// egyik sorral sem (mert a két szám egyenként lett állítva), a fokozat
// 'custom'.

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface DifficultyPresetValues {
  dailyNew: number;
  hand: number;
}

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

const PRESETS: Record<DifficultyLevel, DifficultyPresetValues> = {
  1: { dailyNew: 5, hand: 3 },
  2: { dailyNew: 10, hand: 4 },
  3: { dailyNew: 15, hand: 5 },
  4: { dailyNew: 20, hand: 7 },
  5: { dailyNew: 30, hand: 10 },
};

export function presetValues(level: DifficultyLevel): DifficultyPresetValues {
  return PRESETS[level];
}

export function difficultyPreset(dailyNew: number, hand: number): DifficultyLevel | 'custom' {
  const match = LEVELS.find(level => PRESETS[level].dailyNew === dailyNew && PRESETS[level].hand === hand);
  return match ?? 'custom';
}
