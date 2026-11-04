import { CORPUS_NAMES } from '@/lib/corpusNames';
import { sentenceTokens } from '@/lib/knownSentence';
import type { Lang } from '@/lib/languagePair';
import { matchSpoken } from '@/lib/practice/situationMatch';
import {
  MAX_TRIES,
  STORIES,
  answerTurn,
  bubbleOf,
  closingOf,
  currentTurn,
  finishedProgress,
  judgeAnswer,
  longestPath,
  parseRun,
  progressById,
  progressOf,
  savedRun,
  setMode,
  skipTurn,
  speakable,
  startStory,
  storiesFor,
  storiesOfLevel,
  turnById,
  unknownWords,
  type SpeechStory,
  type StoryRun,
  type StoryText,
} from '../stories';

const story = STORIES[0];
// the first story walked on its first branch everywhere: name, from, age, work, study, speak, bye
const FIRST_WAY = ['name', 'from', 'age', 'work', 'study', 'speak', 'bye'];
const total = FIRST_WAY.length;
const right = (branch = 0, text = 'me llamo Ana') => ({ branch, text });
const wrong = (text = 'hola') => ({ branch: null, text });
// a run on the turn `id` of the first way, every earlier turn answered right at the first try on its first branch
const at = (id: string, run: StoryRun = startStory(story, 'voice')): StoryRun => {
  let state = run;
  while (currentTurn(story, state).id !== id) state = answerTurn(state, story, right());
  return state;
};

describe('storiesFor / storiesOfLevel', () => {
  it('Spanish has the stories, every other direction has none', () => {
    expect(storiesFor('es', 'en')).toEqual(STORIES);
    expect(storiesFor('en')).toEqual([]);
    expect(storiesFor('hu')).toEqual([]);
    expect(storiesFor('de')).toEqual([]);
  });

  it('a level lists its own stories only', () => {
    expect(storiesOfLevel('es', 'A1', 'hu').map((s) => s.id)).toContain('a1-presentacion');
    expect(storiesOfLevel('es', 'A2', 'hu')).toEqual([]);
    expect(storiesOfLevel('en', 'A1', 'hu')).toEqual([]);
  });

  it("a story without the learner's language is not offered (nothing of another language in its place)", () => {
    expect(storiesFor('es', 'fr' as unknown as Lang)).toEqual([]);
  });
});

