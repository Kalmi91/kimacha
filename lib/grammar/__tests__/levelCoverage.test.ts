// The level test's coverage over the real course data (FB595, FB597, FB598). With LEVEL_COVERAGE_REPORT=1 it prints the
// per-topic table (scripts/level-coverage.mjs); the assertions are the picker's coverage promises, on A1 and on every other
// level of every course with the same rule (no per-level special case).

import { getGrammarTier, syllabusLevels } from '@/lib/grammar/syllabus';
import { emptyTopics, levelData, playAll, simulate } from '@/lib/grammar/levelCoverage';
import { TICK_MIN_ANSWERS } from '@/lib/grammar/randomRound';

jest.setTimeout(240000);

const REPORT = process.env.LEVEL_COVERAGE_REPORT === '1';
const LEARNERS = [
  ['always right', 1],
  ['70% right', 0.7],
] as const;
const isCoreId = (id: string) => ['core', 'core-plus'].includes(getGrammarTier(id));

describe('level test coverage over the real es A1 course', () => {
  const d = levelData('es', 'A1');
  const seed = 7;

  it('report', () => {
    if (!REPORT) return;
    const lines: string[] = [];
    for (const [name, p] of LEARNERS) {
      const r = simulate(d, 'A1', p, seed);
      lines.push(`## ${name}`, 'topic | tier | avail | @20 | @40 | @100 | @500');
      for (const t of r.topics) lines.push(`${t.id} | ${t.tier} | ${t.available} | ${t.asked.join(' | ')}`);
      lines.push(`early repeats: ${r.earlyRepeats.map((e) => `${e.topicId}@${e.step}/${e.available}`).join(', ') || 'none'}`);
    }
    const pl = playAll(d, 'A1', seed);
    lines.push(`## play: ${pl.played} questions, ${pl.failures.length} failures`);
    for (const f of pl.failures) lines.push(`${f.topicId} ${f.qid} ${f.kind}: ${f.reasons.join('; ')}`);
    lines.push(`## empty topics: ${emptyTopics(d, 'es', 'A1').map((e) => `${e.id} (${e.reason})`).join(', ') || 'none'}`);
    process.stdout.write(`\n${lines.join('\n')}\n`);
  });

  it('every A1 question plays: a prompt, its own right answer accepted, wrong options rejected', () => {
    const pl = playAll(d, 'A1', seed);
    expect(pl.played).toBeGreaterThan(100);
    expect(pl.failures).toEqual([]);
  });

  it('every A1 syllabus topic has a lesson with usable questions', () => {
    expect(emptyTopics(d, 'es', 'A1')).toEqual([]);
  });

  it.each(LEARNERS)('%s: all core topics are asked within the first two rounds (40 answers), spread within 3 until each had the answers a tick needs', (_n, p) => {
    const r = simulate(d, 'A1', p, seed, 300);
    const core = r.topics.filter((t) => isCoreId(t.id)).map((t) => t.id);
    expect(core.length).toBeGreaterThan(10);
    const first40 = new Set(r.steps.slice(0, 40).map((s) => s.topicId));
    expect(core.filter((id) => !first40.has(id))).toEqual([]);
    const counts = new Map(core.map((id) => [id, 0]));
    for (const s of r.steps) {
      if (core.every((id) => counts.get(id)! >= TICK_MIN_ANSWERS)) break;
      if (counts.has(s.topicId)) counts.set(s.topicId, counts.get(s.topicId)! + 1);
      const v = [...counts.values()];
      expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(3);
    }
  });

  it.each(LEARNERS)('%s: no question comes back before all questions of its topic were asked, over 500 answers', (_n, p) => {
    expect(simulate(d, 'A1', p, seed).earlyRepeats).toEqual([]);
  });

  it('after the core topics the others are asked too, and every topic gets questions over 500 answers', () => {
    for (const [, p] of LEARNERS) {
      const r = simulate(d, 'A1', p, seed);
      expect(r.topics.filter((t) => t.asked[3] === 0).map((t) => t.id)).toEqual([]);
    }
  });
});

describe.each(['es', 'en', 'hu', 'de'])('the same rules on every level of the real %s course', (lang) => {
  it.each(syllabusLevels(lang))('%s: core first, even, no early repeat', (lvl) => {
    const d = levelData(lang, lvl);
    for (const [, p] of LEARNERS) {
      const r = simulate(d, lvl, p, 3, 200);
      const core = r.topics.filter((t) => isCoreId(t.id)).map((t) => t.id);
      const window = Math.min(40, r.steps.length);
      const asked = new Set(r.steps.slice(0, window).map((s) => s.topicId));
      // a level with more core topics than two rounds hold: the first rounds are core topics only
      if (core.length <= 40) expect(core.filter((id) => !asked.has(id))).toEqual([]);
      else expect(r.steps.slice(0, window).every((s) => core.includes(s.topicId))).toBe(true);
      const counts = new Map(core.map((id) => [id, 0]));
      for (const s of r.steps) {
        if (core.every((id) => counts.get(id)! >= TICK_MIN_ANSWERS)) break;
        if (counts.has(s.topicId)) counts.set(s.topicId, counts.get(s.topicId)! + 1);
        const v = [...counts.values()];
        expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(3);
      }
      expect(r.earlyRepeats).toEqual([]);
    }
  });
});
