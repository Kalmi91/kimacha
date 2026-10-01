// PLAN-vizsga B. szakasz (8. lépés): a nyelvtani lecke végi teszt tiszta logikája:
// gomb-feltétel (B1 b), 10 kérdés (B2 a), 80% határ, a lecke %-a nem változik (B3 a),
// az eredmény mentése / visszaolvasása, a "Test passed" jelhez a lista.

import { getGrammarTopics, isTrialItem, type GrammarItem } from '@/lib/games/content';
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

describe('gomb-feltétel (B1 b)', () => {
  it('a lecke tesztjének van kérdése és a lecke-oldalon fajtái is', () => {
    expect(lessonTestSize(lesson(), 'es', 'en')).toBe(LESSON_TEST_SIZE);
    expect(scoredKinds(lesson()).length).toBeGreaterThan(1);
  });

  it('kör nélkül zárt', () => {
    expect(lessonTestUnlocked(lesson(), [], TOPIC)).toBe(false);
  });

  it('akkor nyit, ha MINDEN fajtából volt befejezett kör', () => {
    const kinds = scoredKinds(lesson());
    expect(lessonTestUnlocked(lesson(), bestRows(TOPIC, kinds), TOPIC)).toBe(true);
  });

  it('egyetlen hiányzó fajta is zárva tartja', () => {
    const kinds = scoredKinds(lesson());
    expect(lessonTestUnlocked(lesson(), bestRows(TOPIC, kinds.slice(1)), TOPIC)).toBe(false);
  });

  it('a félbehagyott kör (run) nem számít körnek', () => {
    const kinds = scoredKinds(lesson());
    const rows = [
      ...bestRows(TOPIC, kinds.slice(1)),
      { itemId: `${TOPIC}:${kinds[0]}:run`, state: 'run', data: { seed: 1, ids: ['a'], index: 1, correct: 1, total: 1 } },
    ];
    expect(lessonTestUnlocked(lesson(), rows, TOPIC)).toBe(false);
  });

  it('a régi (FB290) kész-sor és a régi egész-lecke sor is körnek számít', () => {
    const kinds = scoredKinds(lesson());
    const perKind = kinds.map((k) => ({ itemId: `${TOPIC}:${k}`, state: 'done', data: { correct: 9, total: 10 } }));
    expect(lessonTestUnlocked(lesson(), perKind, TOPIC)).toBe(true);
    expect(lessonTestUnlocked(lesson(), [{ itemId: TOPIC, state: 'done', data: { correct: 1, total: 1 } }], TOPIC)).toBe(true);
  });
});

