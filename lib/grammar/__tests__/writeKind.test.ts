// Sentence writing (`write`): a trial kind only in the por-para and ser-estar lessons. The trap it must never fall into:
// a lesson that is already done must stay done, and the new kind must not touch the lesson % or the lesson test.
import { getGrammarTopics, grammarKindCounts, isTrialItem, isWriteItem, type GrammarItem } from '@/lib/games/content';
import { buildGrammarRound, grammarRoundItemKind, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { buildLessonTest, lessonTestUnlocked } from '../lessonTest';
import { kindBestKey, lessonScoresByTopic } from '../lessonScore';
import { doneGrammarTopicProgress, lessonFor, lessonKinds, scoredKinds } from '../syllabus';
import { isVosotrosItem } from '../vosotros';
import type { GrammarGapItem } from '@/lib/games/content';
import type { LessonV2, WriteItem } from '../lessonTypes';

const WRITE_LESSONS = ['por-para', 'ser-estar'] as const;
const lesson = (id: string) => lessonFor('es', id) as LessonV2;
const writeItems = (l: LessonV2) => (l.items as GrammarItem[]).filter(isWriteItem);
const gapItems = (l: LessonV2) => (l.items as GrammarItem[]).filter((i): i is GrammarGapItem => !i.kind && (i as GrammarGapItem).set !== 'article');

type Row = { itemId: string; state: string; data: unknown };
const doneRows = (topicId: string, kinds: readonly string[]): Row[] =>
  kinds.map((k) => ({ itemId: `${topicId}:${k}`, state: 'done', data: { correct: 9, total: 10 } }));

describe('write items in the data', () => {
  it('only por-para and ser-estar have them, 12 each, all trial', () => {
    for (const l of getGrammarTopics('es')) {
      const n = writeItems(l).length;
      if ((WRITE_LESSONS as readonly string[]).includes(l.topic)) {
        expect(n).toBe(12);
        expect(grammarKindCounts(l).write).toBe(12);
        expect(writeItems(l).every((i) => isTrialItem(i))).toBe(true);
      } else {
        expect(n).toBe(0);
        expect(grammarKindCounts(l).write).toBe(0);
      }
    }
  });

  it('no other direction has a write item', () => {
    for (const lang of ['en', 'hu', 'de']) {
      for (const l of getGrammarTopics(lang)) expect(writeItems(l)).toHaveLength(0);
    }
  });

  it('each one is made from its gap: same sentence filled in, same translation and explanation', () => {
    for (const id of WRITE_LESSONS) {
      const l = lesson(id);
      const gaps = gapItems(l);
      const writes = writeItems(l);
      expect(writes.map((w) => w.id)).toEqual(gaps.map((g) => `${g.id}-w`));
      writes.forEach((w, i) => {
        const gap = gaps[i];
        const filled = gap.sentence.replace('___', gap.options[gap.correct]);
        expect(w.es).toBe(filled);
        expect(w.es).not.toMatch(/[()_]/);
        expect(w.prompt).toEqual(gap.tr);
        expect(w.why).toEqual(gap.why);
      });
    }
  });

  it('accept lists hold other sentences: never the answer itself, no repeats, no empty entry', () => {
    for (const id of WRITE_LESSONS) {
      for (const w of writeItems(lesson(id))) {
        const accept = (w as WriteItem).accept ?? [];
        expect(accept).not.toContain(w.es);
        expect(new Set(accept).size).toBe(accept.length);
        for (const a of accept) expect(a.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('a write sentence is never a vosotros task', () => {
    for (const id of WRITE_LESSONS) {
      for (const w of writeItems(lesson(id))) expect(isVosotrosItem(w)).toBe(false);
    }
  });
});

describe('write is never required, never scored', () => {
  it('the scored kinds (lesson %) do not include it', () => {
    for (const id of WRITE_LESSONS) {
      expect(scoredKinds(lesson(id))).not.toContain('write');
      expect(lessonKinds('es', id)).not.toContain('write');
    }
    expect(scoredKinds(lesson('por-para'))).toEqual(['choice', 'match', 'form', 'why']);
  });

  it('a lesson done before the new kind existed stays done (por-para: no write row needed)', () => {
    const before = ['choice', 'match', 'form', 'why'];
    const done = doneGrammarTopicProgress('es', doneRows('por-para', before));
    expect(done.get('por-para')).toEqual({ state: 'done', correct: 36, total: 40 });
    // a done write row changes nothing: neither the state nor the totals
    const withWrite = doneGrammarTopicProgress('es', doneRows('por-para', [...before, 'write']));
    expect(withWrite.get('por-para')).toEqual({ state: 'done', correct: 36, total: 40 });
  });

  it('ser-estar still needs its dictation (the existing behaviour did not change), but not the write row', () => {
    const base = ['choice', 'match', 'form', 'why'];
    expect(doneGrammarTopicProgress('es', doneRows('ser-estar', base)).has('ser-estar')).toBe(false);
    expect(doneGrammarTopicProgress('es', doneRows('ser-estar', [...base, 'dictation'])).get('ser-estar')).toEqual({
      state: 'done',
      correct: 45,
      total: 50,
    });
  });

  it('the old whole-lesson row still means done', () => {
    const rows: Row[] = [{ itemId: 'por-para', state: 'done', data: { correct: 5, total: 6 } }];
    expect(doneGrammarTopicProgress('es', rows).get('por-para')).toEqual({ state: 'done', correct: 5, total: 6 });
  });

  it('the lesson % ignores a write result, the lesson test unlocks without it', () => {
    const l = lesson('por-para');
    const scored = scoredKinds(l);
    const best = (k: string, correct: number): Row => ({ itemId: kindBestKey('por-para', k as never), state: 'best', data: { correct, total: 10 } });
    const rows = scored.map((k) => best(k, 10));
    const withWrite = [...rows, best('write', 0)];
    expect(lessonScoresByTopic(withWrite, () => scored).get('por-para')).toBe(100);
    expect(lessonScoresByTopic(rows, () => scored).get('por-para')).toBe(100);
    expect(lessonTestUnlocked(l, rows, 'por-para')).toBe(true);
  });
});

describe('write in the round and the test', () => {
  it('buildGrammarRound keeps it out of the choice part and puts it at the end, in authored order', () => {
    for (const id of WRITE_LESSONS) {
      const l = lesson(id);
      const round = buildGrammarRound(l, 7);
      const choice = round.filter(isChoiceRoundItem);
      expect(choice.every((r) => (r.item as { kind?: string }).kind !== 'write')).toBe(true);
      expect(choice).toHaveLength(12);

      const kinds = round.map(grammarRoundItemKind);
      const firstWrite = kinds.indexOf('write');
      expect(firstWrite).toBeGreaterThan(0);
      expect(kinds.slice(firstWrite).every((k) => k === 'write')).toBe(true);
      expect(round.slice(firstWrite).map((r) => r.item.id)).toEqual(writeItems(l).map((w) => w.id));
    }
  });

  it('the lesson test (and so the random round) never asks a write item', () => {
    for (const id of WRITE_LESSONS) {
      for (const seed of [1, 2, 3]) {
        const qs = buildLessonTest(lesson(id), { seed, learnedLang: 'es', contentLang: 'en', size: 9999 });
        expect(qs.length).toBeGreaterThan(0);
        expect(qs.some((q) => q.id.endsWith('-w') || q.kind === 'write')).toBe(false);
      }
    }
  });
});
