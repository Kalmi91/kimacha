import {
  BIG_TEST_LEVELS,
  answerBigTest,
  bigTestItems,
  bigTestLevelPassed,
  bigTestLevelScore,
  bigTestResult,
  bigTestResultKey,
  bigTestRunKey,
  continueBigTest,
  finishBigTest,
  hasBigTest,
  loadBigTestResult,
  loadBigTestRun,
  markBigTestMistyped,
  newBigTestRun,
  nextBigTest,
  parseBigTestRun,
  saveBigTestRun,
  type BigTestLevel,
  type BigTestRun,
} from '../bigTest';
import { getDb } from '@/lib/database.web';

// Plays one level: `rights` of the 9 answers are right, the rest a wrong pick; stops on the level end.
function playLevel(run: BigTestRun, level: BigTestLevel, rights: number, idk = false): BigTestRun {
  let r = run;
  bigTestItems('es', level).forEach((item, i) => {
    const wrongPick = (item.correct + 1) % 4;
    r = answerBigTest(r, item, i < rights ? item.correct : idk ? null : wrongPick);
    r = nextBigTest(r);
  });
  return r;
}

describe('big test logic', () => {
  it('has data for Spanish only', () => {
    expect(hasBigTest('es')).toBe(true);
    expect(hasBigTest('en')).toBe(false);
    expect(bigTestItems('en', 'A1')).toEqual([]);
    expect(BIG_TEST_LEVELS.map((l) => bigTestItems('es', l).length)).toEqual([9, 9, 9, 9, 9]);
  });

  it('passes a level with 6 of 9 and fails it with 5 of 9', () => {
    const six = playLevel(newBigTestRun(), 'A1', 6);
    expect(six.phase).toBe('levelEnd');
    expect(bigTestLevelScore(six, 'A1')).toEqual({ right: 6, total: 9, taken: true });
    expect(bigTestLevelPassed(six, 'A1')).toBe(true);
    const five = playLevel(newBigTestRun(), 'A1', 5);
    expect(bigTestLevelPassed(five, 'A1')).toBe(false);
    expect(bigTestLevelScore(five, 'A2').taken).toBe(false);
  });

  it('continues only after a passed level; a failed one can only finish', () => {
    const failed = playLevel(newBigTestRun(), 'A1', 5);
    expect(continueBigTest(failed)).toBe(failed);
    const finished = finishBigTest(failed);
    expect(finished.phase).toBe('result');
    const passed = playLevel(newBigTestRun(), 'A1', 9);
    const moved = continueBigTest(passed);
    expect(moved).toMatchObject({ levelIdx: 1, pos: 0, phase: 'question' });
    // nothing moves from the wrong phase
    expect(continueBigTest(moved)).toBe(moved);
    expect(finishBigTest(moved)).toBe(moved);
  });

  it('does not continue past C1', () => {
    let r = newBigTestRun();
    for (const level of BIG_TEST_LEVELS) {
      r = playLevel(r, level, 9);
      if (level !== 'C1') r = continueBigTest(r);
    }
    expect(r.phase).toBe('levelEnd');
    expect(continueBigTest(r)).toBe(r);
    expect(bigTestResult(finishBigTest(r)).level).toBe('C1');
  });

  it('"I don\'t know" is wrong and cannot be marked as mistyped', () => {
    const item = bigTestItems('es', 'A1')[0];
    const run = answerBigTest(newBigTestRun(), item, null);
    expect(run.answers[0]).toMatchObject({ picked: null, right: false });
    expect(markBigTestMistyped(run)).toBe(run);
  });

  it('"I mistyped" flips only the last wrong picked answer', () => {
    const [a, b] = bigTestItems('es', 'A1');
    let run = answerBigTest(newBigTestRun(), a, (a.correct + 1) % 4);
    run = nextBigTest(run);
    run = answerBigTest(run, b, (b.correct + 1) % 4);
    const flipped = markBigTestMistyped(run);
    expect(flipped.answers[0].right).toBe(false);
    expect(flipped.answers[1]).toMatchObject({ right: true, mistyped: true });
    // a right answer, and the wrong phase, stay as they are
    const right = answerBigTest(newBigTestRun(), a, a.correct);
    expect(markBigTestMistyped(right)).toBe(right);
    expect(markBigTestMistyped(nextBigTest(flipped))).toEqual(nextBigTest(flipped));
  });

  it('a mistyped answer counts towards the level threshold', () => {
    const items = bigTestItems('es', 'A1');
    let r = newBigTestRun();
    items.forEach((item, i) => {
      r = answerBigTest(r, item, i < 5 ? item.correct : (item.correct + 1) % 4);
      if (i === 5) r = markBigTestMistyped(r);
      r = nextBigTest(r);
    });
    expect(bigTestLevelScore(r, 'A1').right).toBe(6);
    expect(bigTestLevelPassed(r, 'A1')).toBe(true);
  });

  it('result level is the first level that was not passed', () => {
    // A1 9/9, A2 7/9, B1 4/9 -> B1
    let r = playLevel(newBigTestRun(), 'A1', 9);
    r = playLevel(continueBigTest(r), 'A2', 7);
    r = playLevel(continueBigTest(r), 'B1', 4);
    expect(bigTestResult(finishBigTest(r)).level).toBe('B1');
    // A1 5/9 -> A1
    expect(bigTestResult(finishBigTest(playLevel(newBigTestRun(), 'A1', 5))).level).toBe('A1');
    // A1 passed, then "Stop here" -> A2
    const stopped = finishBigTest(playLevel(newBigTestRun(), 'A1', 6));
    const res = bigTestResult(stopped);
    expect(res.level).toBe('A2');
    expect(res.perLevel.map((p) => p.taken)).toEqual([true, false, false, false, false]);
  });

  it('lists the topics to practise and the strong ones, unique and in order of appearance', () => {
    const items = bigTestItems('es', 'A1');
    let r = newBigTestRun();
    // right on the first three, wrong on the fourth and after
    items.forEach((item, i) => {
      r = answerBigTest(r, item, i < 3 ? item.correct : (item.correct + 1) % 4);
      r = nextBigTest(r);
    });
    const res = bigTestResult(finishBigTest(r));
    const topics = items.map((it) => it.topic);
    const wrong = [...new Set(topics.slice(3))];
    expect(res.needsPractice).toEqual(wrong);
    expect(new Set(res.needsPractice).size).toBe(res.needsPractice.length);
    expect(res.strong).toEqual([...new Set(topics.slice(0, 3))].filter((tp) => !wrong.includes(tp)));
    // a topic with one right and one wrong answer is not strong
    expect(res.strong.some((tp) => res.needsPractice.includes(tp))).toBe(false);
  });
});