describe('unknownWords', () => {
  it('the words none of whose forms is known, forms compared in lower case', () => {
    const known = new Set(['hola', 'soy', 'oaxaca']);
    const words = unknownWords(story, known).map((w) => w.es);
    expect(words).not.toContain('hola');
    expect(words).not.toContain('ser');
    expect(words).not.toContain('Oaxaca');
    expect(words).toContain('la vecina');
    expect(words).toContain('un poco');
  });

  it('everything known: nothing is new, nothing known: every word', () => {
    const everything = new Set(story.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
    expect(unknownWords(story, everything)).toEqual([]);
    expect(unknownWords(story, new Set())).toHaveLength(story.words.length);
  });
});

describe('the run', () => {
  it('starts on the first turn with nothing counted', () => {
    expect(startStory(story, 'voice')).toEqual({ id: story.id, mode: 'voice', path: ['name'], tries: 0, firstTry: 0, answers: [], done: false });
    expect(startStory(story, 'type').mode).toBe('type');
  });

  it('a right answer at the first try: the text and the branch are kept, a point, the story goes on with the branch\'s next turn', () => {
    const next = answerTurn(startStory(story, 'voice'), story, right(0, 'me llamo Ana'));
    expect(next).toMatchObject({ path: ['name', 'from'], tries: 0, firstTry: 1, done: false, answers: [{ text: 'me llamo Ana', ok: true, branch: 0 }] });
  });

  it('the answer decides how the story goes on: every branch of a turn leads where its next says', () => {
    const work = at('work');
    expect(currentTurn(story, answerTurn(work, story, right(0))).id).toBe('study');
    expect(currentTurn(story, answerTurn(work, story, right(1))).id).toBe('speak');
    expect(currentTurn(story, answerTurn(work, story, right(2))).id).toBe('speak');
    expect(currentTurn(story, answerTurn(work, story, right(3))).id).toBe('like');
    expect(answerTurn(work, story, right(3)).answers[3]).toMatchObject({ ok: true, branch: 3 });
  });

  it('a wrong answer is one more try and nothing else', () => {
    const start = startStory(story, 'voice');
    expect(answerTurn(start, story, wrong())).toEqual({ ...start, tries: 1 });
    expect(answerTurn(answerTurn(start, story, wrong()), story, wrong())).toEqual({ ...start, tries: 2 });
  });

  it('a right answer after a wrong one moves on without a point, and the tries start again', () => {
    const next = answerTurn(answerTurn(startStory(story, 'voice'), story, wrong()), story, right());
    expect(next).toMatchObject({ path: ['name', 'from'], tries: 0, firstTry: 0, answers: [{ ok: true }] });
  });

  it('Next is allowed from two wrong tries only: the first say line of the main branch goes in as given up, no point', () => {
    const start = startStory(story, 'voice');
    expect(skipTurn(start, story)).toBe(start);
    const one = answerTurn(start, story, wrong());
    expect(skipTurn(one, story)).toBe(one);
    const two = answerTurn(one, story, wrong());
    expect(two.tries).toBe(MAX_TRIES);
    expect(skipTurn(two, story)).toMatchObject({ path: ['name', 'from'], tries: 0, firstTry: 0, done: false, answers: [{ text: 'Me llamo ___.', ok: false, branch: 0 }] });
  });

  it('a given-up turn follows its `main` branch (work: the fourth, speak: the first)', () => {
    const giveUp = (run: StoryRun) => skipTurn(answerTurn(answerTurn(run, story, wrong()), story, wrong()), story);
    const work = giveUp(at('work'));
    expect(currentTurn(story, work).id).toBe('like');
    expect(work.answers[3]).toEqual({ text: 'Trabajo en una oficina.', ok: false, branch: 3 });
    expect(currentTurn(story, giveUp(at('speak'))).id).toBe('bye');
  });

  it('the last answer finishes the run, and a finished run does not change', () => {
    let state = startStory(story, 'type');
    for (let i = 0; i < total; i++) {
      expect(state.done).toBe(false);
      state = answerTurn(state, story, right(0, `answer ${i}`));
    }
    expect(state).toMatchObject({ path: FIRST_WAY, done: true, firstTry: total });
    expect(state.answers).toHaveLength(total);
    expect(answerTurn(state, story, right())).toBe(state);
    expect(answerTurn(state, story, wrong())).toBe(state);
    expect(skipTurn(state, story)).toBe(state);
  });

  it('the last turn given up also finishes the run', () => {
    let state = at('bye');
    state = answerTurn(answerTurn(state, story, wrong()), story, wrong());
    state = skipTurn(state, story);
    expect(state).toMatchObject({ path: FIRST_WAY, done: true, firstTry: total - 1 });
    expect(state.answers[total - 1]).toEqual({ text: 'Gracias, adiós.', ok: false, branch: 0 });
  });

  it('the way of answering changes the run only', () => {
    const start = startStory(story, 'voice');
    expect(setMode(start, 'type')).toEqual({ ...start, mode: 'type' });
    expect(setMode(start, 'voice')).toBe(start);
  });
});

describe('judging an answer', () => {
  const work = turnById(story, 'work')!;

  it('the first branch with a right match, in data order', () => {
    expect(judgeAnswer(work, 'no trabajo', { lang: 'es' }).branch).toBe(0);
    expect(judgeAnswer(work, 'soy estudiante', { lang: 'es' }).branch).toBe(1);
    expect(judgeAnswer(work, 'busco trabajo', { lang: 'es' }).branch).toBe(2);
    expect(judgeAnswer(work, 'soy maestra', { lang: 'es' }).branch).toBe(3);
    expect(judgeAnswer(work, 'trabajo en una oficina', { lang: 'es' }).branch).toBe(3);
  });

  it('a wrong answer: no branch, the red words come from the closest answer over all branches', () => {
    const { branch, match } = judgeAnswer(work, 'estudio', { lang: 'es' });
    expect(branch).toBeNull();
    expect(match.right).toBe(false);
    expect(match.best).toBe('Estudio *');
    expect(judgeAnswer(work, 'la mesa es azul', { lang: 'es' }).branch).toBeNull();
  });
});

describe('the counter, the bubbles and the voice', () => {
  it('the longest way from a turn counts the turns to an end, itself included', () => {
    expect(longestPath(story, 'name')).toBe(total);
    expect(longestPath(story, 'work')).toBe(4);
    expect(longestPath(story, 'bye')).toBe(1);
  });

  it('answered + 1 over answered + the longest way ahead (the mock: 4/7 on the work turn), a finished run: all of it', () => {
    expect(progressOf(story, startStory(story, 'voice'))).toEqual({ n: 1, total: 7 });
    expect(progressOf(story, at('work'))).toEqual({ n: 4, total: 7 });
    // the student answer skips two turns of the longest way
    expect(progressOf(story, answerTurn(at('work'), story, right(1)))).toEqual({ n: 5, total: 6 });
    let state = startStory(story, 'voice');
    for (let i = 0; i < total; i++) state = answerTurn(state, story, right());
    expect(progressOf(story, state)).toEqual({ n: 7, total: 7 });
  });

  it('her reaction to a right answer and the next line are one bubble, in every language; a given-up turn has no reaction', () => {
    const run = answerTurn(startStory(story, 'voice'), story, right());
    const second = turnById(story, 'from')!;
    expect(bubbleOf(story, run, 0, 'es')).toBe(story.turns[0].es);
    expect(bubbleOf(story, run, 1, 'es')).toBe(`Mucho gusto. ${second.es}`);
    expect(bubbleOf(story, run, 1, 'en')).toBe(`Nice to meet you. ${second.en}`);
    const gaveUp = skipTurn(answerTurn(answerTurn(startStory(story, 'voice'), story, wrong()), story, wrong()), story);
    expect(bubbleOf(story, gaveUp, 1, 'es')).toBe(second.es);
  });

  it('a blank is left out of what the voice reads', () => {
    expect(speakable('Me llamo ___.')).toBe('Me llamo.');
    expect(speakable('Tengo ___ años.')).toBe('Tengo años.');
    expect(speakable('Hablo un poco.')).toBe('Hablo un poco.');
  });
});

describe('her closing words', () => {
  const text = (es: string): StoryText => ({ es, en: es, hu: es, de: es });
  const small: SpeechStory = {
    ...story,
    id: 'small',
    turns: [
      { id: 'a', ...text('a'), branches: [{ answers: ['Sí'], say: [text('Sí.')], reply: text('Gracias.'), next: 'b' }] },
      { id: 'b', ...text('b'), branches: [{ answers: ['Sí'], say: [text('Sí.')], reply: text('Adiós.') }, { answers: ['No'], say: [text('No.')] }] },
    ],
  };

  it('a last reply on a branch without next turn is the closing bubble; none without a reply or before the end', () => {
    let run = answerTurn(startStory(small, 'type'), small, right(0, 'sí'));
    expect(closingOf(small, run, 'es')).toBeNull();
    expect(closingOf(small, answerTurn(run, small, right(0, 'sí')), 'es')).toBe('Adiós.');
    expect(closingOf(small, answerTurn(run, small, right(1, 'no')), 'es')).toBeNull();
    run = startStory(story, 'type');
    for (let i = 0; i < total; i++) run = answerTurn(run, story, right());
    expect(closingOf(story, run, 'es')).toBeNull();
  });
});

describe('saving a run', () => {
  const open = answerTurn(answerTurn(startStory(story, 'type'), story, right(0, 'soy Ana')), story, wrong());

  it('round trip: an open run comes back as it was, also through JSON', () => {
    expect(parseRun(savedRun(open), STORIES)).toEqual(open);
    expect(parseRun(JSON.parse(JSON.stringify(savedRun(open))), STORIES)).toEqual(open);
    const branched = answerTurn(at('work'), story, right(1));
    expect(parseRun(savedRun(branched), STORIES)).toEqual(branched);
  });

  it('a finished run comes back finished', () => {
    let state = startStory(story, 'voice');
    for (let i = 0; i < total; i++) state = answerTurn(state, story, right());
    expect(parseRun(savedRun(state), STORIES)).toEqual(state);
  });

  it('a run saved before the branches (v 1) is dropped', () => {
    const old = { v: 1, id: story.id, mode: 'type', turn: 1, tries: 0, firstTry: 1, answers: [{ text: 'soy Ana', ok: true }], done: false };
    expect(parseRun(old, STORIES)).toBeNull();
    expect((savedRun(open) as { v: number }).v).toBe(2);
  });

  it('drops a broken run, one of a story that is gone, or one that does not fit the story\'s graph', () => {
    const saved = savedRun(open) as Record<string, unknown>;
    expect(parseRun(null, STORIES)).toBeNull();
    expect(parseRun('run', STORIES)).toBeNull();
    expect(parseRun({}, STORIES)).toBeNull();
    expect(parseRun(saved, [])).toBeNull();
    expect(parseRun({ ...saved, id: 'other' }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, v: 3 }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, mode: 'sing' }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, tries: 'x' }, STORIES)).toBeNull();
    // the path
    expect(parseRun({ ...saved, path: [] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, path: ['from', 'age'] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, path: ['name', 'nowhere'] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, path: ['name', 'age'] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, path: 'name' }, STORIES)).toBeNull();
    // the answers are one per finished turn, each on a branch of its turn that leads to the next turn of the path
    expect(parseRun({ ...saved, answers: [] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, answers: [{ text: 1, ok: true, branch: 0 }] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, answers: [{ text: 'x', ok: true }] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, answers: [{ text: 'x', ok: true, branch: 5 }] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, answers: [null] }, STORIES)).toBeNull();
    // more points than right answers
    expect(parseRun({ ...saved, firstTry: 2 }, STORIES)).toBeNull();
    // done must agree with the path
    expect(parseRun({ ...saved, done: true }, STORIES)).toBeNull();
    let state = startStory(story, 'voice');
    for (let i = 0; i < total; i++) state = answerTurn(state, story, right());
    expect(parseRun({ ...(savedRun(state) as object), done: false }, STORIES)).toBeNull();
  });
});

