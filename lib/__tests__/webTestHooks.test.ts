// (F agent): a web teszt-horgok paraméter-értelmezője (lib/webTestHooks.ts).
import { applyWebTestParams, getWebTestParams, parseWebTestParams } from '../webTestHooks';

describe('parseWebTestParams', () => {
  it('érvényes paraméterek mind átjönnek', () => {
    expect(parseWebTestParams('?skin=deco&mode=dark&pal=lime&onboarded=1')).toEqual({
      skin: 'deco',
      mode: 'dark',
      pal: 'lime',
      onboarded: true,
    });
  });

  it('a skin lehet mix, a mix=<colors>.<font>.<shape>.<decor> érvényes mixet ad', () => {
    expect(parseWebTestParams('?skin=mix&mix=ukiyoe.memphis.szecesszio.deco')).toEqual({
      skin: 'mix',
      mix: { colors: 'ukiyoe', font: 'memphis', shape: 'szecesszio', decor: 'deco' },
    });
    // al-paletta is lehet a szín-forrás, a dísz lehet none
    expect(parseWebTestParams('?mix=electric.zen.brutal.none')?.mix).toEqual({
      colors: 'electric',
      font: 'zen',
      shape: 'brutal',
      decor: 'none',
    });
  });

  it('érvénytelen értékek kimaradnak, ha egy sem érvényes: null', () => {
    expect(parseWebTestParams('?skin=nincs&mode=auto&pal=piros&onboarded=0&mix=a.b.c')).toBeNull();
    expect(parseWebTestParams('')).toBeNull();
    expect(parseWebTestParams('?x=1')).toBeNull();
    expect(parseWebTestParams('?skin=zen&mode=auto')).toEqual({ skin: 'zen' });
  });

  it('az onboarded csak az 1-re igaz', () => {
    expect(parseWebTestParams('?onboarded=1')).toEqual({ onboarded: true });
    expect(parseWebTestParams('?onboarded=true')).toBeNull();
  });
});

describe('getWebTestParams', () => {
  it('natívon (nem web) null', () => {
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

  it('az onboarded alapadatokat ír, a skin / pal / mix a db-be megy', async () => {
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

  it('paraméter nélkül semmit nem ír', async () => {
    const db = fakeDb();
    await applyWebTestParams(db as never, {});
    for (const fn of Object.values(db)) expect(fn).not.toHaveBeenCalled();
  });
});
