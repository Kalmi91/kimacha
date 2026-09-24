// PLAN-hibaim.md 2. lépés: validateMistakesPayload against the fixture, plus
// one negative case per rule in the "Formátum" section of PLAN-hibaim.md.

import sample from './__fixtures__/sample.json';
import { validateMistakesPayload } from './format';

describe('validateMistakesPayload', () => {
  it('accepts the sample fixture', () => {
    const result = validateMistakesPayload(sample);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.sentences).toHaveLength(3);
    expect(result.batch.sentences.find((s) => s.id === 's3')?.doubtful).toBe(true);
    expect(result.batch.sentences.find((s) => s.id === 's1')?.doubtful).toBe(false);
    expect(result.batch.words).toHaveLength(2);
    expect(result.batch.wrongWords).toHaveLength(3);
    expect(result.batch.patterns.flatMap((p) => p.drills)).toHaveLength(3);
  });

  it('defaults sentences[].doubtful to false when absent', () => {
    const batch = structuredClone(sample) as any;
    delete batch.sentences[0].doubtful;
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.sentences[0].doubtful).toBe(false);
  });

  it('rejects a non-object payload', () => {
    const result = validateMistakesPayload('not an object');
    expect(result).toEqual({ ok: false, error: 'Not a kimacha-hibaim file' });
  });

  it('rejects the wrong format string', () => {
    const batch = { ...structuredClone(sample), format: 'something-else' };
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unknown format/);
  });

  it('rejects an unsupported version', () => {
    const batch = { ...structuredClone(sample), version: 2 };
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unsupported kimacha-hibaim version/);
  });

  it('rejects a batchId with uppercase letters', () => {
    const batch = { ...structuredClone(sample), batchId: 'Not-Valid' };
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/batchId/);
  });

  it('rejects an empty title', () => {
    const batch = { ...structuredClone(sample), title: '   ' };
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/title/);
  });

  it('rejects a malformed date', () => {
    const batch = { ...structuredClone(sample), date: '23-09-2026' };
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/date/);
  });

  it('rejects an unknown source', () => {
    const batch = { ...structuredClone(sample), source: 'sms' };
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/source/);
  });

  it('rejects a missing array (patterns)', () => {
    const batch = structuredClone(sample) as any;
    delete batch.patterns;
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/patterns must be an array/);
  });

  it('rejects a duplicate id within the same array', () => {
    const batch = structuredClone(sample) as any;
    batch.words.push({ ...batch.words[0] });
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Duplicate id in words/);
  });

  it('allows the same drill id reused in two different patterns', () => {
    // patterns[0].drills[0].id and patterns[1].drills[0].id are both "d1" in
    // the fixture: drill ids are only unique within their own pattern.
    const result = validateMistakesPayload(sample);
    expect(result.ok).toBe(true);
  });

  it('rejects a sentence pattern that references an unknown pattern id', () => {
    const batch = structuredClone(sample) as any;
    batch.sentences[0].pattern = 'no-such-pattern';
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/references unknown pattern/);
  });

  it('does not reject an unknown lessons[] topic id (the app shows "No lesson in the app")', () => {
    const batch = structuredClone(sample) as any;
    batch.patterns[0].lessons = ['not-a-real-topic-id'];
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid wrongWords[].kind', () => {
    const batch = structuredClone(sample) as any;
    batch.wrongWords[0].kind = 'typo';
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/kind must be one of/);
  });

  it('rejects a field longer than 300 characters', () => {
    const batch = structuredClone(sample) as any;
    batch.words[0].en = 'x'.repeat(301);
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/longer than 300 characters/);
  });

  it('rejects an array with more than 500 items', () => {
    const batch = structuredClone(sample) as any;
    batch.words = Array.from({ length: 501 }, (_, i) => ({ id: `w${i}`, es: 'x', en: 'x' }));
    const result = validateMistakesPayload(batch);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/more than 500 items/);
  });

  it('accepts an optional empty note (words[].note)', () => {
    const result = validateMistakesPayload(sample);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.words.find((w) => w.id === 'w1')?.note).toBe('');
  });
});
