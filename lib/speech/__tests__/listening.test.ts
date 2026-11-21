import {
  GREETINGS,
  GREETINGS_EN,
  RATES,
  TAXI,
  LO,
  listenTitle,
  listenTeaser,
  answerQuiz,
  clock,
  isComplete,
  itemComplete,
  listeningItems,
  newQuiz,
  newRun,
  optionOrder,
  parseQuiz,
  parseRate,
  parseRun,
  pick,
  quizComplete,
  quizKeyFor,
  quizRight,
  rightOrder,
  runKeyFor,
  serializeQuiz,
  serializeRun,
} from '@/lib/speech/listening';

describe('listening data', () => {
  it('has pairs of a place and a greeting, and a known shape', () => {
    expect(GREETINGS.pairs.length).toBeGreaterThan(1);
    for (const p of GREETINGS.pairs) {
      expect(p.place).toBeTruthy();
      expect(p.greeting).toBeTruthy();
    }
    expect(GREETINGS.durationSec).toBeGreaterThanOrEqual(0);
  });

  it('English: 12 unique pairs, its own id; other targets have none', () => {
    expect(GREETINGS_EN.id).toBe('en-greetings');
    expect(GREETINGS_EN.pairs).toHaveLength(12);
    expect(new Set(GREETINGS_EN.pairs.map((p) => p.place)).size).toBe(12);
    expect(new Set(GREETINGS_EN.pairs.map((p) => p.greeting)).size).toBe(12);
    expect(listeningItems('en')).toEqual([GREETINGS_EN]);
    expect(listeningItems('hu')).toEqual([]);
    expect(listeningItems('de')).toEqual([]);
  });

  it('Spanish has the greetings, the taxi and the lo, in that order', () => {
    expect(listeningItems('es')).toEqual([GREETINGS, TAXI, LO]);
    expect(LO.id).toBe('es-lo');
    expect(LO.pairs).toHaveLength(0);
    expect(LO.questions).toHaveLength(12);
    expect(TAXI.id).toBe('es-taxi');
    expect(TAXI.pairs).toHaveLength(0);
  });

  it('the run key: the two greetings keep their original keys, others get their id', () => {
    expect(runKeyFor(GREETINGS)).toBe('speech-listen-run');
    expect(runKeyFor(GREETINGS_EN)).toBe('speech-listen-run-en');
    expect(runKeyFor(TAXI)).toBe('speech-listen-run-es-taxi');
    expect(quizKeyFor(TAXI)).toBe('speech-listen-quiz-es-taxi');
    expect(runKeyFor(LO)).toBe('speech-listen-run-es-lo');
    expect(quizKeyFor(LO)).toBe('speech-listen-quiz-es-lo');
  });

  it('title and teaser per item id', () => {
    const sx = { greetTitle: 'g', taxiTitle: 't', loTitle: 'l', greetTeaser: 'gt', greetTeaserEn: 'ge', taxiTeaser: 'tt', loTeaser: 'lt' };
    expect(listenTitle('es-greetings', sx)).toBe('g');
    expect(listenTitle('es-taxi', sx)).toBe('t');
    expect(listenTitle('es-lo', sx)).toBe('l');
    expect(listenTeaser('es-greetings', 'es', sx)).toBe('gt');
    expect(listenTeaser('en-greetings', 'en', sx)).toBe('ge');
    expect(listenTeaser('es-taxi', 'es', sx)).toBe('tt');
    expect(listenTeaser('es-lo', 'es', sx)).toBe('lt');
  });

  it('the questions of every item: unique ids, 3 distinct options, the answer in range', () => {
    for (const item of [GREETINGS, GREETINGS_EN, TAXI, LO]) {
      const qs = item.questions ?? [];
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
      for (const q of qs) {
        expect(q.q.trim()).toBeTruthy();
        expect(q.options).toHaveLength(3);
        expect(q.options.every((o) => o.trim().length > 0)).toBe(true);
        expect(new Set(q.options).size).toBe(3);
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 3).toBe(true);
      }
    }
    expect(GREETINGS_EN.questions ?? []).toHaveLength(0);
    expect(TAXI.questions).toHaveLength(12);
  });
});

describe('questions run', () => {
  const qs = TAXI.questions ?? [];
  it('answers once, a second answer on the same question changes nothing', () => {
    const run = newQuiz(qs.length, 5);
    expect(run.answers.every((a) => a === -1)).toBe(true);
    const one = answerQuiz(run, 0, 2);
    expect(one.answers[0]).toBe(2);
    expect(answerQuiz(one, 0, 1)).toBe(one);
    expect(answerQuiz(run, -1, 0)).toBe(run);
    expect(answerQuiz(run, qs.length, 0)).toBe(run);
  });
  it('complete when every question is answered; counts the right ones', () => {
    let run = newQuiz(qs.length, 5);
    expect(quizComplete(run)).toBe(false);
    qs.forEach((q, i) => {
      run = answerQuiz(run, i, i === 0 ? (q.answer + 1) % 3 : q.answer);
    });
    expect(quizComplete(run)).toBe(true);
    expect(quizRight(run, qs)).toBe(qs.length - 1);
    expect(quizComplete(newQuiz(0, 1))).toBe(false);
  });
  it('optionOrder is a stable permutation', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (let i = 0; i < 4; i++) {
        const order = optionOrder(i, 3, seed);
        expect(order).toEqual(optionOrder(i, 3, seed));
        expect([...order].sort()).toEqual([0, 1, 2]);
      }
    }
  });
  it('round-trips and rejects what does not fit', () => {
    const run = answerQuiz(newQuiz(qs.length, 9), 3, 1);
    expect(parseQuiz(JSON.parse(JSON.stringify(serializeQuiz(run))), qs)).toEqual(run);
    expect(parseQuiz(null, qs)).toBeNull();
    expect(parseQuiz('x', qs)).toBeNull();
    expect(parseQuiz({ seed: 1, answers: [-1] }, qs)).toBeNull();
    expect(parseQuiz({ seed: 'x', answers: qs.map(() => -1) }, qs)).toBeNull();
    expect(parseQuiz({ seed: 1, answers: qs.map(() => 3) }, qs)).toBeNull();
    expect(parseQuiz({ seed: 1, answers: qs.map(() => -2) }, qs)).toBeNull();
  });
  it('keeps the paid XP with the run; a missing or bad sum reads as 0', () => {
    const run = { ...answerQuiz(newQuiz(qs.length, 9), 0, qs[0].answer), earned: 1.5 };
    expect(parseQuiz(JSON.parse(JSON.stringify(serializeQuiz(run))), qs)?.earned).toBe(1.5);
    expect(newQuiz(qs.length, 1).earned).toBe(0);
    expect(parseQuiz({ seed: 1, answers: qs.map(() => -1) }, qs)?.earned).toBe(0);
    expect(parseQuiz({ seed: 1, answers: qs.map(() => -1), earned: -1 }, qs)?.earned).toBe(0);
  });
});

