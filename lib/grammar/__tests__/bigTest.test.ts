import {
  BIG_TEST_FAIL,
  BIG_TEST_FOLLOW,
  BIG_TEST_LEVELS,
  BIG_TEST_MAIN,
  BIG_TEST_PASS,
  BIG_TEST_QUICK,
  answerBigTest,
  bigTestItems,
  bigTestLevelPassed,
  bigTestLevelScore,
  bigTestOptionOrder,
  bigTestPool,
  bigTestProgress,
  bigTestQuestionNumber,
  bigTestStepFill,
  bigTestResult,
  bigTestResultKey,
  bigTestRunKey,
  continueBigTest,
  currentBigTestItem,
  finishBigTest,
  hasBigTest,
  loadBigTestResult,
  loadBigTestRun,
  markBigTestMistyped,
  newBigTestRun,
  nextBigTest,
  parseBigTestRun,
  saveBigTestRun,
  type BigTestItem,
  type BigTestLevel,
  type BigTestRun,
} from '../bigTest';
import { getDb } from '@/lib/database.web';
import { saveResumeValue } from '@/lib/resumeStore';

// The logic tests play on their own small sample sets, so the growth of the real data set cannot break them.
function makePool(shape: Partial<Record<BigTestLevel, [number, number]>>): BigTestItem[] {
  const items: BigTestItem[] = [];
  for (const level of BIG_TEST_LEVELS) {
    const [topics, per] = shape[level] ?? [0, 0];
    for (let t = 0; t < topics; t++) {
      for (let i = 0; i < per; i++) {
        items.push({ id: `${level}-t${t}-${i}`, level, topic: `${level}-t${t}`, kind: 'gap', lines: ['x ___'], options: ['a', 'b', 'c', 'd'], correct: (t + i) % 4, why: '' });
      }
    }
  }
  return items;
}
const all = (topics: number, per: number) => ({ A1: [topics, per], A2: [topics, per], B1: [topics, per], B2: [topics, per], C1: [topics, per] }) as Record<BigTestLevel, [number, number]>;
const rich = makePool(all(9, 3)); // 27 items a level: follow-ups exist
const thin = makePool(all(9, 1)); // 9 items a level, 9 topics: no follow-up item left
const oneSpare = makePool(all(9, 2)); // one spare item per topic

type How = 'R' | 'W' | 'I';
const pickFor = (item: BigTestItem, how: How): number | null => (how === 'R' ? item.correct : how === 'I' ? null : (item.correct + 1) % 4);
const cur = (r: BigTestRun, pool: BigTestItem[]) => currentBigTestItem(r, pool)!;
const step = (r: BigTestRun, pool: BigTestItem[], how: How) => nextBigTest(answerBigTest(r, cur(r, pool), pickFor(cur(r, pool), how)), pool);
const steps = (r: BigTestRun, pool: BigTestItem[], hows: string) => [...hows].reduce((acc, h) => step(acc, pool, h as How), r);
const answerOnly = (r: BigTestRun, pool: BigTestItem[], how: How) => answerBigTest(r, cur(r, pool), pickFor(cur(r, pool), how));
const untilEnd = (r: BigTestRun, pool: BigTestItem[], how: How) => {
  let run = r;
  for (let i = 0; i < 200 && run.phase === 'question'; i++) run = step(run, pool, how);
  return run;
};
const fresh = (pool: BigTestItem[], seed = 1) => newBigTestRun(pool, seed);

describe('big test thresholds', () => {
  it('keeps the rule in constants: 9 main, 7 to pass, 3 to fail, 5 to move up fast, 2 follow-ups', () => {
    expect([BIG_TEST_MAIN, BIG_TEST_PASS, BIG_TEST_FAIL, BIG_TEST_QUICK, BIG_TEST_FOLLOW]).toEqual([9, 7, 3, 5, 2]);
  });

  it('has data for Spanish only', () => {
    expect(hasBigTest('es')).toBe(true);
    expect(hasBigTest('en')).toBe(false);
    expect(bigTestItems('en', 'A1')).toEqual([]);
    expect(bigTestPool('en')).toEqual([]);
    expect(bigTestItems('es', 'A1').length).toBeGreaterThan(0);
  });
});

