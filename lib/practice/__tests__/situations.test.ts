import { gapByWord } from '../gapFill';
import { knownTokens, sentenceTokens } from '@/lib/knownSentence';
import {
  SITUATIONS,
  answerSituation,
  buildTraps,
  fillBank,
  fillGaps,
  isSituationOpen,
  nextSituation,
  parseSituation,
  questionLines,
  savedSituation,
  situationSteps,
  situationTotals,
  situationsFor,
  startSituation,
  stepSize,
  unknownWords,
  type Situation,
  type SituationState,
} from '../situations';

const family = SITUATIONS.find((s) => s.id === 'a1-familia')!;
const NOTHING: ReadonlySet<string> = knownTokens('es', { learned: [] });
const EVERYTHING = new Set(family.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));

describe('data/practice/situations.json', () => {
  it.each(SITUATIONS.map((s) => [s.id, s] as const))('%s: texts in en, es and hu; unique ids', (_id, s) => {
    expect(SITUATIONS.filter((x) => x.id === s.id)).toHaveLength(1);
    for (const text of [s.title, s.setting]) for (const lang of ['en', 'es', 'hu'] as const) expect(text[lang].trim()).not.toBe('');
    for (const l of s.lines) for (const lang of ['en', 'es', 'hu'] as const) expect(l[lang].trim()).not.toBe('');
    for (const w of s.words) for (const lang of ['en', 'es', 'hu'] as const) expect(w[lang].trim()).not.toBe('');
    for (const p of s.patterns) {
      for (const lang of ['en', 'es', 'hu'] as const) expect(p.title[lang].trim()).not.toBe('');
      expect(p.en.trim()).not.toBe('');
      expect(p.hu.trim()).not.toBe('');
    }
  });

  it.each(SITUATIONS.map((s) => [s.id, s] as const))('%s: every token of the lines and the answers is one of the situation\'s own forms or a free word', (_id, s) => {
    const own = new Set(s.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
    const free = knownTokens('es', { learned: [] });
    const texts = [...s.lines.map((l) => l.es), ...s.lines.flatMap((l) => l.answers ?? []), ...s.patterns.map((p) => p.example)];
    for (const text of texts) {
      for (const token of sentenceTokens(text, 'es')) expect({ text, token, ok: own.has(token) || free.has(token) }).toMatchObject({ ok: true });
    }
    // so the gate is open with nothing learned
    expect(isSituationOpen(s, new Set())).toBe(true);
  });

  it.each(SITUATIONS.map((s) => [s.id, s] as const))('%s: gaps are whole words of their line, build lines exist and are the learner\'s', (_id, s) => {
    for (const l of s.lines) if (l.gap) expect(gapByWord(l.es, l.gap)).not.toBeNull();
    expect(s.build.length).toBeGreaterThan(0);
    for (const i of s.build) {
      expect(s.lines[i]).toBeDefined();
      expect(s.lines[i].speaker).toBe('me');
    }
  });

  it.each(SITUATIONS.map((s) => [s.id, s] as const))('%s: the first answer of every question is the next line of the learner', (_id, s) => {
    for (const i of questionLines(s)) {
      const next = s.lines[i + 1];
      expect(next?.speaker).toBe('me');
      expect(s.lines[i].answers![0]).toBe(next.es);
    }
  });

  it.each(SITUATIONS.map((s) => [s.id, s] as const))('%s: the distractors are words of the dialogue that fit no gap', (_id, s) => {
    expect(s.distractors.length).toBeGreaterThan(0);
    const tokens = new Set(s.lines.flatMap((l) => sentenceTokens(l.es, 'es')));
    const gaps = fillGaps(s).map((g) => g.word.toLowerCase());
    for (const w of s.distractors) {
      expect(tokens.has(w.toLowerCase())).toBe(true);
      expect(gaps).not.toContain(w.toLowerCase());
    }
  });

  it('the family lunch: the first question has the model answer first, then the short forms and the ones without "sí"', () => {
    const answers = family.lines[0].answers!;
    expect(answers[0]).toBe('Sí, tengo un hermano y una hermana.');
    expect(answers).toEqual(expect.arrayContaining([
      'Tengo un hermano y una hermana.',
      'Tengo un hermano.',
      'Tengo una hermana.',
      'No tengo hermanos.',
      'No, no tengo hermanos.',
    ]));
  });

  it('the family lunch: 6 lines, gaps tengo / viven / años, build of lines 2, 4 and 6, 3 questions', () => {
    expect(family.lines).toHaveLength(6);
    expect(fillGaps(family)).toEqual([{ line: 1, word: 'tengo' }, { line: 3, word: 'viven' }, { line: 5, word: 'años' }]);
    expect(family.build).toEqual([1, 3, 5]);
    expect(questionLines(family)).toEqual([0, 2, 4]);
    expect(situationTotals(family)).toEqual({ fill: 3, build: 3, say: 6, questions: 3 });
  });
});

describe('situationsFor, the gate, the unknown words', () => {
  it('only the Spanish target has situations', () => {
    expect(situationsFor('es')).toBe(SITUATIONS);
    expect(situationsFor('en')).toEqual([]);
    expect(situationsFor('hu')).toEqual([]);
  });

  it('a line with a word that nothing teaches closes the situation', () => {
    const odd: Situation = { ...family, lines: [...family.lines, { speaker: 'me', es: 'Tengo un perro.', en: 'x', hu: 'x' }] };
    expect(isSituationOpen(odd, NOTHING)).toBe(false);
    expect(isSituationOpen(odd, new Set(['perro']))).toBe(true);
  });

  it('the Words step lists the words whose forms are all unknown (free words like un, y, en, no, tu, mi are known)', () => {
    const none = unknownWords(family, NOTHING).map((w) => w.es);
    expect(none).toHaveLength(family.words.length - 6);
    for (const free of ['un', 'y', 'en', 'no', 'tu', 'mi']) expect(none).not.toContain(free);
    const some = unknownWords(family, knownTokens('es', { learned: ['hermano', 'sí'] })).map((w) => w.es);
    expect(some).not.toContain('hermano');
    expect(some).not.toContain('sí');
    expect(some).toContain('hermana');
    expect(unknownWords(family, EVERYTHING)).toEqual([]);
  });
});

describe('the word bank and the trap tiles', () => {
  it('the bank is the 3 gap words and the curated distractors (tienes, dónde), in a fixed order per seed', () => {
    expect(family.distractors).toEqual(['tienes', 'dónde']);
    const bank = fillBank(family, 7);
    expect(bank).toHaveLength(5);
    expect([...bank].sort()).toEqual(['años', 'dónde', 'tengo', 'tienes', 'viven']);
    expect(fillBank(family, 7)).toEqual(bank);
    // not picked at random: every seed gives the same five words
    for (const seed of [1, 2, 3, 99]) expect([...fillBank(family, seed)].sort()).toEqual([...bank].sort());
    // another seed may order them differently
    expect(new Set([1, 2, 3, 4, 5, 6].map((seed) => fillBank(family, seed).join())).size).toBeGreaterThan(1);
  });

  it('a situation without distractors has a bank of just its gap words', () => {
    expect([...fillBank({ ...family, distractors: [] }, 3)].sort()).toEqual(['años', 'tengo', 'viven']);
  });

  it('2 traps per build line, none of them in the line', () => {
    for (const i of family.build) {
      const own = sentenceTokens(family.lines[i].es, 'es');
      const traps = buildTraps(family, i, 3);
      expect(traps).toHaveLength(2);
      for (const t of traps) expect(own).not.toContain(t);
      expect(buildTraps(family, i, 3)).toEqual(traps);
    }
  });
});

describe('the run', () => {
  it('goes through words, structures, fill in, build, say it, questions, summary; the Words step is skipped with nothing to learn', () => {
    const fresh = startSituation(family, NOTHING, 1);
    expect(fresh.words).toHaveLength(13);
    expect(situationSteps(fresh, family)).toEqual(['words', 'patterns', 'fill', 'build', 'say', 'questions', 'summary']);
    expect(fresh).toMatchObject({ step: 'words', index: 0, wrong: 0, done: false, scores: { fill: 0, build: 0, say: 0, questions: 0 } });
    const known = startSituation(family, EVERYTHING, 1);
    expect(known.words).toEqual([]);
    expect(known.step).toBe('patterns');
    expect(situationSteps(known, family)).toEqual(['patterns', 'fill', 'build', 'say', 'questions', 'summary']);
    expect(stepSize(known, family, 'words')).toBe(0);
  });

  it('words and structures: Next goes card by card, then to the next step', () => {
    let st = startSituation(family, EVERYTHING, 1);
    for (let i = 0; i < 3; i++) {
      expect(st).toMatchObject({ step: 'patterns', index: i });
      st = nextSituation(st, family);
    }
    expect(st).toMatchObject({ step: 'fill', index: 0 });
  });

  it('fill in: wrong stays on the gap and costs the point, right moves on, Next only after the last gap', () => {
    let st: SituationState = { ...startSituation(family, EVERYTHING, 1), step: 'fill' };
    expect(nextSituation(st, family)).toBe(st);
    st = answerSituation(st, family, false);
    expect(st).toMatchObject({ index: 0, wrong: 1, done: false });
    st = answerSituation(st, family, true); // gap 1: right at the second try, no point
    expect(st).toMatchObject({ index: 1, wrong: 0, scores: { fill: 0 } });
    st = answerSituation(st, family, true); // gap 2: first try
    st = answerSituation(st, family, true); // gap 3: first try, the step is done
    expect(st).toMatchObject({ index: 3, done: true, scores: { fill: 2 } });
    expect(answerSituation(st, family, true)).toBe(st);
    st = nextSituation(st, family);
    expect(st).toMatchObject({ step: 'build', index: 0, wrong: 0, done: false, scores: { fill: 2 } });
  });

  it('build: one try per line, the result moves straight on; the last line leads to Say it', () => {
    let st: SituationState = { ...startSituation(family, EVERYTHING, 1), step: 'build' };
    st = answerSituation(st, family, true);
    st = answerSituation(st, family, false);
    expect(st).toMatchObject({ step: 'build', index: 2, scores: { build: 1 } });
    st = answerSituation(st, family, true);
    expect(st).toMatchObject({ step: 'say', index: 0, scores: { build: 2 } });
  });

  it('say it: right = done (a point at the first try), wrong = another try, given up after two wrong tries', () => {
    let st: SituationState = { ...startSituation(family, EVERYTHING, 1), step: 'say' };
    st = answerSituation(st, family, true);
    expect(st).toMatchObject({ done: true, scores: { say: 1 } });
    st = nextSituation(st, family);
    expect(st).toMatchObject({ step: 'say', index: 1, wrong: 0, done: false });
    st = answerSituation(st, family, false);
    expect(st).toMatchObject({ wrong: 1, done: false });
    st = answerSituation(st, family, true); // right at the second try: done, no point
    expect(st).toMatchObject({ done: true, scores: { say: 1 } });
    st = nextSituation(st, family);
    st = answerSituation(answerSituation(st, family, false), family, false);
    expect(st).toMatchObject({ index: 2, wrong: 2, done: true, scores: { say: 1 } });
  });

  it('questions: the last question leads to the summary', () => {
    let st: SituationState = { ...startSituation(family, EVERYTHING, 1), step: 'questions' };
    // right first time, two wrong tries (given up), right first time
    for (const tries of [[true], [false, false], [true]]) {
      for (const right of tries) st = answerSituation(st, family, right);
      expect(st.done).toBe(true);
      st = nextSituation(st, family);
    }
    expect(st).toMatchObject({ step: 'summary', scores: { questions: 2 } });
    expect(nextSituation(st, family)).toBe(st);
    expect(answerSituation(st, family, true)).toBe(st);
  });
});

describe('saving and resuming a run', () => {
  const open = [family];

  it('round trip at every step', () => {
    let st = startSituation(family, NOTHING, 42);
    const seen: string[] = [];
    for (let guard = 0; st.step !== 'summary' && guard < 200; guard++) {
      expect(parseSituation(JSON.parse(JSON.stringify(savedSituation(st))), open)).toEqual(st);
      seen.push(st.step);
      st = st.step === 'words' || st.step === 'patterns' || st.done ? nextSituation(st, family) : answerSituation(st, family, true);
    }
    expect(new Set(seen)).toEqual(new Set(['words', 'patterns', 'fill', 'build', 'say', 'questions']));
    expect(st.scores).toEqual({ fill: 3, build: 3, say: 6, questions: 3 });
  });

  it('a broken, foreign or out-of-range value is not resumed', () => {
    const good = savedSituation({ ...startSituation(family, EVERYTHING, 5), step: 'say', index: 2, wrong: 1 }) as Record<string, unknown>;
    expect(parseSituation(good, open)).not.toBeNull();
    const bad = (patch: Record<string, unknown>) => parseSituation({ ...good, ...patch }, open);
    expect(parseSituation(null, open)).toBeNull();
    expect(parseSituation('x', open)).toBeNull();
    expect(parseSituation(good, [])).toBeNull();
    expect(bad({ v: 2 })).toBeNull();
    expect(bad({ id: 'other' })).toBeNull();
    expect(bad({ seed: 'x' })).toBeNull();
    expect(bad({ step: 'summary' })).toBeNull();
    expect(bad({ step: 'dance' })).toBeNull();
    expect(bad({ step: 'words' })).toBeNull(); // no Words step in this run
    expect(bad({ index: 6 })).toBeNull();
    expect(bad({ index: -1 })).toBeNull();
    expect(bad({ wrong: 'a' })).toBeNull();
    expect(bad({ done: 'yes' })).toBeNull();
    expect(bad({ words: ['nonsense'] })).toBeNull();
    expect(bad({ scores: { fill: 9, build: 0, say: 0, questions: 0 } })).toBeNull();
    expect(bad({ scores: null })).toBeNull();
    // a finished item exists only in Fill in, Say it and Questions; Fill in is done exactly after its last gap
    expect(bad({ step: 'build', done: true })).toBeNull();
    expect(bad({ step: 'fill', index: 3, done: false })).toBeNull();
    expect(bad({ step: 'fill', index: 1, done: true })).toBeNull();
    expect(bad({ step: 'fill', index: 3, done: true })).not.toBeNull();
  });
});
