// The reading stories of the Practice tab (data/practice/stories.json, stories-en.json, stories-hu.json, stories-de.json: one file per
// target language, lib/practice/stories.ts). Each story carries its sentences in the target language and in the three source languages.
import { findPcicItem, levelOfItem, pcicItemsForLevel, setPcicTarget, type PcicLevel, type PcicTarget } from '@/data/pcic';
import storiesData from '@/data/practice/stories.json';
import storiesDeData from '@/data/practice/stories-de.json';
import storiesEnData from '@/data/practice/stories-en.json';
import storiesHuData from '@/data/practice/stories-hu.json';
import { detectStructures } from '@/lib/grammar/tenseGate';
import { isSentenceKnownIn, knownTokens, sentenceTokens, type ResolvedTense } from '@/lib/knownSentence';
import type { Lang } from '@/lib/languagePair';
import { falseIn, pickStory, STORIES, storiesFor, storyWords } from '@/lib/practice/stories';
import { learnedEntries } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

const LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const rank = (level: PcicLevel) => LEVELS.indexOf(level);
// The level at which a Spanish structure is taught (lib/grammar/tenseGate.ts STRUCTURE_LEVEL, which is not exported). The present
// tense is the base of every A1 sentence; a structure that is not in this table (perfecto, pluscuamperfecto, imperativo...) is not
// allowed in a story of any level.
const STRUCTURE_LEVEL: Partial<Record<string, PcicLevel>> = {
  presente: 'A1',
  indefinido: 'A2',
  imperfecto: 'A2',
  futuro: 'A2',
  condicional: 'B1',
  subjuntivo_presente: 'B1',
  subjuntivo_imperfecto: 'B2',
};
// the tenses a learner of a level has unlocked: those taught up to that level
const tensesOf = (level: PcicLevel): ReadonlySet<ResolvedTense> =>
  new Set(Object.entries(STRUCTURE_LEVEL).filter(([, l]) => l !== undefined && rank(l) <= rank(level)).map(([t]) => t as ResolvedTense));
// the cards a learner of a level knows: every card of that level and of the levels below it
const cardIdsUpTo = (level: PcicLevel) => LEVELS.filter((l) => rank(l) <= rank(level)).flatMap((l) => pcicItemsForLevel(l).map((i) => i.id));

const FILES: Record<PcicTarget, unknown> = { es: storiesData, en: storiesEnData, hu: storiesHuData, de: storiesDeData };
// the languages a learner of each target comes from (the translations and false statements a story needs): the other three
const SOURCES: Record<PcicTarget, Lang[]> = { es: ['en', 'hu', 'de'], en: ['es', 'hu', 'de'], hu: ['es', 'en', 'de'], de: ['en', 'es', 'hu'] };
// How many stories of each level a file holds: 20 at A1, 5 at each level above. German has only the 20 A1 stories so far (the A2 to C1
// stories are written later): a level without a story is an honest empty state, never a story with words above its level.
const COUNT_ABOVE_A1: [number, number] = [5, 5];
const COUNT: Record<PcicTarget, Record<PcicLevel, [number, number]>> = {
  es: { A1: [20, 20], A2: COUNT_ABOVE_A1, B1: COUNT_ABOVE_A1, B2: COUNT_ABOVE_A1, C1: COUNT_ABOVE_A1 },
  en: { A1: [20, 20], A2: COUNT_ABOVE_A1, B1: COUNT_ABOVE_A1, B2: COUNT_ABOVE_A1, C1: COUNT_ABOVE_A1 },
  hu: { A1: [20, 20], A2: COUNT_ABOVE_A1, B1: COUNT_ABOVE_A1, B2: COUNT_ABOVE_A1, C1: COUNT_ABOVE_A1 },
  de: { A1: [20, 20], A2: [0, 0], B1: [0, 0], B2: [0, 0], C1: [0, 0] },
};

const learned = (ids: string[]): Sm2Card[] =>
  ids.map((id) => ({ ...sm2NewCard(id), state: 'review', interval: 4, reps: 2, due: '2026-10-23', lastReview: '2026-10-01', introducedAt: '2026-10-01' }));
// the active deck is the one of the pair set with setPcicTarget
const knownOf = (target: PcicTarget, ids: string[], level: PcicLevel = 'A1') =>
  knownTokens(target, { learned: learnedEntries(learned(ids), target, findPcicItem), tenses: tensesOf(level) });
const idsOf = (stories: typeof STORIES) => stories.flatMap((s) => s.sentences.map((x) => x.word));
const norm = (text: string) => text.trim().toLowerCase();
const WORDS = /\p{L}+/gu;