describe('big test question choice', () => {
  it('picks 9 main questions for a level, each from a different topic when there are enough topics', () => {
    const r = fresh(rich);
    expect(r).toMatchObject({ v: 2, levelIdx: 0, pos: 0, phase: 'question', answers: [] });
    expect(r.queue).toHaveLength(9);
    expect(r.queue.every((q) => !q.follow)).toBe(true);
    const items = r.queue.map((q) => rich.find((it) => it.id === q.id)!);
    expect(new Set(items.map((it) => it.topic)).size).toBe(9);
    expect(items.every((it) => it.level === 'A1')).toBe(true);
  });

  it('repeats the topics in turn when a level has fewer than 9 topics', () => {
    const pool = makePool({ ...all(9, 3), A1: [3, 4] });
    const topics = fresh(pool).queue.map((q) => pool.find((it) => it.id === q.id)!.topic);
    expect(topics).toHaveLength(9);
    expect(['A1-t0', 'A1-t1', 'A1-t2'].map((tp) => topics.filter((x) => x === tp).length)).toEqual([3, 3, 3]);
  });

  it('takes fewer than 9 when the level has fewer items', () => {
    const pool = makePool({ ...all(9, 3), A1: [5, 1] });
    expect(fresh(pool).queue).toHaveLength(5);
  });

  it('is repeatable from the seed and different from another seed', () => {
    expect(fresh(rich, 7)).toEqual(fresh(rich, 7));
    expect(fresh(rich, 1).queue).not.toEqual(fresh(rich, 2).queue);
    // the order of the options follows the seed too
    const item = rich[0];
    const orders = [1, 2, 3, 4, 5, 6].map((s) => bigTestOptionOrder(fresh(rich, s), item).join(''));
    expect(new Set(orders).size).toBeGreaterThan(1);
    expect(bigTestOptionOrder(fresh(rich, 1), item)).toEqual(bigTestOptionOrder(fresh(rich, 1), item));
  });

  it('shuffles the options as a permutation; the "which" question keeps its fixed four choices', () => {
    for (const s of [1, 2, 3]) {
      expect([...bigTestOptionOrder(fresh(rich, s), rich[0])].sort()).toEqual([0, 1, 2, 3]);
    }
    const which: BigTestItem = { id: 'w', level: 'A1', topic: 'x', kind: 'which', lines: ['a', 'b'], correct: 2, why: '' };
    expect(bigTestOptionOrder(fresh(rich, 4), which)).toEqual([0, 1, 2, 3]);
  });
});

