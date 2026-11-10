// isExamTier (lib/grammar/syllabus.ts): the exam tiers are core+, core and exam.
import { getGrammarTier, isExamTier, syllabusForLevel } from '@/lib/grammar/syllabus';

describe('exam tiers', () => {
  it('core-plus, core and exam are exam tiers; full and perfect are not', () => {
    expect(isExamTier('core-plus')).toBe(true);
    expect(isExamTier('core')).toBe(true);
    expect(isExamTier('exam')).toBe(true);
    expect(isExamTier('full')).toBe(false);
    expect(isExamTier('perfect')).toBe(false);
  });

  it('every A1 topic of the Spanish course is an exam topic (so an exam filter hid nothing there, FB640)', () => {
    const a1 = syllabusForLevel('A1', 'es');
    expect(a1.length).toBeGreaterThan(0);
    expect(a1.every((tp) => isExamTier(getGrammarTier(tp.id)))).toBe(true);
  });

  it('A2 has topics beyond the exam (the tag is only on the others)', () => {
    expect(syllabusForLevel('A2', 'es').some((tp) => !isExamTier(getGrammarTier(tp.id)))).toBe(true);
  });
});