describe('the progress row', () => {
  it('best and total are one pair: a run with more points replaces both, a run with fewer or equal points only moves the date', () => {
    expect(finishedProgress({ best: 4, total: 5, at: '2026-11-01' }, { firstTry: 4 }, 7, '2026-11-03')).toEqual({ best: 4, total: 5, at: '2026-11-03' });
    expect(finishedProgress({ best: 4, total: 5, at: '2026-11-01' }, { firstTry: 3 }, 7, '2026-11-03')).toEqual({ best: 4, total: 5, at: '2026-11-03' });
    expect(finishedProgress({ best: 4, total: 5, at: '2026-11-01' }, { firstTry: 5 }, 7, '2026-11-03')).toEqual({ best: 5, total: 7, at: '2026-11-03' });
    expect(finishedProgress({ best: 4 }, { firstTry: 3 }, 7, '2026-11-03')).toEqual({ best: 3, total: 7, at: '2026-11-03' });
  });

  it('best keeps the higher value, the date is the last finish', () => {
    expect(finishedProgress(null, { firstTry: 4 }, 6, '2026-11-03')).toEqual({ best: 4, total: 6, at: '2026-11-03' });
    expect(finishedProgress({ best: 5, total: 6, at: '2026-11-01' }, { firstTry: 3 }, 6, '2026-11-03')).toEqual({ best: 5, total: 6, at: '2026-11-03' });
    expect(finishedProgress({ best: 2, total: 6, at: '2026-11-01' }, { firstTry: 6 }, 6, '2026-11-03').best).toBe(6);
    expect(finishedProgress({ best: 'x' }, { firstTry: 1 }, 6, '2026-11-03').best).toBe(1);
  });

  it('reads the finished stories from the rows, broken ones are ignored', () => {
    const rows = [
      { itemId: 'a1-presentacion', state: 'done', data: { best: 4, total: 6, at: '2026-11-03' } },
      { itemId: 'broken', state: 'done', data: { best: 'x' } },
      { itemId: 'open', state: 'open', data: { best: 1, total: 6 } },
      { itemId: 'none', state: 'done', data: null },
    ];
    expect([...progressById(rows)]).toEqual([['a1-presentacion', { best: 4, total: 6, at: '2026-11-03' }]]);
  });
});

