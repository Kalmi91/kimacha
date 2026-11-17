// The per-level task-type file (data/grammar/task-types.json) and its reader: which level uses which of the 8 task
// types, and which topics are core (read from the syllabus tier, nothing invented here).

import { getGrammarTopics, grammarKindCounts } from '@/lib/games/content';
import { getGrammarTier, syllabusForLevel } from '../syllabus';
import { TASK_TYPE_IDS, coreTopicsForLevel, enabledTaskLevels, exemptErrors, taskConfigForLevel, taskTypeCounts, taskTypeGaps } from '../taskTypes';

describe('task types', () => {
  it('has the 8 types of the spec, in the spec order', () => {
    expect(TASK_TYPE_IDS).toEqual(['choice', 'form', 'transform', 'why', 'opencloze', 'fix', 'bank', 'order']);
  });

  it('every level uses the 8 types and all five levels are switched on (E132, E133, E149)', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      expect(taskConfigForLevel(level).types).toEqual(TASK_TYPE_IDS);
    }
    expect(enabledTaskLevels()).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('indefinido-imperfecto is exempt from the typed form drill: no form gap, and the lesson has no form item', () => {
    expect(taskTypeGaps('A2').some((g) => g.topic === 'indefinido-imperfecto' && g.type === 'form')).toBe(false);
    expect(taskTypeGaps('A2')).toEqual([]);
  });

  it('the exempt list names real topics and types only', () => {
    expect(exemptErrors()).toEqual([]);
    expect(exemptErrors({ nope: ['form'] }, ['ser-estar'])).toEqual(['unknown topic nope']);
    expect(exemptErrors({ 'ser-estar': ['nope'] }, ['ser-estar'])).toEqual(['unknown type nope for ser-estar']);
  });

  it('counts the typed noun form under type 2 (form)', () => {
    const lesson = {
      items: [
        { kind: 'form', id: 'f1', person: 'yo', answer: 'soy' },
        { kind: 'noun', id: 'n1' },
        { kind: 'opencloze', id: 'c1' },
        { kind: 'spot', id: 's1' },
        { id: 'g1', sentence: 'Yo ___ aqui.', options: ['estoy', 'soy'], correct: 0 },
      ],
    } as never;
    const c = taskTypeCounts(lesson);
    expect(c.form).toBe(2);
    expect(c.opencloze).toBe(1);
    expect(c.choice).toBe(1);
    expect(c.fix).toBe(0);
    expect(c.order).toBe(0);
  });

  it('core topics of a level = the syllabus topics whose tier is core or core-plus', () => {
    const core = coreTopicsForLevel('A1');
    expect(core.length).toBeGreaterThan(5);
    for (const id of core) expect(['core', 'core-plus']).toContain(getGrammarTier(id));
    expect(core).toContain('ser-estar');
    expect(core).not.toContain('clases-de-palabras'); // tier exam
    const all = syllabusForLevel('A1').map((t) => t.id);
    expect(all.filter((id) => ['core', 'core-plus'].includes(getGrammarTier(id)))).toEqual(core);
  });

  it('the gap list names every missing (topic, type) of a level, with the count it has', () => {
    // E132 fills the A1 topics one by one: whatever gap is left is a core topic with fewer items than needed
    const gaps = taskTypeGaps('A1');
    for (const g of gaps) {
      expect(coreTopicsForLevel('A1')).toContain(g.topic);
      expect(g.need).toBe(5);
      expect(g.have).toBeLessThan(g.need);
    }
    expect(gaps.some((g) => g.topic === 'ser-estar')).toBe(false); // ser-estar has all 8 types since E132
  });

  it('the sample items: two A1 topics have one of each new type, marked trial', () => {
    const withSamples = getGrammarTopics('es').filter((t) => ['opencloze', 'fix', 'bank', 'noun'].every((k) => grammarKindCounts(t)[k as 'fix'] > 0));
    expect(withSamples.map((t) => t.topic).sort()).toEqual(['adjetivo-concordancia', 'sustantivo-numero']);
    for (const t of withSamples) {
      expect(t.level).toBe('A1');
      const kinds = ['opencloze', 'fix', 'bank', 'noun'];
      const samples = t.items.filter((i) => kinds.includes((i as { kind?: string }).kind ?? ''));
      expect(samples.length).toBeGreaterThanOrEqual(4);
      for (const it of samples) expect((it as { trial?: boolean }).trial).toBe(true);
    }
  });
});
