// PLAN-freq.md 2. lépés: a kulcs- és rangoló logika (lib/freqOrder.ts)
// minimum 8 esete, ahogy a terv előírja.

import { cardRank, parseFreqList, sortByFreqRank, tokenizeEs } from '../freqOrder';

const FREQ_TEXT = ['no 5', 'casa 8', 'recuerdo 10', 'hablo 20', 'habla 21', 'camion 100', 'grande 9999'].join('\n');
const index = parseFreqList(FREQ_TEXT);

describe('tokenizeEs', () => {
  it('"el recuerdo" -> ["recuerdo"] (névelő ki)', () => {
    expect(tokenizeEs('el recuerdo')).toEqual(['recuerdo']);
  });

  it('"yo hablo" -> ["hablo"] (alanyi névmás ki)', () => {
    expect(tokenizeEs('yo hablo')).toEqual(['hablo']);
  });

  it('"él/ella habla" -> ["habla"] (két névmás, "/"-vágás)', () => {
    expect(tokenizeEs('él/ella habla')).toEqual(['habla']);
  });

  it('"no" -> ["no"] (nem névelő/névmás, megmarad)', () => {
    expect(tokenizeEs('no')).toEqual(['no']);
  });
});

describe('cardRank', () => {
  it('többszavas kifejezés = a legrosszabb (legnagyobb) token-rang', () => {
    expect(cardRank('casa grande', index)).toBe(index.exact.get('grande'));
  });

  it('ékezet-hajtogatott egyezés, ha a pontos alak nincs a listán', () => {
    expect(cardRank('el camión', index)).toBe(index.exact.get('camion'));
  });

  it('ismeretlen token -> Infinity', () => {
    expect(cardRank('el ornitorrinco', index)).toBe(Infinity);
  });
});

describe('sortByFreqRank', () => {
  it('stabil rendezés: azonos (Infinity is) rangúak eredeti sorrendben maradnak', () => {
    const cards = [
      { id: 1, es: 'no' }, // rank 5
      { id: 2, es: 'desconocidoUno' }, // Infinity
      { id: 3, es: 'desconocidoDos' }, // Infinity
      { id: 4, es: 'casa' }, // rank 8
    ];
    expect(sortByFreqRank(cards, index).map((c) => c.id)).toEqual([1, 4, 2, 3]);
  });
});
