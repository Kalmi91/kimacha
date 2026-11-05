// The level test's coverage over the real course data (FB595, FB597, FB598). With LEVEL_COVERAGE_REPORT=1 it prints the
// per-topic table (scripts/level-coverage.mjs); the assertions are the picker's coverage promises, on A1 and on every other
// level of every course with the same rule (no per-level special case): core topics strictly first and taking turns, then the
// other tiers, no question before all questions of its topic were asked.

import { getGrammarTier, syllabusLevels } from '@/lib/grammar/syllabus';
import { emptyTopics, levelData, playAll, simulate, unevenStart, type SimResult } from '@/lib/grammar/levelCoverage';
import { TICK_MIN_ANSWERS } from '@/lib/grammar/randomRound';

jest.setTimeout(240000);

const REPORT = process.env.LEVEL_COVERAGE_REPORT === '1';
const LEARNERS = [
  ['always right', 1],
  ['70% right', 0.7],
  ['always wrong', 0],
] as const;
const isCoreId = (id: string) => ['core', 'core-plus'].includes(getGrammarTier(id));

/** The core promises on one simulated run. */
function expectCoreFirst(r: SimResult, spread: number) {
  const core = r.topics.filter((t) => isCoreId(t.id)).map((t) => t.id);
  // strictly core first: while a core topic is open nothing else is asked
  expect(r.steps.filter((s) => s.coreOpen && !isCoreId(s.topicId)).map((s) => s.topicId)).toEqual([]);
  // every core topic within the first two rounds (a level with more core topics than two rounds hold: only core topics in them)
  const window = Math.min(40, r.steps.length);
  const asked = new Set(r.steps.slice(0, window).map((s) => s.topicId));
  if (core.length <= 40) expect(core.filter((id) => !asked.has(id))).toEqual([]);
  else expect(r.steps.slice(0, window).every((s) => core.includes(s.topicId))).toBe(true);
  // the asked counts stay close until every core topic had the answers a tick needs
  const counts = new Map(core.map((id) => [id, 0]));
  for (const s of r.steps) {
    if (core.every((id) => counts.get(id)! >= TICK_MIN_ANSWERS)) break;
    if (counts.has(s.topicId)) counts.set(s.topicId, counts.get(s.topicId)! + 1);
    const v = [...counts.values()];
    expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(spread);
  }
  // never the same topic twice in a row while another one exists
  r.steps.slice(1).forEach((s, i) => {
    if (s.pool > 1) expect(s.topicId).not.toBe(r.steps[i].topicId);
  });
}

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

  it.each(LEARNERS)('%s: core strictly first, within two rounds, even, no question twice before all were asked (500 answers)', (_n, p) => {
    const r = simulate(d, 'A1', p, seed);
    expect(r.topics.filter((t) => isCoreId(t.id)).length).toBeGreaterThan(10);
    expectCoreFirst(r, 3);
    expect(r.earlyRepeats).toEqual([]);
  });

  it('a learner who never ticks a core topic: the core topics rotate with at most 1 between them, no other tier is asked, no topic is stuck', () => {
    const r = simulate(d, 'A1', 0, seed, 300);
    const core = r.topics.filter((t) => isCoreId(t.id)).map((t) => t.id);
    const counts = new Map(core.map((id) => [id, 0]));
    for (const s of r.steps) {
      expect(isCoreId(s.topicId)).toBe(true);
      counts.set(s.topicId, counts.get(s.topicId)! + 1);
      const v = [...counts.values()];
      expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(1);
    }
    expect(Math.min(...counts.values())).toBeGreaterThanOrEqual(Math.floor(300 / core.length) - 1);
  });

  it('after the core topics are ticked the other tiers come: an always right learner gets every A1 topic within 500 answers', () => {
    const r = simulate(d, 'A1', 1, seed);
    expect(r.topics.filter((t) => t.asked[3] === 0).map((t) => t.id)).toEqual([]);
    const firstNonCore = r.steps.findIndex((s) => !isCoreId(s.topicId));
    expect(firstNonCore).toBeGreaterThan(0);
    expect(r.steps.slice(0, firstNonCore).every((s) => isCoreId(s.topicId))).toBe(true);
  });

  it.each(LEARNERS)('%s: a returning learner (one topic never asked, the others with stored answers) gets that topic first and no burst on one topic', (_n, p) => {
    const start = unevenStart(d, 'A1', seed);
    const r = simulate(d, 'A1', p, seed, 120, { start });
    const first = r.topics.find((t) => isCoreId(t.id))!.id;
    expect(start.has(first)).toBe(false);
    expect(r.steps[0].topicId).toBe(first);
    const core = r.topics.filter((t) => isCoreId(t.id)).length;
    const counts = new Map<string, number>();
    r.steps.slice(0, 40).forEach((s) => counts.set(s.topicId, (counts.get(s.topicId) ?? 0) + 1));
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(Math.ceil(40 / core) + 1);
    expect(r.steps.filter((s) => s.coreOpen && !isCoreId(s.topicId))).toEqual([]);
    expect(r.earlyRepeats).toEqual([]);
  });

  it.each(LEARNERS)('%s: leaving and coming back every 10 answers (new seed, new question cache, no previous topic) keeps the rules', (_n, p) => {
    const r = simulate(levelData('es', 'A1'), 'A1', p, seed, 200, { visitEvery: 10 });
    expectCoreFirst({ ...r, steps: r.steps }, 3);
    expect(r.earlyRepeats).toEqual([]);
  });
});

describe.each(['es', 'en', 'hu', 'de'])('the same rules on every level of the real %s course', (lang) => {
  it.each(syllabusLevels(lang))('%s: core strictly first, even, no early repeat', (lvl) => {
    for (const [, p] of LEARNERS) {
      const r = simulate(levelData(lang, lvl), lvl, p, 3, 200);
      expectCoreFirst(r, 3);
      expect(r.earlyRepeats).toEqual([]);
    }
  });
});
