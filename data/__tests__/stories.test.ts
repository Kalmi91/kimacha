// The reading stories of the Practice tab (data/practice/stories.json, stories-en.json, stories-hu.json: one file per target
// language, lib/practice/stories.ts). Each story carries its sentences in the target language and in both source languages.
import { findPcicItem, levelOfItem, pcicItemsForLevel, setPcicTarget, type PcicTarget } from '@/data/pcic';
import storiesData from '@/data/practice/stories.json';
import storiesEnData from '@/data/practice/stories-en.json';
import storiesHuData from '@/data/practice/stories-hu.json';
import { detectStructures } from '@/lib/grammar/tenseGate';
import { isSentenceKnownIn, knownTokens, sentenceTokens, type ResolvedTense } from '@/lib/knownSentence';
import type { Lang } from '@/lib/languagePair';
import { falseIn, STORIES, storiesFor, storyWords } from '@/lib/practice/stories';
import { learnedEntries } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

// The present tense is the base of every A1 sentence (lib/grammar/tenseGate.ts); no other tense may be needed.
const TENSES: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);

const FILES: Record<PcicTarget, unknown> = { es: storiesData, en: storiesEnData, hu: storiesHuData };
// the languages a learner of each target comes from (the translations and false statements a story needs)
const SOURCES: Record<PcicTarget, Lang[]> = { es: ['en', 'hu'], en: ['es', 'hu'], hu: ['es', 'en'] };
// How many stories a file holds: Spanish is complete; English and Hungarian start with one sample story each and grow to 20
// (TASK-hu-tortenetek parts 2 and 3).
const COUNT: Record<PcicTarget, [number, number]> = { es: [20, 20], en: [20, 20], hu: [20, 20] };

const learned = (ids: string[]): Sm2Card[] =>
  ids.map((id) => ({ ...sm2NewCard(id), state: 'review', interval: 4, reps: 2, due: '2026-10-23', lastReview: '2026-10-01', introducedAt: '2026-10-01' }));
// the active deck is the one of the pair set with setPcicTarget
const knownOf = (target: PcicTarget, ids: string[]) => knownTokens(target, { learned: learnedEntries(learned(ids), target, findPcicItem), tenses: TENSES });
const idsOf = (stories: typeof STORIES) => stories.flatMap((s) => s.sentences.map((x) => x.word));
const norm = (text: string) => text.trim().toLowerCase();
const WORDS = /\p{L}+/gu;

describe.each<PcicTarget>(['es', 'en', 'hu'])('reading stories, target %s', (target) => {
  const stories = storiesFor(target);
  const sources = SOURCES[target];

  beforeAll(() => setPcicTarget(target));
  afterAll(() => setPcicTarget('es'));

  it('A1 stories with unique ids, five sentences each', () => {
    expect(stories).toBe(FILES[target]);
    expect(stories.length).toBeGreaterThanOrEqual(COUNT[target][0]);
    expect(stories.length).toBeLessThanOrEqual(COUNT[target][1]);
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
    for (const story of stories) {
      expect(story.level).toBe('A1');
      expect(story.sentences).toHaveLength(5);
    }
  });

  it('every sentence practises an existing A1 card, written as a whole word; the five cards of a story differ', () => {
    for (const story of stories) {
      for (const s of story.sentences) {
        expect([story.id, s.word, levelOfItem(s.word)]).toEqual([story.id, s.word, 'A1']);
        expect(findPcicItem(s.word)).toBeDefined();
        const words = s[target]?.match(WORDS) ?? [];
        expect([story.id, s.form, words.map(norm).includes(norm(s.form))]).toEqual([story.id, s.form, true]);
      }
      expect(new Set(story.sentences.map((s) => s.word)).size).toBe(5);
    }
  });

  it('a translation of every sentence in both source languages, and 2-3 false statements per source language, none equal to a sentence of the story', () => {
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
      ...s.sentences.flatMap((x) => [x.es ?? '', x.en ?? '', x.hu ?? '']),
      ...falseIn(s, 'en'),
      ...falseIn(s, 'es'),
      ...falseIn(s, 'hu'),
    ]);
    const dash = new RegExp(`[${String.fromCharCode(8211, 8212)}]`);
    expect(texts.filter((t) => dash.test(t))).toEqual([]);
  });

  it('no inverted ? or ! in Spanish (house style)', () => {
    const spanish = stories.flatMap((s) => [...s.sentences.map((x) => x.es ?? ''), ...falseIn(s, 'es')]);
    expect(spanish.filter((t) => /[¿¡]/.test(t))).toEqual([]);
  });

  it.each(sources)('source %s: a learner who knows every A1 card (and the present tense) knows every sentence: no unknown word, no other structure', (source) => {
    // the deck of the pair: with a Hungarian prompt a card without a Hungarian gloss is not in the deck
    setPcicTarget(target, source);
    try {
      const known = knownOf(target, pcicItemsForLevel('A1').map((i) => i.id));
      const problems: string[] = [];
      for (const story of stories) {
        for (const s of story.sentences) {
          const text = s[target] ?? '';
          const unknown = sentenceTokens(text, target).filter((t) => !known.has(t));
          // the structure detector reads Spanish only
          const other = target === 'es' ? [...detectStructures(text)].filter((x) => x !== 'presente') : [];
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
