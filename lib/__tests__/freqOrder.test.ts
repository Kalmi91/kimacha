// PLAN-freq.md 2. lépés: a kulcs- és rangoló logika (lib/freqOrder.ts)
// minimum 8 esete, ahogy a terv előírja.

import { cardRank, parseFreqList, sortByFreqRank, tokenizeEs } from '../freqOrder';

const FREQ_TEXT = [
  'yo 3',
  'no 5',
  'un 6',
  'una 7',
  'casa 8',
  'recuerdo 10',
  'hablo 20',
  'habla 21',
  'camion 100',
  'grande 9999',
].join('\n');
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

  it('"yo" -> ["yo"] (önmagában névmás, nem esik ki, mert nem maradna más token)', () => {
    expect(tokenizeEs('yo')).toEqual(['yo']);
  });

  it('"un/una" -> ["un", "una"] (önmagában névelő, nem esik ki)', () => {
    expect(tokenizeEs('un/una')).toEqual(['un', 'una']);
  });

  it('"refiero (referir)" -> ["refiero"] (zárójel a tartalmával együtt ki)', () => {
    expect(tokenizeEs('refiero (referir)')).toEqual(['refiero']);
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

  it('önmagában névmás ("yo") véges rangot kap, nem Infinity-t', () => {
    expect(cardRank('yo', index)).toBe(index.exact.get('yo'));
  });

  it('önmagában névelő-pár ("un/una") véges rangot kap, nem Infinity-t', () => {
    expect(cardRank('un/una', index)).toBe(Math.max(index.exact.get('un')!, index.exact.get('una')!));
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
