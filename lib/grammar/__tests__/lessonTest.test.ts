// Pure logic of the end-of-lesson grammar test:
// button condition, 10 questions, 80% threshold, the lesson's % does not change,
// saving / reading back the result, the list for the "Test passed" badge.

import { getGrammarTopics, isMarkItem, isTrialItem, type GrammarItem } from '@/lib/games/content';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { askedColumn, diffWords, isPersonTable } from '@/lib/grammar/resultDetail';
import { doneGrammarTopicProgress, lessonFor, scoredKinds } from '@/lib/grammar/syllabus';
import { kindBestKey, kindProgressFromRows, lessonScore, lessonScoresByTopic } from '@/lib/grammar/lessonScore';
import {
  LESSON_TEST_PASS_PCT,
  LESSON_TEST_SIZE,
  buildLessonTest,
  lessonTestFromRows,
  lessonTestKey,
  lessonTestPassedTopics,
  lessonTestSize,
  lessonTestUnlocked,
  mergeLessonTestResult,
  type LessonTestQuestion,
} from '../lessonTest';

type Row = { itemId: string; state: string; data: unknown };
const TOPIC = 'presente-regular';
const lesson = () => lessonFor('es', TOPIC)!;
const opts = (seed = 1) => ({ seed, learnedLang: 'es', contentLang: 'en' });

const bestRows = (topicId: string, kinds: ReturnType<typeof scoredKinds>) =>
  kinds.map((k) => ({ itemId: kindBestKey(topicId, k), state: 'best', data: { correct: 5, total: 10 } }));

describe('button condition', () => {
  it('the lesson test has questions and the lesson page has its kinds too', () => {
    expect(lessonTestSize(lesson(), 'es', 'en')).toBe(LESSON_TEST_SIZE);
    expect(scoredKinds(lesson()).length).toBeGreaterThan(1);
  });

  it('locked without a round', () => {
    expect(lessonTestUnlocked(lesson(), [], TOPIC)).toBe(false);
  });

  it('opens if there was a finished round of EVERY kind', () => {
    const kinds = scoredKinds(lesson());
    expect(lessonTestUnlocked(lesson(), bestRows(TOPIC, kinds), TOPIC)).toBe(true);
  });

  it('a single missing kind keeps it locked', () => {
    const kinds = scoredKinds(lesson());
    expect(lessonTestUnlocked(lesson(), bestRows(TOPIC, kinds.slice(1)), TOPIC)).toBe(false);
  });

  it('an abandoned round (run) does not count as a round', () => {
    const kinds = scoredKinds(lesson());
    const rows = [
      ...bestRows(TOPIC, kinds.slice(1)),
      { itemId: `${TOPIC}:${kinds[0]}:run`, state: 'run', data: { seed: 1, ids: ['a'], index: 1, correct: 1, total: 1 } },
    ];
    expect(lessonTestUnlocked(lesson(), rows, TOPIC)).toBe(false);
  });

  it('the old done row and the old whole-lesson row also count as a round', () => {
    const kinds = scoredKinds(lesson());
    const perKind = kinds.map((k) => ({ itemId: `${TOPIC}:${k}`, state: 'done', data: { correct: 9, total: 10 } }));
    expect(lessonTestUnlocked(lesson(), perKind, TOPIC)).toBe(true);
    expect(lessonTestUnlocked(lesson(), [{ itemId: TOPIC, state: 'done', data: { correct: 1, total: 1 } }], TOPIC)).toBe(true);
  });
});

