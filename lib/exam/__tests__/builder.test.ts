// The exam item builder builds ONLY from the
// learned words of the level and the finished level lessons; no unknown word can
// get into an item (sentences go through the lib/knownSentence.ts gate).

import { pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import { knownTokens, resolvedTensesFromLessons, unknownTokens } from '@/lib/knownSentence';
import { learnedEntries, tileWords } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { buildExam, EXAM_BLUEPRINT, EXAM_SPEAK_COUNT, MATCH_PAIRS } from '../builder';
import { a1SeedCards } from '../devSeed';
import { gapSourcesForLevel } from '../grammarItems';
import type { ExamItem } from '../types';

const TODAY = '2026-10-01';
const LESSONS = ['presente-regular'];

const kinds = (items: ExamItem[]) => items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});
const learnedIds = (cards: Sm2Card[]) => new Set(cards.filter((c) => c.state === 'review').map((c) => c.itemId));

function setup(target: 'es' | 'en', learnedCount?: number, lessons: string[] = LESSONS) {
  setPcicTarget(target);
  const items = pcicItemsForLevel('A1');
  const all = a1SeedCards(items.map((i) => i.id), TODAY);
  const learned = learnedCount === undefined ? all : all.slice(0, learnedCount);
  // The other cards exist but are not graduated (introduced or new): their words must not get into an item.
  const rest = items.slice(learned.length).map((it, i) => (i % 2 ? { ...sm2NewCard(it.id), state: 'learning' as const } : sm2NewCard(it.id)));
  const cards = [...learned, ...rest];
  const input = {
    target,
    items,
    cards,
    tenses: target === 'es' ? resolvedTensesFromLessons(lessons) : new Set<never>(),
    gapSources: gapSourcesForLevel('A1', target, lessons),
    seed: 7,
  };
  return { items, cards, input };
}

afterAll(() => setPcicTarget('es'));