describe.each<PcicTarget>(['es', 'en', 'hu', 'de'])('reading stories, target %s', (target) => {
  const stories = storiesFor(target);
  const sources = SOURCES[target];

  beforeAll(() => setPcicTarget(target));
  afterAll(() => setPcicTarget('es'));

  it('stories with unique ids, five sentences each, the right number per level', () => {
    expect(stories).toBe(FILES[target]);
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
    for (const level of LEVELS) {
      const count = stories.filter((s) => s.level === level).length;
      expect([level, count >= COUNT[target][level][0] && count <= COUNT[target][level][1]]).toEqual([level, true]);
    }
    for (const story of stories) {
      expect([story.id, LEVELS.includes(story.level)]).toEqual([story.id, true]);
      expect(story.id.startsWith(`${story.level.toLowerCase()}-`)).toBe(true);
      expect(story.sentences).toHaveLength(5);
    }
  });

  it('every sentence practises an existing card of the level of its story, written as a whole word; the five cards of a story differ', () => {
    for (const story of stories) {
      for (const s of story.sentences) {
        expect([story.id, s.word, levelOfItem(s.word)]).toEqual([story.id, s.word, story.level]);
        expect(findPcicItem(s.word)).toBeDefined();
        const words = s[target]?.match(WORDS) ?? [];
        expect([story.id, s.form, words.map(norm).includes(norm(s.form))]).toEqual([story.id, s.form, true]);
      }
      expect(new Set(story.sentences.map((s) => s.word)).size).toBe(5);
    }
  });

  it('a translation of every sentence in every source language, and 2-3 false statements per source language, none equal to a sentence of the story', () => {
    for (const story of stories) {
      for (const s of story.sentences) {
        expect([story.id, s.word, (s[target] ?? '').trim()]).not.toEqual([story.id, s.word, '']);
        for (const source of sources) expect([story.id, s.word, source, (s[source] ?? '').trim()]).not.toEqual([story.id, s.word, source, '']);
      }
      for (const source of sources) {
        const wrong = falseIn(story, source);
        expect([story.id, source, wrong.length >= 2 && wrong.length <= 3]).toEqual([story.id, source, true]);
        const sentences = story.sentences.map((s) => norm(s[source] ?? ''));
        for (const f of wrong) {
          expect([story.id, f]).not.toEqual([story.id, '']);
          expect([story.id, f, sentences.includes(norm(f))]).toEqual([story.id, f, false]);
        }
        expect(new Set(wrong.map(norm)).size).toBe(wrong.length);
      }
      // the same false statements in every language: one count
      expect(new Set(sources.map((source) => falseIn(story, source).length)).size).toBe(1);
    }
  });

  it('no dash in a text (house style)', () => {
    const texts = stories.flatMap((s) => [
      ...s.sentences.flatMap((x) => [x.es ?? '', x.en ?? '', x.hu ?? '', x.de ?? '']),
      ...falseIn(s, 'en'),
      ...falseIn(s, 'es'),
      ...falseIn(s, 'hu'),
      ...falseIn(s, 'de'),
    ]);
    const dash = new RegExp(`[${String.fromCharCode(8211, 8212)}]`);
    expect(texts.filter((t) => dash.test(t))).toEqual([]);
  });

  it('no inverted ? or ! in Spanish (house style)', () => {
    const spanish = stories.flatMap((s) => [...s.sentences.map((x) => x.es ?? ''), ...falseIn(s, 'es')]);
    expect(spanish.filter((t) => /[¿¡]/.test(t))).toEqual([]);
  });

  it.each(sources)('source %s: a learner who knows every card up to the level of a story (and the tenses of that level) knows every sentence: no unknown word, no other structure', (source) => {
    // the deck of the pair: with a Hungarian prompt a card without a Hungarian gloss is not in the deck
    setPcicTarget(target, source);
    try {
      const knownByLevel = new Map<PcicLevel, ReadonlySet<string>>(LEVELS.map((level) => [level, knownOf(target, cardIdsUpTo(level), level)]));
      const problems: string[] = [];
      for (const story of stories) {
        // A level with no card in the deck of this pair (the German meanings cover A1 only so far, de→es/en/hu) has no story to offer:
        // storyWords must say so (null, never a story with a missing prompt text), the gate below is for the levels the deck has.
        if (pcicItemsForLevel(story.level).length === 0) {
          if (storyWords(story, findPcicItem, target)) problems.push(`${story.id}: offered without a deck of ${story.level}`);
          continue;
        }
        const known = knownByLevel.get(story.level) ?? new Set<string>();
        for (const s of story.sentences) {
          const text = s[target] ?? '';
          const unknown = sentenceTokens(text, target).filter((t) => !known.has(t));
          // the structure detector reads Spanish only; a structure taught above the level of the story (or not taught) is another structure
          const other =
            target === 'es'
              ? [...detectStructures(text)].filter((x) => {
                  const taught = STRUCTURE_LEVEL[x];
                  return taught === undefined || rank(taught) > rank(story.level);
                })
              : [];
          if (unknown.length > 0 || other.length > 0 || !isSentenceKnownIn(text, target, known)) {
            problems.push(`${story.id}: ${text} | unknown: ${unknown.join(',')} | structures: ${other.join(',')}`);
          }
        }
        if (!storyWords(story, findPcicItem, target)) problems.push(`${story.id}: storyWords`);
      }
      expect(problems).toEqual([]);
    } finally {
      setPcicTarget(target);
    }
  });
});