describe('the test questions', () => {
  it('10 questions, with unique items, mixed kinds', () => {
    const qs = buildLessonTest(lesson(), opts());
    expect(qs).toHaveLength(LESSON_TEST_SIZE);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    expect(new Set(qs.map((q) => q.kind)).size).toBeGreaterThan(1);
  });

  it('the same seed gives the same order, a different seed another order', () => {
    const a = buildLessonTest(lesson(), opts(7)).map((q) => q.id);
    expect(buildLessonTest(lesson(), opts(7)).map((q) => q.id)).toEqual(a);
    expect(buildLessonTest(lesson(), opts(8)).map((q) => q.id)).not.toEqual(a);
  });

  it('the retry draws new items ahead (avoid), and the missed ones come before the rest', () => {
    const first = buildLessonTest(lesson(), opts(1));
    const used = new Set(first.map((q) => q.id));
    const retry = buildLessonTest(lesson(), { ...opts(2), avoid: used });
    const fresh = retry.filter((q) => !used.has(q.id)).length;
    // at least as many fresh items as the lesson still has left
    const pool = lesson().items.filter((it) => !isTrialItem(it as GrammarItem)).length;
    expect(fresh).toBeGreaterThanOrEqual(Math.min(LESSON_TEST_SIZE, pool - used.size) - 2);
    const missed = new Set(first.slice(0, 2).map((q) => q.id));
    const again = buildLessonTest(lesson(), { ...opts(3), missedBefore: missed });
    expect(again.filter((q) => missed.has(q.id)).length).toBe(missed.size);
  });

  it('there is no trial and no dictation item in the test', () => {
    for (const [lang, content] of [['es', 'en'], ['en', 'es'], ['hu', 'en'], ['hu', 'es']] as const) {
      for (const l of getGrammarTopics(lang)) {
        const byId = new Map((l.items as GrammarItem[]).map((it) => [it.id, it]));
        for (const q of buildLessonTest(l, { seed: 1, learnedLang: lang, contentLang: content })) {
          const it = byId.get(q.id)!;
          expect(isTrialItem(it)).toBe(false);
          expect(it.kind).not.toBe('dictation');
        }
      }
    }
  });

  const checkQuestion = (q: LessonTestQuestion) => {
    expect(q.review.question).toBeTruthy();
    const v = q.view;
    if (v.card === 'choice') {
      expect(v.options.length).toBeGreaterThanOrEqual(2);
      expect(v.correctIndex).toBeGreaterThanOrEqual(0);
      expect(v.correctIndex).toBeLessThan(v.options.length);
      expect(v.text).toBeTruthy();
      expect(q.review.answer).toBeTruthy();
    } else if (v.card === 'type') {
      expect(v.answer).toBeTruthy();
      expect(v.prompt).toBeTruthy();
    } else if (v.card === 'tiles') {
      expect(v.answerTokens.length).toBeGreaterThanOrEqual(2);
    } else {
      expect(v.pairs.length).toBeGreaterThanOrEqual(2);
    }
  };

  it('a valid test comes together for every written lesson (es, en and hu direction)', () => {
    for (const [lang, content] of [['es', 'en'], ['en', 'es'], ['hu', 'en'], ['hu', 'es']] as const) {
      const lessons = getGrammarTopics(lang);
      expect(lessons.length).toBeGreaterThan(0);
      for (const l of lessons) {
        const qs = buildLessonTest(l, { seed: 3, learnedLang: lang, contentLang: content });
        expect(qs.length).toBeGreaterThan(0);
        expect(qs.length).toBeLessThanOrEqual(LESSON_TEST_SIZE);
        qs.forEach(checkQuestion);
      }
    }
  });
});