describe('big test persistence', () => {
  it('ignores a stored run of another version or with unknown item ids', () => {
    const good = answerBigTest(newBigTestRun(), bigTestItems('es', 'A1')[0], 0);
    expect(parseBigTestRun(good, 'es')).toEqual(good);
    expect(parseBigTestRun({ ...good, v: 2 }, 'es')).toBeNull();
    expect(parseBigTestRun({ ...good, answers: [{ ...good.answers[0], itemId: 'es-bt-a1-99' }] }, 'es')).toBeNull();
    expect(parseBigTestRun({ ...good, pos: 4 }, 'es')).toBeNull();
    expect(parseBigTestRun('junk', 'es')).toBeNull();
    expect(parseBigTestRun(null, 'es')).toBeNull();
    expect(parseBigTestRun(good, 'en')).toBeNull();
  });

  it('saves the run after a step and swaps it for the result when the test ends', async () => {
    const db = getDb();
    const pair = 'en→es';
    const run = answerBigTest(newBigTestRun(), bigTestItems('es', 'A1')[0], 1);
    await saveBigTestRun(db, pair, run);
    expect(await loadBigTestRun(db, pair, 'es')).toEqual(run);
    expect(await loadBigTestResult(db, pair)).toBeNull();

    const ended = finishBigTest(playLevel(newBigTestRun(), 'A1', 5));
    await saveBigTestRun(db, pair, ended);
    expect(await loadBigTestRun(db, pair, 'es')).toBeNull();
    const stored = await loadBigTestResult(db, pair);
    expect(stored?.level).toBe('A1');
    expect(Number.isNaN(Date.parse(stored!.at))).toBe(false);
    expect(bigTestRunKey(pair)).toBe('grammar-big-test:en→es');
    expect(bigTestResultKey(pair)).toBe('grammar-big-test-result:en→es');
  });
});