describe('reading stories, Spanish', () => {
  beforeAll(() => setPcicTarget('es'));

  it('at least ten stories need only the first 200 cards (a learner early in A1 gets one)', () => {
    const early = pcicItemsForLevel('A1').filter((i) => i.order <= 200).map((i) => i.id);
    const known = knownOf('es', early);
    const easy = STORIES.filter((story) => story.sentences.every((s) => early.includes(s.word) && isSentenceKnownIn(s.es ?? '', 'es', known)));
    expect(easy.length).toBeGreaterThanOrEqual(10);
    // the stories are not only these: the rest lean on later A1 cards
    expect(idsOf(easy).length).toBeLessThan(idsOf(STORIES).length);
  });
});

// The German stories (target de) are checked against the real known-word gate, which models no German inflection: only the tokens of
// the headwords of the learned cards count (lib/knownSentence.ts). So each story is tried with exactly the cards it needs: the card of
// each sentence's word and, for every other word, the first card of the deck that carries it.
describe('reading stories, German: each story is offered to a learner with the cards it needs', () => {
  beforeAll(() => setPcicTarget('de'));
  afterAll(() => setPcicTarget('es'));

  const deps = (cards: Sm2Card[]) => ({ target: 'de' as PcicTarget, cards, findItem: findPcicItem, today: '2026-10-23' });
  const knownFor = (cards: Sm2Card[]) => knownTokens('de', { learned: learnedEntries(cards, 'de', findPcicItem) });

  it('with exactly those cards the story is picked, without the card of one of its words it is not', () => {
    const firstCard = new Map<string, string>();
    for (const item of pcicItemsForLevel('A1')) for (const token of sentenceTokens(item.de ?? '', 'de')) if (!firstCard.has(token)) firstCard.set(token, item.id);
    const free = knownTokens('de', { learned: [] });
    const problems: string[] = [];
    for (const story of storiesFor('de')) {
      const needed = new Set(story.sentences.map((x) => x.word));
      for (const x of story.sentences) {
        for (const token of sentenceTokens(x.de ?? '', 'de')) if (!free.has(token)) needed.add(firstCard.get(token) ?? `missing:${token}`);
      }
      const cards = learned([...needed]);
      const picked = pickStory(deps(cards), knownFor(cards), [story]);
      if (picked?.story.id !== story.id) problems.push(`${story.id}: not offered with ${needed.size} cards`);
      for (const x of story.sentences) {
        const without = cards.filter((c) => c.itemId !== x.word);
        if (pickStory(deps(without), knownFor(without), [story])) problems.push(`${story.id}: offered without the card of ${x.form}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('a learner with no card is offered no story', () => {
    expect(pickStory(deps([]), knownFor([]))).toBeNull();
  });
});

// The German layer: every sentence of every story has a German translation and every story German false statements, so a German
// speaker can read the stories of all three target languages (de to es, en, hu).
interface GermanLayer {
  id: string;
  sentences: ({ de?: string } & Record<string, unknown>)[];
  false_de?: string[];
  [key: string]: unknown;
}

describe.each<PcicTarget>(['es', 'en', 'hu'])('reading stories, German translations, target %s', (target) => {
  const stories = FILES[target] as GermanLayer[];
  const ending = (text: string) => text.trim().slice(-1);

  it('every sentence has a German translation that ends like its source sentence', () => {
    for (const story of stories) {
      for (const s of story.sentences) {
        const source = String(s[target] ?? '');
        expect([story.id, source, (s.de ?? '').trim() !== '']).toEqual([story.id, source, true]);
        expect([story.id, source, s.de === source]).toEqual([story.id, source, false]);
        expect([story.id, source, ending(s.de ?? '') === ending(source)]).toEqual([story.id, source, true]);
      }
    }
  });

  it('every story has as many German false statements as it has in the other languages, none equal to a sentence of the story', () => {
    for (const story of stories) {
      const wrong = story.false_de ?? [];
      const others = Object.keys(story).filter((k) => k.startsWith('false_') && k !== 'false_de');
      expect([story.id, wrong.length >= 2 && wrong.length <= 3]).toEqual([story.id, true]);
      for (const key of others) expect([story.id, key, (story[key] as string[]).length]).toEqual([story.id, key, wrong.length]);
      const sentences = story.sentences.map((s) => norm(s.de ?? ''));
      for (const f of wrong) {
        expect([story.id, f]).not.toEqual([story.id, '']);
        expect([story.id, f, sentences.includes(norm(f))]).toEqual([story.id, f, false]);
      }
      expect(new Set(wrong.map(norm)).size).toBe(wrong.length);
    }
  });

  it('no dash in a German text (house style)', () => {
    const texts = stories.flatMap((s) => [...s.sentences.map((x) => x.de ?? ''), ...(s.false_de ?? [])]);
    const dash = new RegExp(`[${String.fromCharCode(8211, 8212)}]`);
    expect(texts.filter((t) => dash.test(t))).toEqual([]);
  });
});