// ---- the check every story of the file has to pass (the next stories are added to the same file) ----

const LANGS: Lang[] = ['en', 'es', 'hu', 'de'];
// what the learner says for the blank of a `say` line
const TEST_WORD = 'Ana';
const filled = (line: string) => line.replace(/_+/g, TEST_WORD);
const blanked = (line: string) => line.replace(/_+/g, ' ');

/** The ids a turn can lead to. */
const nextsOf = (s: SpeechStory, id: string): string[] => (turnById(s, id)?.branches ?? []).flatMap((b) => (b.next ? [b.next] : []));

/** A way back to a turn already on the way (a cycle), or null. */
function cycleIn(s: SpeechStory): string[] | null {
  const walk = (id: string, way: string[]): string[] | null => {
    if (way.includes(id)) return [...way, id];
    for (const next of nextsOf(s, id)) {
      const found = walk(next, [...way, id]);
      if (found) return found;
    }
    return null;
  };
  return walk(s.turns[0].id, []);
}

describe.each(STORIES.map((s) => [s.id, s] as const))('story check: %s', (_id, s) => {
  it('every next exists, there is no cycle, every turn is reached and the story ends', () => {
    const ids = s.turns.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const turn of s.turns) {
      expect([turn.id, turn.branches.length > 0]).toEqual([turn.id, true]);
      for (const next of nextsOf(s, turn.id)) expect({ from: turn.id, next, exists: ids.includes(next) }).toMatchObject({ exists: true });
      if (turn.main !== undefined) expect(turn.branches[turn.main]).toBeDefined();
    }
    expect(cycleIn(s)).toBeNull();
    const reached = new Set<string>();
    const visit = (id: string) => {
      if (reached.has(id)) return;
      reached.add(id);
      nextsOf(s, id).forEach(visit);
    };
    visit(s.turns[0].id);
    expect(ids.filter((id) => !reached.has(id))).toEqual([]);
    // an end = a branch without next, and every way goes there (no cycle, so it has to)
    expect(s.turns.some((turn) => turn.branches.some((b) => !b.next))).toBe(true);
  });

  it('the answer changes the story: at least one turn has branches with different next turns', () => {
    expect(s.turns.some((turn) => new Set(turn.branches.map((b) => b.next ?? '')).size > 1)).toBe(true);
  });

  it('every turn shows at least two lines under "You can say"', () => {
    for (const turn of s.turns) expect([turn.id, turn.branches.reduce((n, b) => n + b.say.length, 0) >= 2]).toEqual([turn.id, true]);
    for (const turn of s.turns) for (const b of turn.branches) expect([turn.id, b.say.length > 0, b.answers.length > 0]).toEqual([turn.id, true, true]);
  });

  it.each([false, true])('every say line is accepted by its own branch and by no earlier branch that leads elsewhere or reacts differently (typed with strict accents: %s)', (strictAccents) => {
    for (const turn of s.turns) {
      turn.branches.forEach((b, j) => {
        for (const line of b.say) {
          const heard = filled(line.es);
          const own = matchSpoken(heard, b.answers, { lang: 'es', anyNumber: b.anyNumber, strictAccents }).right;
          expect({ turn: turn.id, heard, own }).toEqual({ turn: turn.id, heard, own: true });
          for (let i = 0; i < j; i++) {
            const earlier = turn.branches[i];
            const same = earlier.next === b.next && JSON.stringify(earlier.reply) === JSON.stringify(b.reply);
            const taken = matchSpoken(heard, earlier.answers, { lang: 'es', anyNumber: earlier.anyNumber, strictAccents }).right;
            if (!same) expect({ turn: turn.id, heard, earlier: i, taken }).toEqual({ turn: turn.id, heard, earlier: i, taken: false });
          }
          // the judge sends it to its own branch, or to an earlier one that is the same for the story
          const at = judgeAnswer(turn, heard, { lang: 'es', strictAccents }).branch;
          expect({ turn: turn.id, heard, at: at !== null && at <= j }).toEqual({ turn: turn.id, heard, at: true });
        }
      });
    }
  });

  it('every text exists in the four languages', () => {
    const texts: StoryText[] = [s.title, s.teaser, s.intro, s.outro, ...s.words, ...s.turns, ...s.turns.flatMap((turn) => turn.branches.flatMap((b) => [...b.say, ...(b.reply ? [b.reply] : [])]))];
    for (const text of texts) for (const lang of LANGS) expect(text[lang].trim()).not.toBe('');
    for (const w of s.words) expect(w.forms.length).toBeGreaterThan(0);
  });

  it('every token of the lines and the say lines is a form of the story or a name', () => {
    const own = new Set(s.words.flatMap((w) => w.forms.map((f) => f.toLowerCase())));
    const names = new Set([...CORPUS_NAMES.es.flatMap((n) => sentenceTokens(n, 'es')), ...sentenceTokens(s.speaker, 'es')]);
    const unknown: string[] = [];
    for (const turn of s.turns) {
      const texts = [turn.es, ...turn.branches.flatMap((b) => [...b.say.map((x) => blanked(x.es)), ...(b.reply ? [b.reply.es] : [])])];
      for (const text of texts) for (const token of sentenceTokens(text, 'es')) if (!own.has(token) && !names.has(token)) unknown.push(token);
    }
    expect([...new Set(unknown)]).toEqual([]);
  });
});