describe('big test level rule', () => {
  it('moves up fast: the first 5 main answers all right pass the level', () => {
    let r = steps(fresh(thin), thin, 'RRRR');
    expect(r.phase).toBe('question');
    r = step(r, thin, 'R');
    expect(r.phase).toBe('levelEnd');
    expect(bigTestLevelScore(r, 'A1')).toEqual({ right: 5, total: 5, taken: true });
    expect(bigTestLevelPassed(r, 'A1')).toBe(true);
    const moved = continueBigTest(r, thin);
    expect(moved).toMatchObject({ levelIdx: 1, pos: 0, phase: 'question' });
    expect(moved.queue).toHaveLength(9);
    expect(moved.answers).toHaveLength(5);
  });

  it('5 right that are not the first 5 do not pass fast; 7 right in all pass', () => {
    // 4 right, 1 wrong: the quick rule does not apply
    let r = steps(fresh(thin), thin, 'RRRRW');
    expect(r.phase).toBe('question');
    r = steps(r, thin, 'RR');
    expect(r.phase).toBe('question');
    r = step(r, thin, 'R');
    expect(r.phase).toBe('levelEnd');
    expect(bigTestLevelScore(r, 'A1')).toEqual({ right: 7, total: 8, taken: true });
    expect(bigTestLevelPassed(r, 'A1')).toBe(true);
  });

  it('7 right passes even after an early wrong answer', () => {
    let r = steps(fresh(thin), thin, 'WRRRRRR');
    expect(r.phase).toBe('question');
    r = step(r, thin, 'R');
    expect(r.phase).toBe('levelEnd');
    expect(bigTestLevelScore(r, 'A1')).toEqual({ right: 7, total: 8, taken: true });
    expect(bigTestLevelPassed(r, 'A1')).toBe(true);
  });

  it('fails at the 3rd wrong main answer: the level ends at once and only "finish" is possible', () => {
    let r = steps(fresh(thin), thin, 'WW');
    expect(r.phase).toBe('question');
    r = step(r, thin, 'W');
    expect(r.phase).toBe('levelEnd');
    expect(bigTestLevelScore(r, 'A1')).toEqual({ right: 0, total: 3, taken: true });
    expect(bigTestLevelPassed(r, 'A1')).toBe(false);
    expect(continueBigTest(r, thin)).toBe(r);
    const done = finishBigTest(r);
    expect(done.phase).toBe('result');
    expect(bigTestResult(done).level).toBe('A1');
    expect(bigTestLevelScore(r, 'A2').taken).toBe(false);
  });

  it('a small level that runs out of main questions passes with fewer than 3 wrong', () => {
    const pool = makePool({ ...all(9, 1), A1: [4, 1] });
    const r = steps(fresh(pool), pool, 'RRRW');
    expect(r.phase).toBe('levelEnd');
    expect(bigTestLevelPassed(r, 'A1')).toBe(true);
    const bad = steps(fresh(pool), pool, 'WRWR');
    expect(bad.phase).toBe('levelEnd');
    expect(bigTestLevelPassed(bad, 'A1')).toBe(true);
    expect(bigTestLevelPassed(steps(fresh(pool), pool, 'WWW'), 'A1')).toBe(false);
  });

  it('continues only after a passed level; nothing moves from the wrong phase', () => {
    const ended = steps(fresh(thin), thin, 'RRRRR');
    const moved = continueBigTest(ended, thin);
    expect(continueBigTest(moved, thin)).toBe(moved);
    expect(finishBigTest(moved)).toBe(moved);
    expect(nextBigTest(moved, thin)).toBe(moved);
    expect(answerBigTest(answerOnly(moved, thin, 'R'), cur(moved, thin), 0)).toEqual(answerOnly(moved, thin, 'R'));
  });

  it('does not continue past C1', () => {
    let r = fresh(thin);
    for (const level of BIG_TEST_LEVELS) {
      r = untilEnd(r, thin, 'R');
      expect(r.phase).toBe('levelEnd');
      expect(bigTestLevelPassed(r, level)).toBe(true);
      if (level !== 'C1') r = continueBigTest(r, thin);
    }
    expect(continueBigTest(r, thin)).toBe(r);
    expect(bigTestResult(finishBigTest(r)).level).toBe('C1');
  });

  it('"I don\'t know" is wrong and cannot be marked as mistyped', () => {
    const run = answerOnly(fresh(thin), thin, 'I');
    expect(run.answers[0]).toMatchObject({ picked: null, right: false });
    expect(markBigTestMistyped(run)).toBe(run);
  });
});

// plays the level: the i-th main question gets mains[i], the j-th follow-up follows[j]; stops where a sequence runs out
function drive(r: BigTestRun, pool: BigTestItem[], mains: string, follows = ''): BigTestRun {
  let run = r;
  let mi = 0;
  let fi = 0;
  while (run.phase === 'question') {
    if (run.queue[run.pos].follow) {
      if (fi >= follows.length) break;
      run = step(run, pool, follows[fi++] as How);
    } else {
      if (mi >= mains.length) break;
      run = step(run, pool, mains[mi++] as How);
    }
  }
  return run;
}
const followIdx = (r: BigTestRun) => r.queue.map((q, i) => (q.follow ? i : -1)).filter((i) => i >= 0);

