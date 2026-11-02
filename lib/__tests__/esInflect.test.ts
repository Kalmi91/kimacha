import { esFeminine, esPlural, esSuperlativeForms } from '../esInflect';

describe('esPlural', () => {
  it('-s after a vowel, -es after a consonant', () => {
    expect(esPlural('libro')).toBe('libros');
    expect(esPlural('café')).toBe('cafés');
    expect(esPlural('papel')).toBe('papeles');
    expect(esPlural('tren')).toBe('trenes');
    expect(esPlural('pan')).toBe('panes');
  });

  it('-z → -ces', () => {
    expect(esPlural('vez')).toBe('veces');
    expect(esPlural('lápiz')).toBe('lápices');
    expect(esPlural('raíz')).toBe('raíces');
    expect(esPlural('luz')).toBe('luces');
  });

  it('a stressed -ón / -án / -én / -ín / -és loses the accent', () => {
    expect(esPlural('canción')).toBe('canciones');
    expect(esPlural('jardín')).toBe('jardines');
    expect(esPlural('inglés')).toBe('ingleses');
  });

  it('a stressed -ás / -ús drops the accent, -ís / -ús after a vowel keeps it (autobuses, países)', () => {
    expect(esPlural('autobús')).toBe('autobuses');
    expect(esPlural('compás')).toBe('compases');
    expect(esPlural('país')).toBe('países');
  });

  it('a one-syllable word in -s takes -es (mes → meses)', () => {
    expect(esPlural('mes')).toBe('meses');
    expect(esPlural('gas')).toBe('gases');
    expect(esPlural('gris')).toBe('grises');
    expect(esPlural('dios')).toBe('dioses');
  });

  it('a longer word in unstressed -s is unchanged', () => {
    expect(esPlural('lunes')).toBeNull();
    expect(esPlural('crisis')).toBeNull();
  });

  it('a word in -n without a written accent gets it for the extra syllable (joven → jóvenes)', () => {
    expect(esPlural('joven')).toBe('jóvenes');
    expect(esPlural('examen')).toBe('exámenes');
    expect(esPlural('origen')).toBe('orígenes');
    expect(esPlural('imagen')).toBe('imágenes');
    expect(esPlural('orden')).toBe('órdenes');
    expect(esPlural('volumen')).toBe('volúmenes');
  });

  it('does not stack a second accent on a word that has one already', () => {
    expect(esPlural('régimen')).toBe('régimenes');
  });
});

describe('esFeminine', () => {
  it('stays as it was', () => {
    expect(esFeminine('blanco')).toBe('blanca');
    expect(esFeminine('español')).toBe('española');
    expect(esFeminine('francés')).toBe('francesa');
    expect(esFeminine('joven')).toBeNull();
  });
});

describe('esSuperlativeForms', () => {
  it('the final vowel goes and the four forms follow', () => {
    expect(esSuperlativeForms('alto')).toEqual(['altísimo', 'altísima', 'altísimos', 'altísimas']);
    expect(esSuperlativeForms('grande')).toContain('grandísimo');
    expect(esSuperlativeForms('mucho')).toContain('muchísimo');
    expect(esSuperlativeForms('bueno')).toContain('buenísimo');
  });

  it('the spelling keeps the sound: -co, -go, -ble, -z', () => {
    expect(esSuperlativeForms('rico')).toContain('riquísimo');
    expect(esSuperlativeForms('poco')).toContain('poquísimo');
    expect(esSuperlativeForms('largo')).toContain('larguísimo');
    expect(esSuperlativeForms('amable')).toContain('amabilísimo');
    expect(esSuperlativeForms('feliz')).toContain('felicísimo');
  });

  it('the written accent of the stem goes (the stress moves to -ísimo)', () => {
    expect(esSuperlativeForms('fácil')).toContain('facilísimo');
    expect(esSuperlativeForms('difícil')).toContain('dificilísimo');
    expect(esSuperlativeForms('simpático')).toContain('simpatiquísimo');
    expect(esSuperlativeForms('rápido')).toContain('rapidísimo');
  });

  it('-l and -r words just add -ísimo', () => {
    expect(esSuperlativeForms('azul')).toContain('azulísimo');
    expect(esSuperlativeForms('popular')).toContain('popularísimo');
  });

  it('nothing for the irregular or unused: -io / -ío, comparatives, other consonants', () => {
    expect(esSuperlativeForms('limpio')).toEqual([]);
    expect(esSuperlativeForms('frío')).toEqual([]);
    expect(esSuperlativeForms('antiguo')).toEqual([]);
    expect(esSuperlativeForms('mejor')).toEqual([]);
    expect(esSuperlativeForms('superior')).toEqual([]);
    expect(esSuperlativeForms('joven')).toEqual([]);
    expect(esSuperlativeForms('gris')).toEqual([]);
  });
});
