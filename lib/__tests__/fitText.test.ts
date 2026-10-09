import { fitFontSize, FIT_STEPS } from '../fitText';

// On a 360 dp phone, after 24 + 24 dp of card padding and the 🔊 button, about 226 dp is left for the word.
const W = 226;

describe('fitFontSize', () => {
  it('a rövid szó marad az alap méreten', () => {
    expect(fitFontSize('hola', { base: 32, width: W })).toBe(32);
  });

  it('a hosszú, törhetetlen szó kisebb lépcsőt kap, mint amennyire kilógna', () => {
    // "(justification)" is 15 characters, ~300 dp at font size 32, does not fit into 226
    const size = fitFontSize('reason (justification)', { base: 32, width: W });
    expect(size).toBeLessThan(32);
    expect(size * 0.62 * '(justification)'.length).toBeLessThanOrEqual(W);
  });

  it('több szóból álló mondat törik, nem zsugorodik feleslegesen', () => {
    // "they are going to arrive" may break into two or three lines even at 32
    expect(fitFontSize('they are going to arrive', { base: 32, width: W, maxLines: 3 })).toBe(32);
  });

  it('a maxLines szűkít: ugyanaz a mondat 1 sorra kisebb betűt kap', () => {
    const one = fitFontSize('they are going to arrive', { base: 32, width: W, maxLines: 1 });
    expect(one).toBeLessThan(32);
  });

  it('a rendszer-betűméret szorzója kisebb lépcsőt ad', () => {
    const normal = fitFontSize('justification', { base: 32, width: W, fontScale: 1 });
    const big = fitFontSize('justification', { base: 32, width: W, fontScale: 1.5 });
    expect(big).toBeLessThanOrEqual(normal);
  });

  it('nem megy a min alá, és lépcsőn marad', () => {
    const size = fitFontSize('anticonstitucionalmente'.repeat(3), { base: 32, width: 100, min: 14 });
    expect(size).toBe(14);
    expect(FIT_STEPS as readonly number[]).toContain(size);
  });

  it('per-jelnél és kötőjelnél is törik', () => {
    // "am / is / are" breaks apart at the slash even when written without spaces
    expect(fitFontSize('am/is/are/was/were/been', { base: 22, width: 180, maxLines: 3 })).toBe(22);
  });

  it('üres szövegre és 0 szélességre az alapot adja', () => {
    expect(fitFontSize('', { base: 32, width: W })).toBe(32);
    expect(fitFontSize('x', { base: 28, width: 0 })).toBe(28);
  });
});