describe('big test follow-up questions', () => {
  it('a wrong main answer schedules 2 follow-ups of its topic among the next 5 questions: not right away, not in a row', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let r = answerOnly(fresh(rich, seed), rich, 'W');
      const topic = r.answers[0].topic;
      r = nextBigTest(r, rich);
      expect(r.answers[0].due).toBe(2);
      const idx = followIdx(r);
      expect(idx).toHaveLength(2);
      // the question on screen now is slot 1: a main question; the follow-ups sit in slots 2 to 5, with a question between
      expect(r.queue[r.pos].follow).toBeUndefined();
      expect(idx[0]).toBeGreaterThanOrEqual(r.pos + 1);
      expect(idx[1]).toBeLessThanOrEqual(r.pos + 4);
      expect(idx[1] - idx[0]).toBeGreaterThanOrEqual(2);
      const items = idx.map((i) => rich.find((it) => it.id === r.queue[i].id)!);
      expect(items.every((it) => it.topic === topic && it.level === 'A1')).toBe(true);
      expect(idx.every((i) => r.queue[i].of === r.answers[0].itemId)).toBe(true);
      const mainIds = r.queue.filter((q) => !q.follow).map((q) => q.id);
      expect(items.some((it) => mainIds.includes(it.id) || it.id === r.answers[0].itemId)).toBe(false);
      expect(items[0].id).not.toBe(items[1].id);
    }
  });

  it('a late wrong main answer (7th or 8th) still keeps its two follow-ups apart, and not right after the mistake', () => {
    for (const mains of ['WRRRRRW', 'WRRRRRRW']) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        let r = drive(fresh(rich, seed), rich, mains.slice(0, -1), 'RR');
        r = answerOnly(r, rich, 'W');
        const wrongId = r.answers[r.answers.length - 1].itemId;
        r = nextBigTest(r, rich);
        const idx = r.queue.map((q, i) => (q.of === wrongId ? i : -1)).filter((i) => i >= 0);
        expect(idx).toHaveLength(2);
        expect(idx[1] - idx[0]).toBeGreaterThanOrEqual(2);
        // with a single main question left the follow-ups have to wrap it, so only the 7th case keeps slot 1 a main question
        if (mains.length === 7) expect(r.queue[r.pos].follow).toBeUndefined();
      }
    }
  });

  it('each new wrong main answer brings 2 more follow-ups from its own topic', () => {
    const r = drive(fresh(rich, 3), rich, 'WW', 'R');
    const mainIds = r.answers.filter((a) => !a.follow).map((a) => a.itemId);
    expect(mainIds).toHaveLength(2);
    const byMain = mainIds.map((id) => r.queue.filter((q) => q.of === id).length);
    expect(byMain).toEqual([2, 2]);
    expect(r.queue.filter((q) => q.follow)).toHaveLength(4);
  });

  it('a wrong follow-up brings no new follow-up, and follow-ups do not count in the level points', () => {
    const r = drive(fresh(rich, 3), rich, 'WRRRRR', 'WW');
    expect(r.queue.filter((q) => q.follow)).toHaveLength(2);
    expect(r.answers.filter((a) => a.follow && !a.right)).toHaveLength(2);
    expect(bigTestLevelScore(r, 'A1')).toEqual({ right: 5, total: 6, taken: true });
    expect(r.phase).toBe('question');
    // two wrong mains with all their follow-ups wrong do not fail the level either
    const w = drive(fresh(rich, 3), rich, 'WWRR', 'WWWW');
    expect(w.phase).not.toBe('levelEnd');
    expect(bigTestLevelScore(w, 'A1')).toMatchObject({ right: 2, total: 4 });
  });

  it('at most 9 main + 2 x 2 follow-up questions in a level', () => {
    const r = drive(fresh(rich, 3), rich, 'WWRRRRRRR', 'RRRR');
    expect(r.phase).toBe('levelEnd');
    expect(bigTestLevelPassed(r, 'A1')).toBe(true);
    expect(r.answers).toHaveLength(13);
    expect(bigTestLevelScore(r, 'A1')).toEqual({ right: 7, total: 9, taken: true });
  });

  it('a 3rd wrong main answer ends the level at once; the pending follow-ups are not asked and their topics need practice', () => {
    const r = drive(fresh(rich, 3), rich, 'WWW', 'RRRR');
    expect(r.phase).toBe('levelEnd');
    expect(bigTestLevelPassed(r, 'A1')).toBe(false);
    // the 3rd mistake schedules nothing
    expect(r.queue.filter((q) => q.follow)).toHaveLength(4);
    const mains = r.answers.filter((a) => !a.follow);
    expect(mains).toHaveLength(3);
    expect(r.answers.filter((a) => a.follow).length).toBeLessThan(4);
    expect(bigTestResult(r).needsPractice).toEqual(mains.map((a) => a.topic));
  });

  it('when the level is passed the pending follow-ups are asked first, then the level ends', () => {
    let askedAfterPass = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = drive(fresh(rich, seed), rich, 'RRRRWRRR', 'RR');
      expect(r.phase).toBe('levelEnd');
      expect(bigTestLevelPassed(r, 'A1')).toBe(true);
      expect(r.answers.filter((a) => a.follow)).toHaveLength(2);
      expect(r.answers.filter((a) => !a.follow)).toHaveLength(8);
      if (r.answers[r.answers.length - 1].follow) askedAfterPass++;
    }
    expect(askedAfterPass).toBeGreaterThan(0);
    // the quick pass too: the first 5 right leave no follow-up pending
    expect(drive(fresh(rich, 4), rich, 'RRRRR').phase).toBe('levelEnd');
  });

  it('the topic is "needs practice" when the follow-ups include a wrong one or there is none', () => {
    const topicOf = (r: BigTestRun) => r.answers[0].topic;
    const bothRight = drive(fresh(rich, 3), rich, 'WRRRR', 'RR');
    expect(bigTestResult(bothRight)).toMatchObject({ needsPractice: [] });
    expect(bigTestResult(bothRight).strong).not.toContain(topicOf(bothRight));
    const oneWrong = drive(fresh(rich, 3), rich, 'WRRRR', 'RW');
    expect(bigTestResult(oneWrong).needsPractice).toEqual([topicOf(oneWrong)]);
    const idk = drive(fresh(rich, 3), rich, 'WRRRR', 'IR');
    expect(bigTestResult(idk).needsPractice).toEqual([topicOf(idk)]);
    const none = steps(fresh(thin, 3), thin, 'W');
    expect(bigTestResult(none)).toMatchObject({ needsPractice: [none.answers[0].topic], strong: [] });
  });

  it('with only one spare item the single follow-up decides', () => {
    const r = nextBigTest(answerOnly(fresh(oneSpare, 2), oneSpare, 'W'), oneSpare);
    expect(r.queue.filter((q) => q.follow)).toHaveLength(1);
    const ok = drive(fresh(oneSpare, 2), oneSpare, 'WRRRR', 'R');
    expect(bigTestResult(ok).needsPractice).toEqual([]);
    const bad = drive(fresh(oneSpare, 2), oneSpare, 'WRRRR', 'W');
    expect(bigTestResult(bad).needsPractice).toEqual([bad.answers[0].topic]);
  });

  it('a right main answer brings no follow-up and the topic is strong', () => {
    const r = steps(fresh(rich, 3), rich, 'R');
    expect(r.queue.some((q) => q.follow)).toBe(false);
    expect(bigTestResult(r).strong).toEqual([r.answers[0].topic]);
  });

  it('"I mistyped" on a main answer counts it right and schedules no follow-ups', () => {
    let r = markBigTestMistyped(answerOnly(fresh(rich, 3), rich, 'W'));
    expect(r.answers[0]).toMatchObject({ right: true, mistyped: true });
    r = nextBigTest(r, rich);
    expect(r.queue.some((q) => q.follow)).toBe(false);
    expect(bigTestResult(r).strong).toEqual([r.answers[0].topic]);
  });

  it('"I mistyped" on a follow-up counts that follow-up right', () => {
    let r = step(fresh(rich, 3), rich, 'W');
    while (!r.queue[r.pos].follow) r = step(r, rich, 'R');
    r = markBigTestMistyped(answerOnly(r, rich, 'W'));
    const flipped = r.answers[r.answers.length - 1];
    expect(flipped).toMatchObject({ follow: true, right: true, mistyped: true });
    r = drive(nextBigTest(r, rich), rich, 'RRR', 'R');
    expect(bigTestResult(r).needsPractice).toEqual([]);
    // and "I don't know" on a follow-up cannot be mistyped
    let f = step(fresh(rich, 3), rich, 'W');
    while (!f.queue[f.pos].follow) f = step(f, rich, 'R');
    const idk = answerOnly(f, rich, 'I');
    expect(markBigTestMistyped(idk)).toBe(idk);
  });

  it('"I mistyped" on the 3rd wrong main answer keeps the level going', () => {
    let r = steps(fresh(thin), thin, 'WW');
    r = markBigTestMistyped(answerOnly(r, thin, 'W'));
    r = nextBigTest(r, thin);
    expect(r.phase).toBe('question');
    expect(bigTestLevelScore(r, 'A1')).toEqual({ right: 1, total: 3, taken: true });
  });
});

