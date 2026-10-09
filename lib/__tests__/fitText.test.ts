import { fitFontSize, FIT_STEPS } from '../fitText';

// 360 dp-s telefon, 24 + 24 dp kártya-padding és a 🔊 gomb után kb. 226 dp jut a szóra.
const W = 226;

describe('fitFontSize', () => {
  it('a rövid szó marad az alap méreten', () => {
    expect(fitFontSize('hola', { base: 32, width: W })).toBe(32);
  });

  it('a hosszú, törhetetlen szó kisebb lépcsőt kap, mint amennyire kilógna', () => {
    // "(justification)" 15 karakter, 32-es betűn ~300 dp, nem fér 226-ba
    const size = fitFontSize('reason (justification)', { base: 32, width: W });
    expect(size).toBeLessThan(32);
    expect(size * 0.62 * '(justification)'.length).toBeLessThanOrEqual(W);
  });

  it('több szóból álló mondat törik, nem zsugorodik feleslegesen', () => {
    // "they are going to arrive" két-három sorba törhet 32-esen is
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
    // "am / is / are" szóközök nélküli írásban is szétesik a per-jelnél
    expect(fitFontSize('am/is/are/was/were/been', { base: 22, width: 180, maxLines: 3 })).toBe(22);
  });

  it('üres szövegre és 0 szélességre az alapot adja', () => {
    expect(fitFontSize('', { base: 32, width: W })).toBe(32);
    expect(fitFontSize('x', { base: 28, width: 0 })).toBe(28);
  });
});