describe('every item kind turns into an exam card', () => {
  const all = (topic: string, lang = 'es', content = 'en') =>
    buildLessonTest(lessonFor(lang, topic)!, { seed: 5, learnedLang: lang, contentLang: content, size: 200 });

  // The current error-spotting / word-order items are all temporary (trial), so the test skips them;
  // the post-approval state is given by the copy without the trial flag.
  const approved = (topic: string) => {
    const l = lessonFor('es', topic)!;
    return { ...l, items: (l.items as GrammarItem[]).map((it) => ({ ...it, trial: undefined })) } as typeof l;
  };
  const allApproved = (topic: string) => buildLessonTest(approved(topic), { seed: 5, learnedLang: 'es', contentLang: 'en', size: 200 });

  it('the trial error-spotting / word-order item is left out of the test', () => {
    const kinds = new Set(all('negacion').map((q) => q.kind));
    expect(kinds.has('spot')).toBe(false);
    expect(kinds.has('order')).toBe(false);
  });

  it('error spotting: the wrong word in «», the corrected sentence on the result page', () => {
    const spots = allApproved('negacion').filter((q) => q.kind === 'spot');
    expect(spots.length).toBeGreaterThan(0);
    for (const q of spots) {
      expect(q.view.card).toBe('choice');
      if (q.view.card === 'choice') expect(q.view.text).toMatch(/«[^»]+»/);
      expect(q.review.answer).not.toBe(q.review.question);
    }
  });

  it('word order: tiles from the words of the sentence, the question in the UI language', () => {
    const orders = allApproved('negacion').filter((q) => q.kind === 'order');
    expect(orders.length).toBeGreaterThan(0);
    for (const q of orders) {
      expect(q.view.card).toBe('tiles');
      if (q.view.card === 'tiles') expect(q.view.answerTokens.join(' ').toLowerCase()).toBe(q.view.sentence.replace(/[.,;:!?¡¿]/g, '').toLowerCase());
    }
  });

  it('sentence rewrite: type-it card, the answer is the lesson solution, the hint names the tense', () => {
    const transforms = all('ir-a-infinitivo').filter((q) => q.kind === 'transform');
    expect(transforms.length).toBeGreaterThan(0);
    for (const q of transforms) {
      expect(q.view.card).toBe('type');
      if (q.view.card === 'type') {
        expect(q.view.sentence).toBe(true);
        expect(q.view.hint).toMatch(/\*[^*]+\*/);
      }
    }
  });

  it('FB549: the sentence to read aloud is the whole right sentence, none for a form', () => {
    const qs = all(TOPIC);
    const gap = qs.filter((q) => q.view.card === 'choice' && q.kind === 'choice');
    expect(gap.length).toBeGreaterThan(0);
    for (const q of gap) expect(q.say).toBe(q.review.answer); // the gap filled with the right option
    for (const q of qs.filter((x) => x.kind === 'why')) {
      if (q.view.card === 'choice') expect(q.say).toBe(q.view.text);
    }
    for (const q of all('ir-a-infinitivo').filter((x) => x.kind === 'transform')) expect(q.say).toBe(q.review.answer);
    for (const q of allApproved('negacion').filter((x) => x.kind === 'spot' || x.kind === 'order')) expect(q.say).toBe(q.review.answer);
    for (const q of qs.filter((x) => x.kind === 'form')) expect(q.say).toBeUndefined();
  });

  it('conjugation and "why": conjugation is type-it, "why" is multiple choice with the lesson explanation', () => {
    const qs = all(TOPIC);
    expect(qs.filter((q) => q.kind === 'form').every((q) => q.view.card === 'type')).toBe(true);
    const why = qs.filter((q) => q.kind === 'why');
    expect(why.length).toBeGreaterThan(0);
    expect(why.every((q) => q.view.card === 'choice' && !!q.review.why)).toBe(true);
    // the result sheet also shows the question text (e.g. "Why «Escriben»?"), not just the sentence
    for (const q of why) {
      if (q.view.card !== 'choice') continue;
      expect(q.review.question).toBe(`${q.view.heading}\n${q.view.text}`);
    }
    expect(why.some((q) => /^Why «/.test(q.review.question))).toBe(true);
  });

  it('a test also comes from the "transform only" lesson (indefinido-10-verbos)', () => {
    const qs = all('indefinido-10-verbos');
    expect(qs.length).toBe(50);
    expect(buildLessonTest(lessonFor('es', 'indefinido-10-verbos')!, opts()).length).toBe(LESSON_TEST_SIZE);
  });
});