describe('big test result', () => {
  it('the level is the first level that was not passed', () => {
    // A1 passed, A2 failed -> A2
    let r = untilEnd(fresh(thin), thin, 'R');
    r = untilEnd(continueBigTest(r, thin), thin, 'W');
    expect(bigTestResult(finishBigTest(r)).level).toBe('A2');
    // A1 failed -> A1
    expect(bigTestResult(finishBigTest(untilEnd(fresh(thin), thin, 'W'))).level).toBe('A1');
    // A1 passed, then "Stop here" -> A2, the rest not taken
    const res = bigTestResult(finishBigTest(untilEnd(fresh(thin), thin, 'R')));
    expect(res.level).toBe('A2');
    expect(res.perLevel.map((p) => p.taken)).toEqual([true, false, false, false, false]);
    expect(res.perLevel[0]).toMatchObject({ right: 5, total: 5, passed: true });
  });

  it('lists the topics to practise and the strong ones, unique and in order of appearance', () => {
    const r = steps(fresh(thin, 5), thin, 'RRWW');
    const topics = r.answers.map((a) => a.topic);
    const res = bigTestResult(r);
    expect(res.strong).toEqual(topics.slice(0, 2));
    expect(res.needsPractice).toEqual(topics.slice(2, 4));
    const again = steps(fresh(makePool({ A1: [2, 5] }), 5), makePool({ A1: [2, 5] }), 'RW');
    expect(new Set(bigTestResult(again).needsPractice).size).toBe(bigTestResult(again).needsPractice.length);
  });

  it('a topic with a right and a wrong main answer is not strong', () => {
    const pool = makePool({ A1: [1, 9] });
    const r = steps(fresh(pool, 5), pool, 'RW');
    expect(bigTestResult(r).strong).toEqual([]);
  });
});

