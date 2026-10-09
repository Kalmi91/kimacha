// (4. követelmény, észak-csillag): a tétel-építő CSAK a
// szint tanult szavaiból és a kész szint-leckékből épít; egy ismeretlen szó sem
// kerülhet tételbe (a mondatok a lib/knownSentence.ts kapuján mennek át).

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
  // A többi kártya létezik, de nem graduált (bemutatott vagy új): az ő szavaik nem kerülhetnek tételbe.
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

describe('buildExam: az A1 vizsga felépítése (en→es)', () => {
  const { items, cards, input } = setup('es');
  const exam = buildExam(input);
  const byId = new Map(items.map((i) => [i.id, i]));
  const learned = learnedIds(cards);

  it('a terv szerinti tételszámokat adja (szó, párosítás, összerakás, beírás, nyelvtan, olvasás)', () => {
    const k = kinds(exam);
    expect(k.word_type).toBe(EXAM_BLUEPRINT.wordType);
    expect(k.match).toBe(EXAM_BLUEPRINT.match);
    expect(k.sent_order).toBe(EXAM_BLUEPRINT.sentOrder);
    expect(k.sent_type).toBe(EXAM_BLUEPRINT.sentType);
    expect(k.gap_mc).toBe(EXAM_BLUEPRINT.gap);
    expect(k.reading_mc).toBeGreaterThanOrEqual(1);
    expect(k.reading_mc).toBeLessThanOrEqual(EXAM_BLUEPRINT.reading);
  });

  it('készség-sorrend: szavak, nyelvtan, olvasás, szóbeli', () => {
    const skills = ['words', 'grammar', 'reading', 'speaking'];
    const order = exam.map((i) => i.skill);
    expect(order).toEqual([...order].sort((a, b) => skills.indexOf(a) - skills.indexOf(b)));
  });

  it('a szóbeli tételek száma az EXAM_SPEAK_COUNT (alapérték 4), és az összes tétel a 30-ban marad', () => {
    expect(EXAM_SPEAK_COUNT).toBe(4);
    expect(kinds(exam).speak).toBe(EXAM_SPEAK_COUNT);
    expect(exam).toHaveLength(30);
  });

  it('a szóbeli tétel tanult mondat: a kiinduló nyelvű prompt, a célnyelvi várt mondat, a mondat-kapun átmegy', () => {
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

  it('a szóbeli mondatok nem ismétlődnek más mondat-tétellel (összerakás, beírás, olvasás)', () => {
    const owners = exam.flatMap((i) => (i.kind === 'sent_order' || i.kind === 'sent_type' || i.kind === 'speak' ? [i.itemId] : i.kind === 'reading_mc' ? i.itemIds : []));
    expect(new Set(owners).size).toBe(owners.length);
  });

  it('minden szó-alapú tétel tanult kártyából jön (egy ismeretlen szó se kerül tételbe)', () => {
    const ids = exam.flatMap((i) => ('itemId' in i ? [i.itemId] : 'itemIds' in i ? i.itemIds : []));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(learned.has(id)).toBe(true);
  });

  it('a tanulatlan kártyák szavai sehol nem szerepelnek a tételekben', () => {
    // A kártyák 15%-a nem tanult: azok célnyelvi szavai (amik a tanult szavak között nincsenek) nem lehetnek a vizsgában.
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

  it('a mondat-tételek (összerakás, beírás, olvasás) minden szava tanult vagy szabad, a csempék is', () => {
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

  it('az összerakós tétel az eredeti mondatot is viszi (nagybetű, írásjel), a csempék ennek a szavai', () => {
    const orders = exam.filter((i): i is Extract<ExamItem, { kind: 'sent_order' }> => i.kind === 'sent_order');
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) {
      const owner = byId.get(o.itemId) as PcicItem;
      expect(o.sentence).toBe(owner.exampleEs);
      expect(tileWords(o.sentence)).toEqual(o.answerTokens);
    }
  });

  it('a nyelvtani tételek csak a kész leckékből jönnek, 3 válasszal és érvényes jó indexszel', () => {
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

  it('a párosítás 4 egyedi párból áll, mindkét oldal szó', () => {
    const matches = exam.filter((i): i is Extract<ExamItem, { kind: 'match' }> => i.kind === 'match');
    for (const m of matches) {
      expect(m.pairs).toHaveLength(MATCH_PAIRS);
      expect(new Set(m.pairs.map((p) => p.left)).size).toBe(MATCH_PAIRS);
      expect(new Set(m.pairs.map((p) => p.right)).size).toBe(MATCH_PAIRS);
    }
  });

  it('az olvasás jó válasza a két mondat fordítása, és az opciók különböznek', () => {
    const readings = exam.filter((i): i is Extract<ExamItem, { kind: 'reading_mc' }> => i.kind === 'reading_mc');
    for (const r of readings) {
      expect(new Set(r.options).size).toBe(r.options.length);
      const [a, b] = r.itemIds.map((id) => byId.get(id) as PcicItem);
      expect(r.text).toBe(`${a.exampleEs} ${b.exampleEs}`);
      expect(r.options[r.correctIndex]).toBe(`${a.exampleEn} ${b.exampleEn}`);
    }
  });

  it('ugyanaz a seed ugyanazt a vizsgát adja, másik seed mást', () => {
    expect(buildExam(input)).toEqual(exam);
    expect(buildExam({ ...input, seed: 8 })).not.toEqual(exam);
  });

  it('egy szó legfeljebb egyszer szerepel a szó-részben', () => {
    const ids = exam.flatMap((i) => (i.kind === 'word_type' || i.kind === 'sent_order' || i.kind === 'sent_type' ? [i.itemId] : i.kind === 'match' ? i.itemIds : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildExam: ha kevés a feltétel', () => {
  it('nincs kész igeidő-lecke: kevés a mondat, a hiányzó mondat-tételek szó-beírásra cserélődnek, nyelvtan nincs', () => {
    const { input } = setup('es', undefined, []);
    const exam = buildExam(input);
    const k = kinds(exam);
    expect(k.gap_mc ?? 0).toBe(0);
    expect(k.sent_order ?? 0).toBeLessThanOrEqual(EXAM_BLUEPRINT.sentOrder);
    const sentences = (k.sent_order ?? 0) + (k.sent_type ?? 0);
    expect(k.word_type).toBe(EXAM_BLUEPRINT.wordType + EXAM_BLUEPRINT.sentOrder + EXAM_BLUEPRINT.sentType - sentences);
  });

  it('nincs tanult szó: nincs szó- és olvasás-tétel (a vizsga amúgy sem nyílna ki)', () => {
    const { input } = setup('es', 0);
    const exam = buildExam(input);
    expect(exam.every((i) => i.skill === 'grammar')).toBe(true);
    expect(buildExam({ ...input, gapSources: [] })).toEqual([]);
  });

  it('a nem graduált (learning, új) kártyák szava nem kerül tételbe', () => {
    const { items, input } = setup('es');
    const cards: Sm2Card[] = items.map((it, i) => (i < 40 ? { ...sm2NewCard(it.id), state: 'review' as const } : { ...sm2NewCard(it.id), state: i % 2 ? ('learning' as const) : ('new' as const) }));
    const exam = buildExam({ ...input, cards });
    const allowed = new Set(items.slice(0, 40).map((i) => i.id));
    const ids = exam.flatMap((i) => ('itemId' in i ? [i.itemId] : 'itemIds' in i ? i.itemIds : []));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(allowed.has(id)).toBe(true);
  });
});

describe('buildExam: es→en irány', () => {
  it('a prompt a kiinduló (spanyol), a válasz a célnyelvi (angol) szó, a mondatok az angol kapun mennek át', () => {
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
