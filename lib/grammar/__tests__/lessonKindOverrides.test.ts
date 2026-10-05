// FB469 (PLAN-fb1005a): indefinido-imperfecto has no `form` drill ("ez a feladat típus ide nem kell").

import { lessonFor } from '../syllabus';
import { grammarKindCounts } from '../../games/content';

describe('indefinido-imperfecto (FB469)', () => {
  const lesson = lessonFor('es', 'indefinido-imperfecto')!;

  it('has no form items, so no form drill button', () => {
    expect(lesson.items.some((i) => i.kind === 'form')).toBe(false);
    expect(grammarKindCounts(lesson).form).toBe(0);
  });

  it('keeps its other drills', () => {
    const counts = grammarKindCounts(lesson);
    expect(counts.choice).toBeGreaterThan(0);
    expect(counts.match).toBeGreaterThan(0);
    expect(counts.why).toBeGreaterThan(0);
    expect(counts.transform).toBeGreaterThan(0);
  });
});
