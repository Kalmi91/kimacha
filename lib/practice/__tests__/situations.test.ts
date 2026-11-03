import { gapByWord } from '../gapFill';
import a1Deck from '@/data/words/de/a1.json';
import a2Deck from '@/data/words/de/a2.json';
import b1Deck from '@/data/words/de/b1.json';
import b2Deck from '@/data/words/de/b2.json';
import { knownTokens, sentenceTokens } from '@/lib/knownSentence';
import {
  SITUATIONS,
  SITUATIONS_DE,
  answerSituation,
  buildTraps,
  fillBank,
  fillGaps,
  headwordOf,
  isSituationOpen,
  lineText,
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
const familie = SITUATIONS_DE.find((s) => s.id === 'a1-familie')!;
const NOTHING: ReadonlySet<string> = knownTokens('es', { learned: [] });
const EVERYTHING = new Set(family.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
const NOTHING_DE: ReadonlySet<string> = knownTokens('de', { learned: [] });
const EVERYTHING_DE = new Set(familie.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
const ALL = [...SITUATIONS, ...SITUATIONS_DE];
const LANGS = ['en', 'es', 'hu', 'de'] as const;

describe('data/practice/situations.json and situations-de.json', () => {
  it.each(ALL.map((s) => [s.id, s] as const))('%s: texts in en, es, hu and de; unique ids; the dialogue is in the situation\'s target language', (_id, s) => {
    expect(ALL.filter((x) => x.id === s.id)).toHaveLength(1);
    expect(s.target).toBe(SITUATIONS.includes(s) ? 'es' : 'de');
    for (const text of [s.title, s.setting]) for (const lang of LANGS) expect(text[lang].trim()).not.toBe('');
    for (const l of s.lines) for (const lang of LANGS) expect(l[lang].trim()).not.toBe('');
    for (const w of s.words) for (const lang of LANGS) expect(w[lang].trim()).not.toBe('');
    for (const p of s.patterns) {
      for (const lang of LANGS) expect(p.title[lang].trim()).not.toBe('');
      // the explanation is in the learner's language, so every language but the target's has one
      for (const lang of LANGS.filter((l) => l !== s.target)) expect((p[lang] ?? '').trim()).not.toBe('');
    }
  });

  it.each(ALL.map((s) => [s.id, s] as const))('%s: every token of the lines and the answers is one of the situation\'s own forms or a free word', (_id, s) => {
    const own = new Set(s.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
    const free = knownTokens(s.target, { learned: [] });
    const texts = [...s.lines.map((l) => lineText(s, l)), ...s.lines.flatMap((l) => l.answers ?? []), ...s.patterns.map((p) => p.example)];
    for (const text of texts) {
      for (const token of sentenceTokens(text, s.target)) expect({ text, token, ok: own.has(token) || free.has(token) }).toMatchObject({ ok: true });
    }
    // so the gate is open with nothing learned
    expect(isSituationOpen(s, new Set())).toBe(true);
  });

  it.each(ALL.map((s) => [s.id, s] as const))('%s: gaps are whole words of their line, build lines exist and are the learner\'s', (_id, s) => {
    for (const l of s.lines) if (l.gap) expect(gapByWord(lineText(s, l), l.gap)).not.toBeNull();
    expect(s.build.length).toBeGreaterThan(0);
    for (const i of s.build) {
      expect(s.lines[i]).toBeDefined();
      expect(s.lines[i].speaker).toBe('me');
    }
  });

  it.each(ALL.map((s) => [s.id, s] as const))('%s: the first answer of every question is the next line of the learner', (_id, s) => {
    for (const i of questionLines(s)) {
      const next = s.lines[i + 1];
      expect(next?.speaker).toBe('me');
      expect(s.lines[i].answers![0]).toBe(lineText(s, next));
    }
  });

  it.each(ALL.map((s) => [s.id, s] as const))('%s: the distractors are words of the dialogue that fit no gap', (_id, s) => {
    expect(s.distractors.length).toBeGreaterThan(0);
    const tokens = new Set(s.lines.flatMap((l) => sentenceTokens(lineText(s, l), s.target)));
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
  it('only the Spanish and the German target have situations', () => {
    expect(situationsFor('es', 'en')).toBe(SITUATIONS);
    expect(situationsFor('de', 'en')).toBe(SITUATIONS_DE);
    expect(situationsFor('en')).toEqual([]);
    expect(situationsFor('hu')).toEqual([]);
  });

  it('a situation is told in a language only when every text of it has that language', () => {
    for (const source of ['en', 'hu', 'de'] as const) expect(situationsFor('es', source)).toBe(SITUATIONS);
    for (const source of ['en', 'hu', 'es'] as const) expect(situationsFor('de', source)).toBe(SITUATIONS_DE);
    // the target language has no situation of its own (the English and the Hungarian deck have no dialogues)
    expect(situationsFor('en', 'es')).toEqual([]);
    expect(situationsFor('hu', 'es')).toEqual([]);
  });

  it('a line with a word that nothing teaches closes the situation', () => {
    const odd: Situation = { ...family, lines: [...family.lines, { speaker: 'me', es: 'Tengo un perro.', en: 'x', hu: 'x', de: 'x' }] };
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

describe('the German family lunch (target de)', () => {
  it('6 lines, gaps habe / wohnen / Jahre (a noun keeps its capital), build of lines 2, 4 and 6, 3 questions', () => {
    expect(familie.lines).toHaveLength(6);
    expect(fillGaps(familie)).toEqual([{ line: 1, word: 'habe' }, { line: 3, word: 'wohnen' }, { line: 5, word: 'Jahre' }]);
    expect(familie.build).toEqual([1, 3, 5]);
    expect(questionLines(familie)).toEqual([0, 2, 4]);
    expect(situationTotals(familie)).toEqual({ fill: 3, build: 3, say: 6, questions: 3 });
    expect(gapByWord(familie.lines[5].de, 'Jahre')).toEqual({ before: 'Mein Bruder ist dreißig ', answer: 'Jahre', after: ' alt.' });
  });

  it('the first question has the model answer first, then the short forms, the plural forms with umlaut and the ones with keine', () => {
    expect(familie.lines[0].answers![0]).toBe('Ja, ich habe einen Bruder und eine Schwester.');
    expect(familie.lines[0].answers).toEqual(expect.arrayContaining([
      'Ich habe einen Bruder.',
      'Ja, ich habe zwei Brüder.',
      'Nein, ich habe keine Geschwister.',
      'Ich habe keine Geschwister.',
    ]));
  });

  it('the Words step lists the words none of whose forms is known: closed-class words are free, a headword has its article', () => {
    const none = unknownWords(familie, NOTHING_DE).map((w) => headwordOf(familie, w));
    // articles, pronouns, possessives, kein, und, in, wo, wie are closed-class words a learner never needs a card for
    for (const free of ['ein', 'und', 'ich', 'du', 'er', 'sie', 'mein', 'dein', 'kein', 'in', 'wo', 'wie']) expect(none).not.toContain(free);
    for (const content of ['haben', 'ja', 'nein', 'der Bruder', 'die Schwester', 'zwei', 'wohnen', 'sein', 'alt', 'das Jahr', 'dreißig']) expect(none).toContain(content);
    expect(none).toContain('der Bruder');
    expect(none).toContain('die Eltern (Pl.)');
    const some = unknownWords(familie, knownTokens('de', { learned: ['der Bruder', 'ja', 'brüder'] })).map((w) => headwordOf(familie, w));
    expect(some).not.toContain('der Bruder');
    expect(some).not.toContain('ja');
    expect(some).toContain('die Schwester');
    expect(unknownWords(familie, EVERYTHING_DE)).toEqual([]);
  });

  it('a line with a word that nothing teaches closes the situation', () => {
    const odd: Situation = { ...familie, lines: [...familie.lines, { speaker: 'me', de: 'Ich habe einen Hund.', es: 'x', en: 'x', hu: 'x' }] };
    expect(isSituationOpen(odd, NOTHING_DE)).toBe(false);
    expect(isSituationOpen(odd, new Set(['hund']))).toBe(true);
  });

  it('the word bank keeps the capital of a noun and is the 3 gap words and the 2 distractors; the same seed gives the same order', () => {
    const bank = fillBank(familie, 7);
    expect([...bank].sort()).toEqual(['Jahre', 'habe', 'hast', 'ist', 'wohnen']);
    expect(fillBank(familie, 7)).toEqual(bank);
  });

  it('the traps of a Build line are 2 words of the other lines, a noun with its capital, none of them in the line', () => {
    for (const i of familie.build) {
      const own = sentenceTokens(familie.lines[i].de, 'de');
      const traps = buildTraps(familie, i, 3);
      expect(traps).toHaveLength(2);
      for (const t of traps) expect(own).not.toContain(t.toLowerCase());
      expect(buildTraps(familie, i, 3)).toEqual(traps);
    }
    const all = new Set(familie.build.flatMap((i) => [3, 4, 5, 6, 7, 8, 9].flatMap((seed) => buildTraps(familie, i, seed))));
    expect(all.has('Eltern') || all.has('Geschwister') || all.has('Schwester') || all.has('Bruder')).toBe(true);
    for (const w of all) expect(w).not.toMatch(/^(eltern|geschwister|schwester|bruder)$/);
  });

  it('a run of the German situation saves and resumes like the Spanish one', () => {
    let st = startSituation(familie, NOTHING_DE, 42);
    expect(st.words[0]).toBe('haben');
    const seen: string[] = [];
    for (let guard = 0; st.step !== 'summary' && guard < 200; guard++) {
      expect(parseSituation(JSON.parse(JSON.stringify(savedSituation(st))), [familie])).toEqual(st);
      seen.push(st.step);
      st = st.step === 'words' || st.step === 'patterns' || st.done ? nextSituation(st, familie) : answerSituation(st, familie, true);
    }
    expect(new Set(seen)).toEqual(new Set(['words', 'patterns', 'fill', 'build', 'say', 'questions']));
    expect(st.scores).toEqual({ fill: 3, build: 3, say: 6, questions: 3 });
    // a Spanish run is not a run of the German situation
    expect(parseSituation(savedSituation(startSituation(family, NOTHING, 1)), [familie])).toBeNull();
  });
});

describe('the German situations', () => {
  const RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 } as const;
  const norm = (head: string) =>
    head.replace(/\([^)]*\)/g, '').replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
  // the lowest level of every German headword of the deck (a card can hold several branches: "gehen / fahren")
  const deckLevel = new Map<string, number>();
  for (const [level, cards] of [[1, a1Deck], [2, a2Deck], [3, b1Deck], [4, b2Deck]] as const) {
    for (const card of cards as { de: string }[]) {
      for (const branch of card.de.split(' / ')) if (!deckLevel.has(norm(branch))) deckLevel.set(norm(branch), level);
    }
  }
  // words the German situations may teach although the deck has no card of that form: names, the auxiliary haben, closed-class words
  const FREE_HEADS = new Set(['berlin', 'haben', 'ich', 'sie', 'er', 'es', 'ihn', 'ihnen', 'ihr', 'mir', 'wir', 'uns', 'sich', 'ein', 'der', 'kein', 'mein', 'was', 'wie', 'wo', 'wohin', 'wann', 'warum', 'welch', 'worum', 'und', 'oder', 'aber', 'denn', 'dass', 'als', 'nicht', 'sehr', 'so', 'etwas', 'ander', 'für', 'um', 'nach', 'bei', 'in', 'zu', 'am', 'über', 'ohne', 'seit', 'vor', 'mit']);

  it('has 11 situations: A1 x4, A2 x3, B1 x2, B2 x2 with the planned ids', () => {
    expect(SITUATIONS_DE.map((s) => s.id)).toEqual([
      'a1-familie', 'a1-baeckerei', 'a1-weg', 'a1-cafe',
      'a2-arzt', 'a2-wohnung', 'a2-zugticket',
      'b1-hotel', 'b1-vorstellung',
      'b2-mietvertrag', 'b2-reklamation',
    ]);
    expect(SITUATIONS_DE.map((s) => s.level)).toEqual(['A1', 'A1', 'A1', 'A1', 'A2', 'A2', 'A2', 'B1', 'B1', 'B2', 'B2']);
  });

  it.each(SITUATIONS_DE.filter((s) => s.id !== 'a1-familie').map((s) => [s.id, s] as const))('%s: every taught word is a card of the German deck at or below the level of the situation', (_id, s) => {
    for (const w of s.words) {
      const head = norm(headwordOf(s, w));
      if (FREE_HEADS.has(head)) continue;
      expect(deckLevel.get(head) ?? 99).toBeLessThanOrEqual(RANK[s.level]);
    }
  });

  it.each(SITUATIONS_DE.map((s) => [s.id, s] as const))('%s: 3 gaps, 3 build lines, 3 or more questions, and a run goes through all steps', (_id, s) => {
    expect(fillGaps(s)).toHaveLength(3);
    expect(s.build).toHaveLength(3);
    expect(questionLines(s).length).toBeGreaterThanOrEqual(3);
    // no em dash anywhere in the texts
    expect(JSON.stringify(s)).not.toContain('\u2014');
    let st = startSituation(s, NOTHING_DE, 5);
    const seen = new Set<string>();
    for (let guard = 0; st.step !== 'summary' && guard < 300; guard++) {
      seen.add(st.step);
      st = st.step === 'words' || st.step === 'patterns' || st.done ? nextSituation(st, s) : answerSituation(st, s, true);
    }
    expect(st.step).toBe('summary');
    expect(seen).toEqual(new Set(['words', 'patterns', 'fill', 'build', 'say', 'questions']));
  });

  it('the formal situations answer with Sie, the model answers of the cafe and the way start with the model line', () => {
    for (const id of ['a1-baeckerei', 'a1-weg', 'a1-cafe', 'a2-arzt', 'b1-hotel']) {
      const s = SITUATIONS_DE.find((x) => x.id === id)!;
      expect(s.lines.some((l) => /\bSie\b|\bIhnen\b|\bIhre\b/.test(l.de))).toBe(true);
    }
    const weg = SITUATIONS_DE.find((x) => x.id === 'a1-weg')!;
    expect(weg.lines[0].answers).toEqual(expect.arrayContaining(['Gehen Sie geradeaus.', 'Sie gehen hier geradeaus.']));
    const cafe = SITUATIONS_DE.find((x) => x.id === 'a1-cafe')!;
    expect(cafe.lines[0].answers).toEqual(expect.arrayContaining(['Einen Kaffee, bitte.', 'Ich möchte einen Kaffee, bitte.']));
  });
});
