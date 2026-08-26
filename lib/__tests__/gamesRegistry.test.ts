// GAMES.md 1. + 3.: the registry is the ONE source every hub card and future
// game screen reads from, so a missing translation or a duplicate id is a
// silent content bug, not a crash, worth a guard.

import { GAME_DEFS, gameName, gameBlurb, gameRoute, getGameDef } from '../games/registry';

describe('GAME_DEFS (GAMES.md 1. szekció, the approved 13-game list)', () => {
  it('has 13 unique ids, matching the approved list', () => {
    const ids = GAME_DEFS.map((g) => g.id);
    expect(ids).toHaveLength(13);
    expect(new Set(ids).size).toBe(13);
  });

  it('gives every game all four languages in name and blurb', () => {
    for (const game of GAME_DEFS) {
      for (const lang of ['hu', 'en', 'es', 'de'] as const) {
        expect(game.name[lang]).toBeTruthy();
        expect(game.blurb[lang]).toBeTruthy();
      }
    }
  });

  it('marks every game "soon" in F0 (no game screen exists yet)', () => {
    expect(GAME_DEFS.every((g) => g.soon)).toBe(true);
  });

  it('resolves the right localized text, falling back to English', () => {
    const wordRain = getGameDef('word-rain')!;
    expect(gameName(wordRain, 'hu')).toBe('Szó-eső');
    expect(gameName(wordRain, 'es')).toBe('Lluvia de Palabras');
    expect(gameName(wordRain, 'xx')).toBe(gameName(wordRain, 'en'));
    expect(gameBlurb(wordRain, 'de')).toContain('richtige');
  });

  it('builds a stable /games/<id> route', () => {
    expect(gameRoute('myth')).toBe('/games/myth');
  });
});