describe('big test progress', () => {
  it('starts at 0, never goes backwards, and ends at 1 after the last level', () => {
    let r = fresh(rich, 9);
    const seen: number[] = [bigTestProgress(r)];
    expect(seen[0]).toBe(0);
    const pattern = 'RWRRWRRRRWRRRRRR';
    let i = 0;
    for (let n = 0; n < 400 && r.phase !== 'result'; n++) {
      if (r.phase === 'question') {
        r = step(r, rich, pattern[i++ % pattern.length] as How);
      } else if (r.phase === 'levelEnd') {
        const next = bigTestLevelPassed(r, BIG_TEST_LEVELS[r.levelIdx]) ? continueBigTest(r, rich) : finishBigTest(r);
        r = next === r ? finishBigTest(r) : next;
      }
      seen.push(bigTestProgress(r));
    }
    expect(r.phase).toBe('result');
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeGreaterThanOrEqual(seen[k - 1]);
    expect(seen.every((p) => p >= 0 && p <= 1)).toBe(true);
  });

  it('the five steps: passed levels full, the current one by its answered main questions, the rest empty; the number has no total', () => {
    expect(bigTestStepFill(fresh(thin))).toEqual([0, 0, 0, 0, 0]);
    expect(bigTestQuestionNumber(fresh(thin))).toBe(1);
    const moved = continueBigTest(steps(fresh(thin), thin, 'RRRRR'), thin);
    expect(bigTestStepFill(moved)).toEqual([1, 0, 0, 0, 0]);
    expect(bigTestQuestionNumber(moved)).toBe(6);
    const mid = steps(moved, thin, 'RW');
    expect(bigTestStepFill(mid)).toEqual([1, 2 / 9, 0, 0, 0]);
    // a question answered keeps its own number until Next
    expect(bigTestQuestionNumber(answerOnly(mid, thin, 'R'))).toBe(8);
    expect(bigTestQuestionNumber(mid)).toBe(8);
  });

  it('a level is a fifth: moving to the next level starts at one fifth', () => {
    const ended = untilEnd(fresh(thin), thin, 'R');
    expect(bigTestProgress(ended)).toBeCloseTo(0.2);
    expect(bigTestProgress(continueBigTest(ended, thin))).toBeCloseTo(0.2);
    // half of the main questions answered = a tenth of the test
    const half = steps(fresh(thin), thin, 'WWRR'); // 4 of 9
    expect(bigTestProgress(half)).toBeCloseTo((4 / 9) * 0.2);
    // the last level, passed: the whole bar
    let r = fresh(thin);
    for (const level of BIG_TEST_LEVELS) {
      r = untilEnd(r, thin, 'R');
      if (level !== 'C1') r = continueBigTest(r, thin);
    }
    expect(bigTestProgress(r)).toBeCloseTo(1);
  });
});