describe('the first story: broad answers (FB582, FB583)', () => {
  const speak = turnById(story, 'speak')!;
  const bye = turnById(story, 'bye')!;
  const branchOf = (turn: typeof speak, said: string) => judgeAnswer(turn, said, { lang: 'es' }).branch;

  it('FB582: "puedo hablar español", "sí", "no", "un poco" and "no mucho" are all answers to "¿Hablas español?"', () => {
    expect(branchOf(speak, 'puedo hablar español')).toBe(2);
    expect(branchOf(speak, 'sí')).toBe(2);
    expect(branchOf(speak, 'no')).toBe(1);
    expect(branchOf(speak, 'un poco')).toBe(0);
    expect(branchOf(speak, 'no mucho')).toBe(1);
    expect(branchOf(speak, 'Sí, hablo español')).toBe(2);
    expect(branchOf(speak, 'hablo un poco de español')).toBe(0);
  });

  it('the first turns take a bare name, a bare country, and an age as a bare number', () => {
    const name = turnById(story, 'name')!;
    const from = turnById(story, 'from')!;
    const age = turnById(story, 'age')!;
    expect(judgeAnswer(name, 'Ana', { lang: 'es' }).branch).toBe(0);
    expect(judgeAnswer(from, 'México', { lang: 'es' }).branch).toBe(0);
    expect(judgeAnswer(from, 'soy mexicano', { lang: 'es' }).branch).toBe(0);
    for (const said of ['35', 'treinta y cinco', 'cuarenta', 'tengo 35 años']) expect({ said, branch: judgeAnswer(age, said, { lang: 'es' }).branch }).toEqual({ said, branch: 0 });
    expect(judgeAnswer(age, 'prefiero no decirlo', { lang: 'es' }).branch).toBe(1);
  });

  it('FB583: "gracias", "adiós", "hasta luego" and "nos vemos" end the story', () => {
    for (const said of ['gracias', 'adiós', 'adios', 'hasta luego', 'nos vemos', 'gracias, adiós']) {
      expect({ said, branch: branchOf(bye, said) }).toEqual({ said, branch: 0 });
    }
    expect(bye.branches[0].next).toBeUndefined();
  });
});