describe('itemComplete', () => {
  const matched = (item: typeof GREETINGS) => item.pairs.reduce((run, _p, i) => pick(run, i, i).run, newRun(1));
  const answered = (item: typeof GREETINGS) =>
    (item.questions ?? []).reduce((run, q, i) => answerQuiz(run, i, q.answer), newQuiz((item.questions ?? []).length, 1));
  it('pairs only (English): the matching is enough', () => {
    expect(itemComplete(GREETINGS_EN, newRun(1), newQuiz(0, 1))).toBe(false);
    expect(itemComplete(GREETINGS_EN, matched(GREETINGS_EN), newQuiz(0, 1))).toBe(true);
  });
  it('questions only (taxi): the questions are enough', () => {
    expect(itemComplete(TAXI, newRun(1), newQuiz(12, 1))).toBe(false);
    expect(itemComplete(TAXI, newRun(1), answered(TAXI))).toBe(true);
  });
  it('both (Spanish greetings): needs both', () => {
    expect(itemComplete(GREETINGS, matched(GREETINGS), newQuiz(GREETINGS.questions?.length ?? 0, 1))).toBe(false);
    expect(itemComplete(GREETINGS, newRun(1), answered(GREETINGS))).toBe(false);
    expect(itemComplete(GREETINGS, matched(GREETINGS), answered(GREETINGS))).toBe(true);
  });
});

describe('clock', () => {
  it('m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(65.9)).toBe('1:05');
    expect(clock(600)).toBe('10:00');
    expect(clock(-3)).toBe('0:00');
    expect(clock(NaN)).toBe('0:00');
  });
});

describe('rightOrder', () => {
  it('is seeded and never leaves every pair aligned', () => {
    for (let n = 2; n <= 14; n++) {
      for (let seed = 1; seed <= 40; seed++) {
        const order = rightOrder(n, seed);
        expect(order).toEqual(rightOrder(n, seed));
        expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
        expect(order.some((p, i) => p !== i)).toBe(true);
      }
    }
  });
  it('one pair stays one pair', () => {
    expect(rightOrder(1, 5)).toEqual([0]);
  });
});

describe('pick', () => {
  it('a right pair is kept, a wrong one counts a mistake', () => {
    const wrong = pick(newRun(1), 0, 1);
    expect(wrong.correct).toBe(false);
    expect(wrong.run).toEqual({ seed: 1, matched: [], mistakes: 1 });
    const right = pick(wrong.run, 2, 2);
    expect(right.correct).toBe(true);
    expect(right.run.matched).toEqual([2]);
    expect(right.run.mistakes).toBe(1);
  });
  it('a matched pair cannot be picked again', () => {
    const run = pick(newRun(1), 0, 0).run;
    const again = pick(run, 0, 0);
    expect(again.correct).toBe(false);
    expect(again.run).toBe(run);
  });
  it('complete when every pair is matched', () => {
    let run = newRun(3);
    expect(isComplete(run, 3)).toBe(false);
    for (let i = 0; i < 3; i++) run = pick(run, i, i).run;
    expect(isComplete(run, 3)).toBe(true);
    expect(isComplete(newRun(1), 0)).toBe(false);
  });
});

describe('saved run', () => {
  it('round-trips', () => {
    const run = { seed: 7, matched: [1, 0], mistakes: 2 };
    expect(parseRun(JSON.parse(JSON.stringify(serializeRun(run))), 4)).toEqual(run);
  });
  it('rejects what does not fit the data', () => {
    expect(parseRun(null, 4)).toBeNull();
    expect(parseRun({ seed: 1, matched: [4], mistakes: 0 }, 4)).toBeNull();
    expect(parseRun({ seed: 1, matched: [1, 1], mistakes: 0 }, 4)).toBeNull();
    expect(parseRun({ seed: 1, matched: [], mistakes: -1 }, 4)).toBeNull();
    expect(parseRun({ seed: 'x', matched: [], mistakes: 0 }, 4)).toBeNull();
  });
});

describe('rate', () => {
  it('only the offered speeds, else 1', () => {
    expect(RATES).toHaveLength(9);
    expect(parseRate(1.3)).toBe(1.3);
    expect(parseRate(2)).toBe(1);
    expect(parseRate('1.2')).toBe(1);
  });
});
