// a billentyűzet mikrofonjával diktált szöveg
// összevetése a várt mondattal: kis- és nagybetű és írásjel nem számít, az ékezet a "Accents count"
// beállítást követi, az eltérő szavak mindkét oldalon ki vannak emelve.

import { compareDictation } from '../dictation';

const loose = { strictAccents: false } as const;
const strict = { strictAccents: true } as const;
const words = (list: { text: string; ok: boolean }[]) => list.map((w) => w.text);

describe('compareDictation: kis- és nagybetű, írásjel', () => {
  it('a pontos mondat helyes', () => {
    const r = compareDictation('Yo como en casa.', 'Yo como en casa.', strict);
    expect(r).toMatchObject({ correct: true, missing: [], extra: [] });
    expect(r.expected.every((w) => w.ok)).toBe(true);
    expect(r.heard.every((w) => w.ok)).toBe(true);
  });

  it('a kis- és nagybetű nem számít (a billentyűzet nagybetűt tesz a mondat elejére)', () => {
    expect(compareDictation('yo como en casa', 'Yo como en casa.', strict).correct).toBe(true);
    expect(compareDictation('YO COMO EN CASA', 'Yo como en casa', strict).correct).toBe(true);
  });

  it('az írásjel nem számít: pont, vessző, kérdő- és felkiáltójel, idézőjel, gondolatjel', () => {
    expect(compareDictation('donde vives', '¿Dónde vives?', loose).correct).toBe(true);
    expect(compareDictation('Hola, como estas!', 'Hola como estás', loose).correct).toBe(true);
    expect(compareDictation('"Vivo aquí".', 'Vivo aquí', strict).correct).toBe(true);
    expect(compareDictation('vivo - aquí', 'Vivo aquí', strict).correct).toBe(true);
  });

  it('a szavak közti többszörös szóköz és a sortörés nem számít', () => {
    expect(compareDictation('  yo   como\nen casa ', 'Yo como en casa.', strict).correct).toBe(true);
  });

  it('az aposztróf és a kötőjel a szó része (angol)', () => {
    expect(compareDictation("i don't know", "I don't know.", loose).correct).toBe(true);
    expect(compareDictation('i dont know', "I don't know.", loose).correct).toBe(false);
  });

  it('a billentyűzet gördülő aposztrófja (’) ugyanaz, mint az egyenes', () => {
    expect(compareDictation('I don’t know', "I don't know.", loose).correct).toBe(true);
  });
});

describe('compareDictation: ékezet a "Accents count" beállítás szerint', () => {
  it('ékezet-szigor KI: az ékezet hiánya nem hiba', () => {
    expect(compareDictation('donde esta el bano', '¿Dónde está el baño?', loose).correct).toBe(false); // az ñ külön betű
    expect(compareDictation('donde esta el baño', '¿Dónde está el baño?', loose).correct).toBe(true);
    expect(compareDictation('ella esta aqui', 'Ella está aquí', loose).correct).toBe(true);
  });

  it('ékezet-szigor BE: az ékezet hiánya hiba, és a szó eltérőként van megjelölve', () => {
    const r = compareDictation('ella esta aqui', 'Ella está aquí', strict);
    expect(r.correct).toBe(false);
    expect(r.missing).toEqual(['está', 'aquí']);
    expect(r.extra).toEqual(['esta', 'aqui']);
  });

  it('ékezet-szigor BE: az ékezettel diktált mondat helyes', () => {
    expect(compareDictation('ella está aquí', 'Ella está aquí', strict).correct).toBe(true);
  });

  it('az ñ külön betű, nem ékezet: año nem egyezik az ano-val ékezet-szigor KI mellett sem', () => {
    expect(compareDictation('tengo un ano', 'Tengo un año', loose)).toMatchObject({ correct: false, missing: ['año'], extra: ['ano'] });
    expect(compareDictation('tengo un año', 'Tengo un año', loose).correct).toBe(true);
  });

  it('a nagybetűs ékezetes és a szétválasztott (NFD) alak is egyezik', () => {
    expect(compareDictation('ÉL ESTÁ AQUÍ', 'Él está aquí', strict).correct).toBe(true);
    expect(compareDictation('él está', 'Él está', strict).correct).toBe(true);
  });
});