describe('buildExam: the A1 exam build (en→es)', () => {
  const { items, cards, input } = setup('es');
  const exam = buildExam(input);
  const byId = new Map(items.map((i) => [i.id, i]));
  const learned = learnedIds(cards);

  it('gives the item counts per the plan (word, matching, build, typing, grammar, reading)', () => {
    const k = kinds(exam);
    expect(k.word_type).toBe(EXAM_BLUEPRINT.wordType);
    expect(k.match).toBe(EXAM_BLUEPRINT.match);
    expect(k.sent_order).toBe(EXAM_BLUEPRINT.sentOrder);
    expect(k.sent_type).toBe(EXAM_BLUEPRINT.sentType);
    expect(k.gap_mc).toBe(EXAM_BLUEPRINT.gap);
    expect(k.reading_mc).toBeGreaterThanOrEqual(1);
    expect(k.reading_mc).toBeLessThanOrEqual(EXAM_BLUEPRINT.reading);
  });

  it('skill order: words, grammar, reading, spoken', () => {
    const skills = ['words', 'grammar', 'reading', 'speaking'];
    const order = exam.map((i) => i.skill);
    expect(order).toEqual([...order].sort((a, b) => skills.indexOf(a) - skills.indexOf(b)));
  });

  it('the spoken item count is EXAM_SPEAK_COUNT (default 4), and all items stay within 30', () => {
    expect(EXAM_SPEAK_COUNT).toBe(4);
    expect(kinds(exam).speak).toBe(EXAM_SPEAK_COUNT);
    expect(exam).toHaveLength(30);
  });

  it('the spoken item is a learned sentence: the source-language prompt, the target-language expected sentence, passes the sentence gate', () => {
    const ctx = { learned: learnedEntries(cards, 'es', (id) => byId.get(id)), tenses: input.tenses };
    const spoken = exam.filter((i): i is Extract<ExamItem, { kind: 'speak' }> => i.kind === 'speak');
    expect(spoken).toHaveLength(EXAM_SPEAK_COUNT);
    for (const sp of spoken) {
      const owner = byId.get(sp.itemId) as PcicItem;
      expect(learned.has(sp.itemId)).toBe(true);
      expect(sp.mode).toBe('translate');
      expect(sp.skill).toBe('speaking');
      expect(sp.prompt).toBe(owner.exampleEn);
      expect(sp.expected).toBe(owner.exampleEs);
      expect(unknownTokens(sp.expected, 'es', ctx)).toEqual([]);
    }
  });

  it('the spoken sentences do not repeat with another sentence item (build, typing, reading)', () => {
    const owners = exam.flatMap((i) => (i.kind === 'sent_order' || i.kind === 'sent_type' || i.kind === 'speak' ? [i.itemId] : i.kind === 'reading_mc' ? i.itemIds : []));
    expect(new Set(owners).size).toBe(owners.length);
  });

  it('every word-based item comes from a learned card (no unknown word ends up in an item)', () => {
    const ids = exam.flatMap((i) => ('itemId' in i ? [i.itemId] : 'itemIds' in i ? i.itemIds : []));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(learned.has(id)).toBe(true);
  });

  it('the words of unlearned cards appear nowhere in the items', () => {
    // 15% of the cards are not learned: their target-language words (which are not among the learned words) must not be in the exam.
    const known = knownTokens('es', { learned: learnedEntries(cards, 'es', (id) => byId.get(id)), tenses: input.tenses });
    const texts = exam.flatMap((i) => {
      switch (i.kind) {
        case 'word_type':
          return [i.answer];
        case 'match':
          return i.pairs.map((p) => p.left);
        case 'sent_order':
          return [i.answerTokens.join(' '), ...i.distractors];
        case 'sent_type':
          return [i.answer];
        case 'reading_mc':
          return [i.text];
        default:
          return [];
      }
    });
    const unlearned = items.filter((it) => !learned.has(it.id)).map((it) => it.es.split(' / ')[0].toLowerCase().replace(/^(el|la|los|las|un|una)\s+/, ''));
    const leaked = unlearned.filter((word) => !known.has(word) && texts.some((text) => tileWords(text.toLowerCase()).includes(word)));
    expect(leaked).toEqual([]);
  });

  it('every word of the sentence items (build, typing, reading) is learned or free, the tiles too', () => {
    const ctx = { learned: learnedEntries(cards, 'es', (id) => byId.get(id)), tenses: input.tenses };
    const known = knownTokens('es', ctx);
    const sentences = exam.flatMap((i) =>
      i.kind === 'sent_order' ? [i.answerTokens.join(' ')] : i.kind === 'sent_type' ? [i.answer] : i.kind === 'reading_mc' ? [i.text] : [],
    );
    expect(sentences.length).toBeGreaterThan(2);
    for (const sentence of sentences) expect(unknownTokens(sentence, 'es', ctx)).toEqual([]);
    for (const i of exam) {
      if (i.kind !== 'sent_order') continue;
      expect(i.distractors.length).toBeGreaterThan(0);
      for (const d of i.distractors) expect(known.has(d.toLowerCase())).toBe(true);
    }
  });

  it('the build item also carries the original sentence (capitalization, punctuation), the tiles are its words', () => {
    const orders = exam.filter((i): i is Extract<ExamItem, { kind: 'sent_order' }> => i.kind === 'sent_order');
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) {
      const owner = byId.get(o.itemId) as PcicItem;
      expect(o.sentence).toBe(owner.exampleEs);
      expect(tileWords(o.sentence)).toEqual(o.answerTokens);
    }
  });

  it('grammar items come only from finished lessons, with 3 answers and a valid correct index', () => {
    const gaps = exam.filter((i): i is Extract<ExamItem, { kind: 'gap_mc' }> => i.kind === 'gap_mc');
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(LESSONS).toContain(g.topicId);
      expect(g.sentence).toContain('___');
      expect(g.options.length).toBeGreaterThanOrEqual(2);
      expect(g.correctIndex).toBeGreaterThanOrEqual(0);
      expect(g.correctIndex).toBeLessThan(g.options.length);
    }
  });

  it('matching consists of 4 unique pairs, both sides are words', () => {
    const matches = exam.filter((i): i is Extract<ExamItem, { kind: 'match' }> => i.kind === 'match');
    for (const m of matches) {
      expect(m.pairs).toHaveLength(MATCH_PAIRS);
      expect(new Set(m.pairs.map((p) => p.left)).size).toBe(MATCH_PAIRS);
      expect(new Set(m.pairs.map((p) => p.right)).size).toBe(MATCH_PAIRS);
    }
  });

  it('the correct answer of reading is the translation of the two sentences, and the options differ', () => {
    const readings = exam.filter((i): i is Extract<ExamItem, { kind: 'reading_mc' }> => i.kind === 'reading_mc');
    for (const r of readings) {
      expect(new Set(r.options).size).toBe(r.options.length);
      const [a, b] = r.itemIds.map((id) => byId.get(id) as PcicItem);
      expect(r.text).toBe(`${a.exampleEs} ${b.exampleEs}`);
      expect(r.options[r.correctIndex]).toBe(`${a.exampleEn} ${b.exampleEn}`);
    }
  });

  it('the same seed gives the same exam, a different seed a different one', () => {
    expect(buildExam(input)).toEqual(exam);
    expect(buildExam({ ...input, seed: 8 })).not.toEqual(exam);
  });

  it('a word appears at most once in the word part', () => {
    const ids = exam.flatMap((i) => (i.kind === 'word_type' || i.kind === 'sent_order' || i.kind === 'sent_type' ? [i.itemId] : i.kind === 'match' ? i.itemIds : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildExam: when conditions are scarce', () => {
  it('no finished tense lesson: few sentences, the missing sentence items are replaced by word typing, no grammar', () => {
    const { input } = setup('es', undefined, []);
    const exam = buildExam(input);
    const k = kinds(exam);
    expect(k.gap_mc ?? 0).toBe(0);
    expect(k.sent_order ?? 0).toBeLessThanOrEqual(EXAM_BLUEPRINT.sentOrder);
    const sentences = (k.sent_order ?? 0) + (k.sent_type ?? 0);
    expect(k.word_type).toBe(EXAM_BLUEPRINT.wordType + EXAM_BLUEPRINT.sentOrder + EXAM_BLUEPRINT.sentType - sentences);
  });

  it('no learned word: no word and reading items (the exam would not open anyway)', () => {
    const { input } = setup('es', 0);
    const exam = buildExam(input);
    expect(exam.every((i) => i.skill === 'grammar')).toBe(true);
    expect(buildExam({ ...input, gapSources: [] })).toEqual([]);
  });

  it('the words of non-graduated (learning, new) cards do not go into an item', () => {
    const { items, input } = setup('es');
    const cards: Sm2Card[] = items.map((it, i) => (i < 40 ? { ...sm2NewCard(it.id), state: 'review' as const } : { ...sm2NewCard(it.id), state: i % 2 ? ('learning' as const) : ('new' as const) }));
    const exam = buildExam({ ...input, cards });
    const allowed = new Set(items.slice(0, 40).map((i) => i.id));
    const ids = exam.flatMap((i) => ('itemId' in i ? [i.itemId] : 'itemIds' in i ? i.itemIds : []));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(allowed.has(id)).toBe(true);
  });
});

describe('buildExam: es→en direction', () => {
  it('the prompt is the source (Spanish), the answer is the target-language (English) word, the sentences go through the English gate', () => {
    const { items, cards, input } = setup('en');
    const exam = buildExam(input);
    expect(exam.length).toBeGreaterThan(0);
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const i of exam) {
      if (i.kind !== 'word_type') continue;
      const it = byId.get(i.itemId) as PcicItem;
      expect(i.prompt).toBe(it.es);
      expect(i.answer).toBe(it.en);
    }
    const ctx = { learned: learnedEntries(cards, 'en', (id) => byId.get(id)) };
    for (const i of exam) {
      if (i.kind === 'sent_type') expect(unknownTokens(i.answer, 'en', ctx)).toEqual([]);
    }
  });
});
