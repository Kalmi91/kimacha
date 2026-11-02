import { esFeminine, esPlural } from '../esInflect';

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
