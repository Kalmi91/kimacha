import { buildExam } from '../examBuilder';

const PAIR = 'en-es';

function countByKind(items: any[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const it of items) c[it.kind] = (c[it.kind] || 0) + 1;
  return c;
}

function dirKey(it: any): string {
  return it.dir ? `${it.kind}:${it.dir[0]}-${it.dir[1]}` : it.kind;
}

describe('buildExam A0 (spec §5 — 17 items)', () => {
  it('returns exactly 17 items, stable across many runs', () => {
    for (let i = 0; i < 25; i++) {
      expect(buildExam('A0', PAIR)).toHaveLength(17);
    }
  });

  it('matches the §5 type + direction composition', () => {
    const items = buildExam('A0', PAIR);
    const k = countByKind(items);
    expect(k.word_type).toBe(5);
    expect(k.sent_order).toBe(8);
    expect(k.sent_type).toBe(4);

    const d: Record<string, number> = {};
    for (const it of items) d[dirKey(it)] = (d[dirKey(it)] || 0) + 1;
    expect(d['word_type:es-en']).toBe(3);
    expect(d['word_type:en-es']).toBe(2);
    expect(d['sent_order:es-en']).toBe(5);
    expect(d['sent_order:en-es']).toBe(3);
    expect(d['sent_type:en-es']).toBe(2);
    expect(d['sent_type:es-en']).toBe(2);
  });

  it('never repeats a prompt within one exam (§177)', () => {
    for (let i = 0; i < 10; i++) {
      const prompts = buildExam('A0', PAIR)
        .filter((it: any) => it.prompt)
        .map((it: any) => it.prompt);
      expect(new Set(prompts).size).toBe(prompts.length);
    }
  });

  it('sent_order: answer tokens non-empty and distractors never overlap the answer', () => {
    const sentOrders = (buildExam('A0', PAIR) as any[]).filter((it) => it.kind === 'sent_order');
    expect(sentOrders).toHaveLength(8);
    for (const it of sentOrders) {
      expect(it.answerTokens.length).toBeGreaterThan(0);
      const answer = new Set(it.answerTokens.map((t: string) => t.toLowerCase()));
      for (const d of it.distractors) {
        expect(answer.has(d.toLowerCase())).toBe(false);
      }
    }
  });
});

describe('buildExam A1 (spec §7 — 35 items, exam-realistic mix)', () => {
  it('returns exactly 35 items (20 generated + 15 authored), stable across many runs', () => {
    for (let i = 0; i < 25; i++) {
      expect(buildExam('A1', PAIR)).toHaveLength(35);
    }
  });

  it('matches the exam-realistic composition (20 generated + 15 authored)', () => {
    const k = countByKind(buildExam('A1', PAIR));
    expect(k.word_type).toBe(6);
    expect(k.sent_order).toBe(10);
    expect(k.sent_type).toBe(4);
    expect(k.gap_mc).toBe(6);
    expect(k.match).toBe(3);
    expect(k.reading_mc).toBe(6);
  });

  it('never repeats a prompt within the generated (drill) part', () => {
    for (let i = 0; i < 10; i++) {
      const prompts = buildExam('A1', PAIR)
        .filter((it: any) => it.prompt)
        .map((it: any) => it.prompt);
      expect(new Set(prompts).size).toBe(prompts.length);
    }
  });

  it('authored items are distinct within one exam (no repeated gap / reading)', () => {
    for (let i = 0; i < 10; i++) {
      const items = buildExam('A1', PAIR) as any[];
      const gaps = items.filter((it) => it.kind === 'gap_mc').map((it) => it.sentence);
      const reads = items.filter((it) => it.kind === 'reading_mc').map((it) => it.text);
      expect(new Set(gaps).size).toBe(gaps.length);
      expect(new Set(reads).size).toBe(reads.length);
    }
  });
});

describe('buildExam guards', () => {
  it('returns an empty array for an unsupported level', () => {
    expect(buildExam('B1' as any, PAIR)).toHaveLength(0);
  });
});