describe('the pass and the save', () => {
  it('80% is the boundary: 8/10 passed, 7/10 not, 79.9% does not round to 80 either', () => {
    expect(LESSON_TEST_PASS_PCT).toBe(80);
    expect(mergeLessonTestResult(undefined, 8, 10, '2026-10-01', []).passed).toBe(true);
    expect(mergeLessonTestResult(undefined, 7, 10, '2026-10-01', []).passed).toBe(false);
    expect(mergeLessonTestResult(null, 799, 1000, '2026-10-01', []).passed).toBe(false);
    expect(mergeLessonTestResult(null, 799, 1000, '2026-10-01', []).best).toBe(79);
  });

  it('after a fail the pass and the best score stay, the last attempt is overwritten', () => {
    const first = mergeLessonTestResult(null, 9, 10, '2026-10-01', ['a']);
    const second = mergeLessonTestResult(first, 5, 10, '2026-10-02', ['b', 'c']);
    expect(second).toEqual({ passed: true, best: 90, bestAt: '2026-10-01', last: 50, lastAt: '2026-10-02', missed: ['b', 'c'] });
    const third = mergeLessonTestResult(second, 10, 10, '2026-10-03', []);
    expect(third.best).toBe(100);
    expect(third.bestAt).toBe('2026-10-03');
  });

  it('readable back from the rows, and the "Test passed" list gives only the passed lessons', () => {
    const passed = mergeLessonTestResult(null, 9, 10, '2026-10-01', []);
    const failed = mergeLessonTestResult(null, 4, 10, '2026-10-01', ['x']);
    const rows = [
      { itemId: lessonTestKey('ser-estar'), state: 'passed', data: passed },
      { itemId: lessonTestKey('posesivos'), state: 'failed', data: failed },
      { itemId: 'ser-estar:choice:best', state: 'best', data: { correct: 1, total: 1 } },
    ];
    expect(lessonTestFromRows(rows, 'ser-estar')).toEqual(passed);
    expect(lessonTestFromRows(rows, 'posesivos')).toEqual(failed);
    expect(lessonTestFromRows(rows, 'hay-estar')).toBeNull();
    expect([...lessonTestPassedTopics(rows)]).toEqual(['ser-estar']);
  });
});

describe('the test does not count toward the lesson %', () => {
  it('the lesson %, the done mark and the syllabus list % are the same with and without the test row', () => {
    const kinds = scoredKinds(lesson());
    const base: Row[] = [
      ...bestRows(TOPIC, kinds),
      { itemId: TOPIC + ':' + kinds[0], state: 'done', data: { correct: 9, total: 10 } },
    ];
    const withTest = [...base, { itemId: lessonTestKey(TOPIC), state: 'passed', data: mergeLessonTestResult(null, 10, 10, '2026-10-01', []) }];
    const pct = (rows: Row[]) => lessonScore(kinds.map((k) => kindProgressFromRows(rows, TOPIC, k)));
    expect(pct(withTest)).toBe(pct(base));
    expect(lessonScoresByTopic(withTest, () => kinds)).toEqual(lessonScoresByTopic(base, () => kinds));
    expect(doneGrammarTopicProgress('es', withTest)).toEqual(doneGrammarTopicProgress('es', base));
  });
});

