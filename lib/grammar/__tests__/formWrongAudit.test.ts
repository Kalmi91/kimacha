// The form-item `wrong` audit of scripts/audit-form-wrong.mjs (P1: a key that is the right answer).
import { normTyped } from '../resultDetail';

const { wrongKeyViolations, wrongCount, normTyped: auditNorm } = require('../../../scripts/formWrongAudit.cjs');

const text = { en: 'x', es: 'x' };
const lesson = (items: unknown[]) => ({ topic: 't', level: 'A1', items });

describe('form wrong-key audit', () => {
  it('uses the same normalization as the typed-answer lookup', () => {
    for (const s of ['Rápidamente', ' me  GUSTA ', 'lección', 'jóvenes', 'a la izquierda del']) {
      expect(auditNorm(s)).toBe(normTyped(s));
    }
  });

  it('accepts real mistakes', () => {
    const l = lesson([{ id: 'a', kind: 'form', answer: 'hago', wrong: { haco: text, hazo: text } }]);
    expect(wrongKeyViolations(l)).toEqual([]);
  });

  it('fails a key that is the right answer after normalization (accents, case, spaces)', () => {
    const l = lesson([{ id: 'a', kind: 'form', answer: 'lección', wrong: { LECCION: text } }]);
    expect(wrongKeyViolations(l)).toHaveLength(1);
    const l2 = lesson([{ id: 'b', kind: 'form', answer: 'me gusta', wrong: { 'me  gústa': text } }]);
    expect(wrongKeyViolations(l2)[0]).toMatch(/equals the right answer/);
  });

  it('fails an empty key and two keys that normalize the same', () => {
    const l = lesson([{ id: 'a', kind: 'form', answer: 'x', wrong: { ' ': text, jóvens: text, jovens: text } }]);
    const msgs = wrongKeyViolations(l);
    expect(msgs.some((m: string) => m.includes('is empty'))).toBe(true);
    expect(msgs.some((m: string) => m.includes('same key'))).toBe(true);
  });

  it('ignores items without a wrong map and other kinds', () => {
    const l = lesson([
      { id: 'a', kind: 'form', answer: 'x' },
      { id: 'b', kind: 'choice', answer: 'x', wrong: { x: text } },
    ]);
    expect(wrongKeyViolations(l)).toEqual([]);
  });

  it('counts the form items with a wrong map', () => {
    const l = lesson([
      { id: 'a', kind: 'form', answer: 'x', wrong: { y: text } },
      { id: 'b', kind: 'form', answer: 'x' },
      { id: 'c', kind: 'choice' },
    ]);
    expect(wrongCount(l)).toEqual({ total: 2, withWrong: 1 });
  });
});
