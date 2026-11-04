import type { Lang } from '@/lib/languagePair';
import {
  MAX_TRIES,
  STORIES,
  answerTurn,
  finishedProgress,
  parseRun,
  progressById,
  savedRun,
  setMode,
  skipTurn,
  startStory,
  storiesFor,
  storiesOfLevel,
  unknownWords,
} from '../stories';

const story = STORIES[0];
const total = story.turns.length;
const right = (text = 'me llamo Ana') => ({ right: true, text });
const wrong = (text = 'hola') => ({ right: false, text });

describe('storiesFor / storiesOfLevel', () => {
  it('Spanish has the stories, every other direction has none', () => {
    expect(storiesFor('es', 'en')).toEqual(STORIES);
    expect(storiesFor('en')).toEqual([]);
    expect(storiesFor('hu')).toEqual([]);
    expect(storiesFor('de')).toEqual([]);
  });

  it('a level lists its own stories only', () => {
    expect(storiesOfLevel('es', 'A1', 'hu').map((s) => s.id)).toEqual(['a1-presentacion']);
    expect(storiesOfLevel('es', 'A2', 'hu')).toEqual([]);
    expect(storiesOfLevel('en', 'A1', 'hu')).toEqual([]);
  });

  it("a story without the learner's language is not offered (nothing of another language in its place)", () => {
    expect(storiesFor('es', 'fr' as unknown as Lang)).toEqual([]);
  });
});

describe('unknownWords', () => {
  it('the words none of whose forms is known, forms compared in lower case', () => {
    const known = new Set(['hola', 'soy', 'hungría']);
    const words = unknownWords(story, known).map((w) => w.es);
    expect(words).not.toContain('hola');
    expect(words).not.toContain('ser');
    expect(words).not.toContain('Hungría');
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
    expect(startStory(story, 'voice')).toEqual({ id: story.id, mode: 'voice', turn: 0, tries: 0, firstTry: 0, answers: [], done: false });
    expect(startStory(story, 'type').mode).toBe('type');
  });

  it('a right answer at the first try: the text is kept, a point, the next turn', () => {
    const next = answerTurn(startStory(story, 'voice'), story, right('me llamo Ana'));
    expect(next).toMatchObject({ turn: 1, tries: 0, firstTry: 1, done: false, answers: [{ text: 'me llamo Ana', ok: true }] });
  });

  it('a wrong answer is one more try and nothing else', () => {
    const start = startStory(story, 'voice');
    expect(answerTurn(start, story, wrong())).toEqual({ ...start, tries: 1 });
    expect(answerTurn(answerTurn(start, story, wrong()), story, wrong())).toEqual({ ...start, tries: 2 });
  });

  it('a right answer after a wrong one moves on without a point, and the tries start again', () => {
    const next = answerTurn(answerTurn(startStory(story, 'voice'), story, wrong()), story, right());
    expect(next).toMatchObject({ turn: 1, tries: 0, firstTry: 0, answers: [{ ok: true }] });
  });

  it('Next is allowed from two wrong tries only: the model goes in as given up, no point', () => {
    const start = startStory(story, 'voice');
    expect(skipTurn(start, story)).toBe(start);
    const one = answerTurn(start, story, wrong());
    expect(skipTurn(one, story)).toBe(one);
    const two = answerTurn(one, story, wrong());
    expect(two.tries).toBe(MAX_TRIES);
    expect(skipTurn(two, story)).toMatchObject({ turn: 1, tries: 0, firstTry: 0, done: false, answers: [{ text: story.turns[0].model, ok: false }] });
  });

  it('the last answer finishes the run, and a finished run does not change', () => {
    let state = startStory(story, 'type');
    for (let i = 0; i < total; i++) {
      expect(state.done).toBe(false);
      state = answerTurn(state, story, right(`answer ${i}`));
    }
    expect(state).toMatchObject({ turn: total, done: true, firstTry: total });
    expect(state.answers).toHaveLength(total);
    expect(answerTurn(state, story, right())).toBe(state);
    expect(answerTurn(state, story, wrong())).toBe(state);
    expect(skipTurn(state, story)).toBe(state);
  });

  it('the last turn given up also finishes the run', () => {
    let state = startStory(story, 'voice');
    for (let i = 0; i < total - 1; i++) state = answerTurn(state, story, right());
    state = answerTurn(answerTurn(state, story, wrong()), story, wrong());
    state = skipTurn(state, story);
    expect(state).toMatchObject({ turn: total, done: true, firstTry: total - 1 });
    expect(state.answers[total - 1]).toEqual({ text: story.turns[total - 1].model, ok: false });
  });

  it('the way of answering changes the run only', () => {
    const start = startStory(story, 'voice');
    expect(setMode(start, 'type')).toEqual({ ...start, mode: 'type' });
    expect(setMode(start, 'voice')).toBe(start);
  });
});

describe('saving a run', () => {
  const open = answerTurn(answerTurn(startStory(story, 'type'), story, right('soy Ana')), story, wrong());

  it('round trip: an open run comes back as it was, also through JSON', () => {
    expect(parseRun(savedRun(open), STORIES)).toEqual(open);
    expect(parseRun(JSON.parse(JSON.stringify(savedRun(open))), STORIES)).toEqual(open);
  });

  it('a finished run comes back finished', () => {
    let state = startStory(story, 'voice');
    for (let i = 0; i < total; i++) state = answerTurn(state, story, right());
    expect(parseRun(savedRun(state), STORIES)).toEqual(state);
  });

  it('drops a broken run, one of a story that is gone, or one that does not fit the story', () => {
    const saved = savedRun(open) as Record<string, unknown>;
    expect(parseRun(null, STORIES)).toBeNull();
    expect(parseRun('run', STORIES)).toBeNull();
    expect(parseRun({}, STORIES)).toBeNull();
    expect(parseRun(saved, [])).toBeNull();
    expect(parseRun({ ...saved, id: 'other' }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, v: 2 }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, mode: 'sing' }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, turn: total + 1 }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, turn: -1 }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, turn: 1.5 }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, tries: 'x' }, STORIES)).toBeNull();
    // the answers are one per finished turn
    expect(parseRun({ ...saved, answers: [] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, answers: [{ text: 1, ok: true }] }, STORIES)).toBeNull();
    expect(parseRun({ ...saved, answers: [null] }, STORIES)).toBeNull();
    // more points than right answers
    expect(parseRun({ ...saved, firstTry: 2 }, STORIES)).toBeNull();
    // done must agree with the turn
    expect(parseRun({ ...saved, done: true }, STORIES)).toBeNull();
  });
});

describe('the progress row', () => {
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