// FB576-581, FB588, FB589: the level test's readable form task and the data of its result card.
describe('form tasks and result data', () => {
  const COURSES = ['es', 'en', 'de', 'hu'];
  const questionsOf = (lang: string, topic: string, contentLang = 'en') =>
    buildLessonTest(lessonFor(lang, topic)!, { seed: 1, learnedLang: lang, contentLang, size: 9999 });
  const byId = (lang: string, topic: string, id: string) => questionsOf(lang, topic).find((q) => q.id === id)!;

  it('the task line of a form item is never a bare column header, in all four courses', () => {
    let checked = 0;
    let tables = 0;
    for (const lang of COURSES) {
      for (const lesson of getGrammarTopics(lang)) {
        const headers = new Set(
          lesson.body.flatMap((b) => (b.kind === 'table' ? b.header.flatMap((h) => Object.values(h).map((v) => v.trim().toLowerCase())) : []))
        );
        for (const q of buildLessonTest(lesson, { seed: 1, learnedLang: lang, contentLang: 'en', size: 9999 })) {
          if (q.kind !== 'form' || q.view.card !== 'type') continue;
          checked++;
          const v = q.view;
          expect(v.prompt.trim()).not.toBe('');
          // a cell may look like a header word ("um"), but then the card names its table and column; alone it never does
          if (headers.has(v.prompt.trim().toLowerCase())) expect(v.heading && v.label).toBeTruthy();
          expect(v.hint).toBeTruthy();
          const item = lesson.items.find((i) => i.id === q.id);
          if (!item || item.kind !== 'form') throw new Error(`no form item ${q.id}`);
          const table = lesson.body.find((x) => x.kind === 'table' && x.id === item.table);
          if (v.heading) {
            // a non-verb table: the title heads the card and the first column's header labels the cell, which is a row of the table
            expect(v.label).toBeTruthy();
            expect(v.hint).not.toBe('Type the correct form');
            expect(table && table.kind === 'table' && table.rows.some((r) => r[0] === v.prompt)).toBe(true);
            expect(q.review.question).toBe(`${v.label}: ${v.prompt}`);
          } else {
            // askable: the stem (the verb or column, and the person or cell) is on the card
            expect(v.prompt).toContain(' · ');
            expect(v.prompt).toContain(item.person);
            expect(v.prompt.startsWith(item.verb)).toBe(true);
          }
          if (q.detail?.table) tables++;
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
    expect(tables).toBeGreaterThan(checked / 2);
  });

  it('a verb table keeps verb (meaning) · person; any other table gets title, column label, the cell and "Type the <column>"', () => {
    const gu = byId('es', 'gustar', 'gu-form-12').view;
    expect(gu).toMatchObject({ card: 'type', prompt: 'gustar + varias cosas (gustar + several things) · ellos/ellas/ustedes', hint: 'Type the form of the verb' });
    expect((gu as { heading?: string }).heading).toBeUndefined();
    const int = byId('es', 'interrogativos', 'int-form-04').view;
    expect(int).toMatchObject({
      card: 'type',
      heading: 'From the answer to the question word',
      label: 'Answer',
      prompt: 'A la tienda.',
      hint: 'Type the question word',
    });
    const nh = byId('es', 'numeros-hora-fecha', 'nh-form-06').view;
    expect(nh).toMatchObject({ card: 'type', heading: 'Numbers', label: 'Number', prompt: '1:00' });
    expect((nh as { hint?: string }).hint).toBe('Type the word');
  });

  it('the hint keeps the capital of a German column label', () => {
    const { setLanguage } = require('@/lib/i18n');
    setLanguage('de');
    try {
      expect((byId('es', 'interrogativos', 'int-form-04').view as { hint?: string }).hint).toBe('Gib ein: Question word');
    } finally {
      setLanguage('en');
    }
  });

  it('a person table shows the whole column of the verb with the asked cell; another table only the asked row', () => {
    const t1 = byId('es', 'gustar', 'gu-form-12').detail!.table!;
    expect(t1.header).toEqual(['Person', 'gustar + several things']);
    expect(t1.rows).toHaveLength(6);
    expect(t1.rows[t1.hl!.row][t1.hl!.col]).toBe('les gustan');
    const t2 = byId('es', 'interrogativos', 'int-form-04').detail!.table!;
    expect(t2.rows).toHaveLength(1);
    expect(t2.rows[0][0]).toBe('A la tienda.');
    expect(t2.rows[0][t2.hl!.col]).toBe('adónde');
    const t3 = byId('es', 'numeros-hora-fecha', 'nh-form-06').detail!.table!;
    expect(t3.rows).toHaveLength(1);
  });

  it('the rule is the nearest text or tip before the table, absent when there is none', () => {
    const lesson = lessonFor('es', 'gustar')!;
    const table = lesson.body.find((b) => b.kind === 'table')!;
    const before = lesson.body
      .slice(0, lesson.body.indexOf(table))
      .reverse()
      .find((b) => b.kind === 'text' || b.kind === 'tip');
    const rule = byId('es', 'gustar', 'gu-form-12').detail!.rule;
    if (before && (before.kind === 'text' || before.kind === 'tip')) expect(rule).toBe(before.text.en);
    else expect(rule).toBeUndefined();
    let without = 0;
    let withRule = 0;
    for (const lang of COURSES) {
      for (const lesson2 of getGrammarTopics(lang)) {
        for (const q of buildLessonTest(lesson2, { seed: 1, learnedLang: lang, contentLang: 'en', size: 9999 })) {
          if (q.kind !== 'form') continue;
          if (q.detail?.rule) withRule++;
          else without++;
        }
      }
    }
    expect(withRule).toBeGreaterThan(without);
  });

  it("a typed mistake: the item's own text first (lowercase, spaces ignored; accents kept first), then which other form it is, else nothing", () => {
    const explain = byId('es', 'gustar', 'gu-form-12').detail!.explainTyped!;
    expect(explain('los gustan')).toMatch(/direct object pronoun/);
    expect(explain('  LOS   Gustan ')).toMatch(/direct object pronoun/);
    expect(explain('nos gustan')).toBe('That is another form: nosotros · gustar + several things.');
    // accents kept first: "tú gusta" / "mí gusta" are not the possessive "tu gusta" / "mi gusta"; a forgotten accent still finds it
    const tu = byId('es', 'gustar', 'gu-form-02').detail!.explainTyped!;
    expect(tu('tu gusta')).toMatch(/possessive/);
    expect(tu('tú gusta')).toBeNull();
    expect(tu('tú gustas')).toMatch(/other way round/);
    expect(tu('tu gustas')).toMatch(/other way round/);
    expect(byId('es', 'gustar', 'gu-form-01').detail!.explainTyped!('mí gusta')).toBeNull();
    expect(explain('zzz')).toBeNull();
    expect(explain('')).toBeNull();
  });

  it('all 10 gustar form items have mistake texts in en and es; the sibling lesson has none', () => {
    const forms = lessonFor('es', 'gustar')!.items.filter((i) => i.kind === 'form');
    expect(forms).toHaveLength(10);
    for (const f of forms) {
      if (f.kind !== 'form') continue;
      const keys = Object.keys(f.wrong ?? {});
      expect(keys.length).toBeGreaterThanOrEqual(3);
      expect(keys).not.toContain(f.answer);
      for (const k of keys) {
        expect(f.wrong![k].en.length).toBeGreaterThan(20);
        expect(f.wrong![k].es.length).toBeGreaterThan(20);
      }
    }
    const { items } = lessonFor('es', 'verbos-como-gustar')!;
    expect(items.some((i) => i.kind === 'form' && i.wrong)).toBe(false);
  });

  it('a choice item carries one why-not text per wrong option and a translation that is not the sentence itself', () => {
    let withWhyNot = 0;
    let withTr = 0;
    for (const lesson of getGrammarTopics('es').slice(0, 40)) {
      for (const q of buildLessonTest(lesson, { seed: 1, learnedLang: 'es', contentLang: 'en', size: 9999 })) {
        const d = q.detail;
        if (!d) continue;
        if (d.whyNot) {
          withWhyNot++;
          if (q.view.card === 'choice') {
            expect(d.whyNot.map((w) => w.option)).not.toContain(q.review.answer);
            expect(d.whyNot.length).toBeLessThan(q.view.options.length);
            for (const w of d.whyNot) expect(w.text).not.toBe('');
          }
        }
        if (d.tr) withTr++;
        if (d.filled) expect(`${d.filled.before}${d.filled.word}${d.filled.after}`.length).toBeGreaterThan(2);
      }
    }
    expect(withWhyNot).toBeGreaterThan(20);
    expect(withTr).toBeGreaterThan(0);
  });

  it('every mark item of every course has its answer among the options at correctIndex (FB579)', () => {
    let marks = 0;
    for (const lang of COURSES) {
      for (const lesson of getGrammarTopics(lang)) {
        for (const seed of [1, 2]) {
          for (const r of buildGrammarRound(lesson, seed)) {
            if (!isChoiceRoundItem(r) || !isMarkItem(r.item)) continue;
            marks++;
            expect(r.options[r.correctIndex]).toBe(r.item.answer);
          }
        }
      }
    }
    expect(marks).toBeGreaterThan(0);
  });

  it('person and column helpers: the asked column follows the schema rule; word marking is position based', () => {
    const verbTable = lessonFor('es', 'gustar')!.body.find((b) => b.kind === 'table')!;
    if (verbTable.kind !== 'table') throw new Error('table');
    expect(isPersonTable(verbTable)).toBe(true);
    expect(askedColumn(verbTable, 'gustar + varias cosas')).toBe(2);
    expect(diffWords('los gustan', 'les gustan')).toEqual({
      typed: [
        { w: 'los', diff: true },
        { w: 'gustan', diff: false },
      ],
      right: [
        { w: 'les', diff: true },
        { w: 'gustan', diff: false },
      ],
    });
    expect(diffWords('gustan', 'les gustan').right).toEqual([
      { w: 'les', diff: true },
      { w: 'gustan', diff: false },
    ]);
    expect(diffWords('Adónde', 'adónde').typed[0].diff).toBe(false);
  });
});