describe('big test persistence', () => {
  const real = bigTestPool('es');

  it('ignores a stored run of another version, with unknown ids, or that does not add up', () => {
    const good = answerOnly(newBigTestRun(real, 11), real, 'R');
    expect(parseBigTestRun(good, real)).toEqual(good);
    expect(parseBigTestRun({ ...good, v: 1 }, real)).toBeNull();
    expect(parseBigTestRun({ ...good, v: 2, queue: undefined }, real)).toBeNull();
    expect(parseBigTestRun({ ...good, answers: [{ ...good.answers[0], itemId: 'es-bt-a1-99999' }] }, real)).toBeNull();
    expect(parseBigTestRun({ ...good, queue: [{ id: 'nope' }, ...good.queue.slice(1)] }, real)).toBeNull();
    expect(parseBigTestRun({ ...good, pos: 4 }, real)).toBeNull();
    expect(parseBigTestRun({ ...good, answers: [] }, real)).toBeNull();
    expect(parseBigTestRun({ ...good, seed: 'x' }, real)).toBeNull();
    expect(parseBigTestRun('junk', real)).toBeNull();
    expect(parseBigTestRun(null, real)).toBeNull();
    expect(parseBigTestRun(good, bigTestPool('en'))).toBeNull();
  });

  it('drops an old v1 run (the 45-question one)', () => {
    const v1 = { v: 1, levelIdx: 0, pos: 1, phase: 'question', answers: [{ itemId: real[0].id, level: real[0].level, topic: real[0].topic, picked: 0, right: true }] };
    expect(parseBigTestRun(v1, real)).toBeNull();
  });

  it('saves the run after a step and swaps it for the result when the test ends', async () => {
    const db = getDb();
    const pair = 'en→es';
    const run = answerOnly(newBigTestRun(real, 21), real, 'W');
    await saveBigTestRun(db, pair, run);
    expect(await loadBigTestRun(db, pair, 'es')).toEqual(run);
    expect(await loadBigTestResult(db, pair)).toBeNull();

    const ended = finishBigTest(untilEnd(newBigTestRun(real, 21), real, 'W'));
    await saveBigTestRun(db, pair, ended);
    expect(await loadBigTestRun(db, pair, 'es')).toBeNull();
    const stored = await loadBigTestResult(db, pair);
    expect(stored?.level).toBe('A1');
    expect(Number.isNaN(Date.parse(stored!.at))).toBe(false);
    expect(bigTestRunKey(pair)).toBe('grammar-big-test:en→es');
    expect(bigTestResultKey(pair)).toBe('grammar-big-test-result:en→es');
  });

  it('a saved run in the middle of a level, after follow-ups, loads back the same', async () => {
    const db = getDb();
    const pair = 'en→es';
    let run = newBigTestRun(real, 33);
    for (let i = 0; i < 4 && run.phase === 'question'; i++) run = step(run, real, i === 0 ? 'W' : 'R');
    await saveBigTestRun(db, pair, run);
    expect(await loadBigTestRun(db, pair, 'es')).toEqual(run);
  });

  it('reads an old stored result (no "passed" per level) as it is', async () => {
    const db = getDb();
    const pair = 'en→es';
    const old = {
      level: 'B1',
      perLevel: BIG_TEST_LEVELS.map((l) => ({ level: l, right: 7, total: 9, taken: true })),
      needsPractice: [],
      strong: [],
      at: '2026-11-16T10:00:00.000Z',
    };
    await saveResumeValue(db, bigTestResultKey(pair), old);
    expect((await loadBigTestResult(db, pair))?.level).toBe('B1');
  });
});