describe('a teszt kérdései (B2 a)', () => {
  it('10 kérdés, egyedi tételekkel, vegyes fajtával', () => {
    const qs = buildLessonTest(lesson(), opts());
    expect(qs).toHaveLength(LESSON_TEST_SIZE);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    expect(new Set(qs.map((q) => q.kind)).size).toBeGreaterThan(1);
  });

  it('ugyanaz a seed ugyanazt, másik seed más sorrendet ad', () => {
    const a = buildLessonTest(lesson(), opts(7)).map((q) => q.id);
    expect(buildLessonTest(lesson(), opts(7)).map((q) => q.id)).toEqual(a);
    expect(buildLessonTest(lesson(), opts(8)).map((q) => q.id)).not.toEqual(a);
  });

  it('az újrapróba új tételeket húz előre (avoid), és az elrontottak megelőzik a többit', () => {
    const first = buildLessonTest(lesson(), opts(1));
    const used = new Set(first.map((q) => q.id));
    const retry = buildLessonTest(lesson(), { ...opts(2), avoid: used });
    const fresh = retry.filter((q) => !used.has(q.id)).length;
    // legalább annyi friss tétel, amennyit a lecke még tartogat
    const pool = lesson().items.filter((it) => !isTrialItem(it as GrammarItem)).length;
    expect(fresh).toBeGreaterThanOrEqual(Math.min(LESSON_TEST_SIZE, pool - used.size) - 2);
    const missed = new Set(first.slice(0, 2).map((q) => q.id));
    const again = buildLessonTest(lesson(), { ...opts(3), missedBefore: missed });
    expect(again.filter((q) => missed.has(q.id)).length).toBe(missed.size);
  });

  it('nincs ideiglenes (trial) és nincs diktálás-tétel a tesztben', () => {
    for (const [lang, content] of [['es', 'en'], ['en', 'es']] as const) {
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

  it('minden megírt leckére (es és en irány) összeáll egy érvényes teszt', () => {
    for (const [lang, content] of [['es', 'en'], ['en', 'es']] as const) {
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

describe('minden tétel-fajta vizsga-kártyává alakul', () => {
  const all = (topic: string, lang = 'es', content = 'en') =>
    buildLessonTest(lessonFor(lang, topic)!, { seed: 5, learnedLang: lang, contentLang: content, size: 200 });

  // A mai hibakereső / szórend tételek mind ideiglenesek (trial), ezért a teszt kihagyja őket;
  // a jóváhagyás utáni állapotot a trial-jelzés nélküli másolat adja.
  const approved = (topic: string) => {
    const l = lessonFor('es', topic)!;
    return { ...l, items: (l.items as GrammarItem[]).map((it) => ({ ...it, trial: undefined })) } as typeof l;
  };
  const allApproved = (topic: string) => buildLessonTest(approved(topic), { seed: 5, learnedLang: 'es', contentLang: 'en', size: 200 });

  it('a trial hibakereső / szórend tétel kimarad a tesztből', () => {
    const kinds = new Set(all('negacion').map((q) => q.kind));
    expect(kinds.has('spot')).toBe(false);
    expect(kinds.has('order')).toBe(false);
  });

  it('hibakereső: a hibás szó «»-ben, a javított mondat az eredmény-lapon', () => {
    const spots = allApproved('negacion').filter((q) => q.kind === 'spot');
    expect(spots.length).toBeGreaterThan(0);
    for (const q of spots) {
      expect(q.view.card).toBe('choice');
      if (q.view.card === 'choice') expect(q.view.text).toMatch(/«[^»]+»/);
      expect(q.review.answer).not.toBe(q.review.question);
    }
  });

  it('szórend: csempék a mondat szavaiból, a kérdés a felület nyelvén', () => {
    const orders = allApproved('negacion').filter((q) => q.kind === 'order');
    expect(orders.length).toBeGreaterThan(0);
    for (const q of orders) {
      expect(q.view.card).toBe('tiles');
      if (q.view.card === 'tiles') expect(q.view.answerTokens.join(' ').toLowerCase()).toBe(q.view.sentence.replace(/[.,;:!?¡¿]/g, '').toLowerCase());
    }
  });

  it('mondat-átírás: begépelős kártya, a válasz a lecke megoldása, a hint megnevezi az igeidőt', () => {
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

  it('ragozás és "miért": a ragozás begépelős, a "miért" feleletválasztós a lecke magyarázatával', () => {
    const qs = all(TOPIC);
    expect(qs.filter((q) => q.kind === 'form').every((q) => q.view.card === 'type')).toBe(true);
    const why = qs.filter((q) => q.kind === 'why');
    expect(why.length).toBeGreaterThan(0);
    expect(why.every((q) => q.view.card === 'choice' && !!q.review.why)).toBe(true);
  });

  it('a "csak transform" leckéből is jön teszt (indefinido-10-verbos)', () => {
    const qs = all('indefinido-10-verbos');
    expect(qs.length).toBe(46);
    expect(buildLessonTest(lessonFor('es', 'indefinido-10-verbos')!, opts()).length).toBe(LESSON_TEST_SIZE);
  });
});

describe('az átmenés és a mentés', () => {
  it('80% a határ: 8/10 átment, 7/10 nem, a 79,9% sem kerekedik 80-ra', () => {
    expect(LESSON_TEST_PASS_PCT).toBe(80);
    expect(mergeLessonTestResult(undefined, 8, 10, '2026-10-01', []).passed).toBe(true);
    expect(mergeLessonTestResult(undefined, 7, 10, '2026-10-01', []).passed).toBe(false);
    expect(mergeLessonTestResult(null, 799, 1000, '2026-10-01', []).passed).toBe(false);
    expect(mergeLessonTestResult(null, 799, 1000, '2026-10-01', []).best).toBe(79);
  });

  it('a bukás után az átmenés és a legjobb pont megmarad, az utolsó próba felülíródik', () => {
    const first = mergeLessonTestResult(null, 9, 10, '2026-10-01', ['a']);
    const second = mergeLessonTestResult(first, 5, 10, '2026-10-02', ['b', 'c']);
    expect(second).toEqual({ passed: true, best: 90, bestAt: '2026-10-01', last: 50, lastAt: '2026-10-02', missed: ['b', 'c'] });
    const third = mergeLessonTestResult(second, 10, 10, '2026-10-03', []);
    expect(third.best).toBe(100);
    expect(third.bestAt).toBe('2026-10-03');
  });

  it('visszaolvasható a sorokból, és a "Test passed" lista csak az átment leckéket adja', () => {
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

describe('a teszt nem számít a lecke %-ába (B3 a)', () => {
  it('a lecke %-a, a kész-jelzés és a tanterv-lista %-a ugyanaz a teszt-sorral és anélkül', () => {
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
