// isExamTier / examTopicsOnly (lib/grammar/syllabus.ts): the exam tiers are core+, core and exam.
import { examTopicsOnly, getGrammarTier, isExamTier, syllabusForLevel } from '@/lib/grammar/syllabus';

describe('exam tiers', () => {
  it('core-plus, core and exam are exam tiers; full and perfect are not', () => {
    expect(isExamTier('core-plus')).toBe(true);
    expect(isExamTier('core')).toBe(true);
    expect(isExamTier('exam')).toBe(true);
    expect(isExamTier('full')).toBe(false);
    expect(isExamTier('perfect')).toBe(false);
  });

  it('examTopicsOnly drops the full-tier topics and keeps the order', () => {
    const a2 = syllabusForLevel('A2', 'es');
    const kept = examTopicsOnly(a2);
    expect(kept.some((tp) => tp.id === 'diminutivos')).toBe(false);
    expect(kept.every((tp) => isExamTier(getGrammarTier(tp.id)))).toBe(true);
    expect(kept.map((tp) => tp.id)).toEqual(a2.filter((tp) => getGrammarTier(tp.id) !== 'full').map((tp) => tp.id));
  });

  it('A1 hides nothing, and a course with no tier data (en) keeps no topic', () => {
    const a1 = syllabusForLevel('A1', 'es');
    expect(examTopicsOnly(a1)).toHaveLength(a1.length);
    expect(examTopicsOnly(syllabusForLevel('A1', 'en'))).toHaveLength(0);
  });
});
