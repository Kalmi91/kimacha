// Parameter parser of the web test hooks (lib/webTestHooks.ts).
import { applyWebTestParams, getWebTestParams, parseWebTestParams } from '../webTestHooks';

describe('parseWebTestParams', () => {
  it('valid parameters all come through', () => {
    expect(parseWebTestParams('?skin=deco&mode=dark&pal=lime&onboarded=1')).toEqual({
      skin: 'deco',
      mode: 'dark',
      pal: 'lime',
      onboarded: true,
    });
  });

  it('a skin can be a mix, mix=<colors>.<font>.<shape>.<decor> gives a valid mix', () => {
    expect(parseWebTestParams('?skin=mix&mix=ukiyoe.memphis.szecesszio.deco')).toEqual({
      skin: 'mix',
      mix: { colors: 'ukiyoe', font: 'memphis', shape: 'szecesszio', decor: 'deco' },
    });
    // a sub-palette can also be the color source, the decor can be none
    expect(parseWebTestParams('?mix=electric.zen.brutal.none')?.mix).toEqual({
      colors: 'electric',
      font: 'zen',
      shape: 'brutal',
      decor: 'none',
    });
  });

  it('invalid values are left out; if none is valid: null', () => {
    expect(parseWebTestParams('?skin=nincs&mode=auto&pal=piros&onboarded=0&mix=a.b.c')).toBeNull();
    expect(parseWebTestParams('')).toBeNull();
    expect(parseWebTestParams('?x=1')).toBeNull();
    expect(parseWebTestParams('?skin=zen&mode=auto')).toEqual({ skin: 'zen' });
  });

  it('onboarded is true only for 1', () => {
    expect(parseWebTestParams('?onboarded=1')).toEqual({ onboarded: true });
    expect(parseWebTestParams('?onboarded=true')).toBeNull();
  });
});

describe('getWebTestParams', () => {
  it('on native (not web) null', () => {
    expect(getWebTestParams()).toBeNull();
  });
});

describe('applyWebTestParams', () => {
  function fakeDb() {
    return {
      setOnboarding: jest.fn().mockResolvedValue(undefined),
      setPcicLevel: jest.fn().mockResolvedValue(undefined),
      setGrammarPalette: jest.fn().mockResolvedValue(undefined),
      setSkinMix: jest.fn().mockResolvedValue(undefined),
      setSkin: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('onboarded writes the base data, skin / pal / mix go to the db', async () => {
    const db = fakeDb();
    await applyWebTestParams(db as never, {
      onboarded: true,
      skin: 'mix',
      pal: 'cyan',
      mix: { colors: 'deco', font: 'zen', shape: 'brutal', decor: 'none' },
    });
    expect(db.setOnboarding).toHaveBeenCalledWith('en', 'es');
    expect(db.setPcicLevel).toHaveBeenCalledWith('A1');
    expect(db.setGrammarPalette).toHaveBeenCalledWith('cyan');
    expect(db.setSkinMix).toHaveBeenCalledWith({ colors: 'deco', font: 'zen', shape: 'brutal', decor: 'none' });
    expect(db.setSkin).toHaveBeenCalledWith('mix');
  });

  it('without parameters it writes nothing', async () => {
    const db = fakeDb();
    await applyWebTestParams(db as never, {});
    for (const fn of Object.values(db)) expect(fn).not.toHaveBeenCalled();
  });
});