describe('compareDictation: eltérő szavak listája', () => {
  it('egy téves szó: a várt oldalon hiányzik, a diktált oldalon felesleges', () => {
    const r = compareDictation('yo bebo en casa', 'Yo como en casa.', loose);
    expect(r.correct).toBe(false);
    expect(r.missing).toEqual(['como']);
    expect(r.extra).toEqual(['bebo']);
    expect(r.expected.map((w) => w.ok)).toEqual([true, false, true, true]);
    expect(r.heard.map((w) => w.ok)).toEqual([true, false, true, true]);
  });

  it('kimaradt szó: csak a várt oldalon van megjelölve', () => {
    const r = compareDictation('yo en casa', 'Yo como en casa.', loose);
    expect(r).toMatchObject({ correct: false, missing: ['como'], extra: [] });
    expect(words(r.heard)).toEqual(['yo', 'en', 'casa']);
  });

  it('felesleges szó: csak a diktált oldalon van megjelölve', () => {
    const r = compareDictation('yo como mucho en casa', 'Yo como en casa.', loose);
    expect(r).toMatchObject({ correct: false, missing: [], extra: ['mucho'] });
  });

  it('a megjelenítés az eredeti írásmódot adja (írásjellel), a megjelölés a szó szintjén', () => {
    const r = compareDictation('donde viven', '¿Dónde vives?', loose);
    expect(words(r.expected)).toEqual(['¿Dónde', 'vives?']);
    expect(r.expected.map((w) => w.ok)).toEqual([true, false]);
    expect(r.missing).toEqual(['vives?']);
    expect(r.extra).toEqual(['viven']);
  });

  it('a sorrend számít: felcserélt szavak eltérőnek számítanak, de a leghosszabb közös rész párosítva marad', () => {
    const r = compareDictation('casa en como yo', 'Yo como en casa.', loose);
    expect(r.correct).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.missing.length).toBe(r.extra.length);
    expect(r.expected.filter((w) => w.ok).length).toBe(1);
  });

  it('ismétlődő szónál csak a ténylegesen hiányzó példány jelenik meg', () => {
    const r = compareDictation('la casa grande', 'La casa casa grande', loose);
    expect(r).toMatchObject({ correct: false, missing: ['casa'], extra: [] });
  });

  it('üres vagy csak írásjelből álló diktálás: minden várt szó hiányzik', () => {
    for (const heard of ['', '   ', '...']) {
      const r = compareDictation(heard, 'Yo como en casa.', loose);
      expect(r.correct).toBe(false);
      expect(r.missing).toEqual(['Yo', 'como', 'en', 'casa.']);
      expect(r.heard).toEqual([]);
    }
  });
});

describe('compareDictation: spanyol alany-névmás elhagyása (FB399, mint a begépelt mondatnál)', () => {
  it('névmás nélkül is helyes, ha a beállítás be van kapcsolva', () => {
    expect(compareDictation('como en casa', 'Yo como en casa.', { strictAccents: false, subjectDrop: true }).correct).toBe(true);
  });

  it('a beállítás nélkül (pl. angol célnyelv) a hiányzó első szó hiba', () => {
    expect(compareDictation('como en casa', 'Yo como en casa.', loose)).toMatchObject({ correct: false, missing: ['Yo'] });
  });

  it('csak az elejéről hagyható el, és csak névmás: más szó hiánya hiba marad', () => {
    const opts = { strictAccents: false, subjectDrop: true } as const;
    expect(compareDictation('yo como casa', 'Yo como en casa.', opts).correct).toBe(false);
    expect(compareDictation('en casa', 'Mi madre come en casa.', opts).correct).toBe(false);
  });

  it('névmással is helyes marad', () => {
    expect(compareDictation('yo como en casa', 'Yo como en casa.', { strictAccents: false, subjectDrop: true }).correct).toBe(true);
  });
});
