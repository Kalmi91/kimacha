// The reading stories of the Practice tab (data/practice/stories.json, lib/practice/stories.ts).
import { findPcicItem, levelOfItem, pcicItemsForLevel } from '@/data/pcic';
import storiesData from '@/data/practice/stories.json';
import { detectStructures } from '@/lib/grammar/tenseGate';
import { isSentenceKnownIn, knownTokens, sentenceTokens, type ResolvedTense } from '@/lib/knownSentence';
import { STORIES, storyWords } from '@/lib/practice/stories';
import { learnedEntries } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

// The present tense is the base of every A1 sentence (lib/grammar/tenseGate.ts); no other tense may be needed.
const TENSES: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);
const A1 = pcicItemsForLevel('A1');

const learned = (ids: string[]): Sm2Card[] =>
  ids.map((id) => ({ ...sm2NewCard(id), state: 'review', interval: 4, reps: 2, due: '2026-10-23', lastReview: '2026-10-01', introducedAt: '2026-10-01' }));
const knownOf = (ids: string[]) => knownTokens('es', { learned: learnedEntries(learned(ids), 'es', findPcicItem), tenses: TENSES });
const idsOf = (stories: typeof STORIES) => stories.flatMap((s) => s.sentences.map((x) => x.word));
const norm = (text: string) => text.trim().toLowerCase();

describe('data/practice/stories.json', () => {
  it('20 A1 stories with unique ids, five sentences each', () => {
    expect(STORIES).toBe(storiesData);
    expect(STORIES).toHaveLength(20);
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(20);
    for (const story of STORIES) {
      expect(story.level).toBe('A1');
      expect(story.sentences).toHaveLength(5);
    }
  });

  it('every sentence practises an existing A1 card, written as a whole word; the five cards of a story differ', () => {
    for (const story of STORIES) {
      for (const s of story.sentences) {
        expect([story.id, s.word, levelOfItem(s.word)]).toEqual([story.id, s.word, 'A1']);
        expect(findPcicItem(s.word)).toBeDefined();
        const words = s.es.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? [];
        expect([story.id, s.form, words.map(norm).includes(norm(s.form))]).toEqual([story.id, s.form, true]);
        expect(s.en.trim()).not.toBe('');
      }
      expect(new Set(story.sentences.map((s) => s.word)).size).toBe(5);
    }
  });

  it('two false statements per story, none equal to a sentence of it', () => {
    for (const story of STORIES) {
      expect(story.false_en).toHaveLength(2);
      const english = story.sentences.map((s) => norm(s.en));
      for (const f of story.false_en) {
        expect([story.id, f, english.includes(norm(f))]).toEqual([story.id, f, false]);
      }
      expect(norm(story.false_en[0])).not.toBe(norm(story.false_en[1]));
    }
  });

  it('no dash in a text (house style)', () => {
    const texts = STORIES.flatMap((s) => [...s.sentences.flatMap((x) => [x.es, x.en]), ...s.false_en]);
    const dash = new RegExp(`[${String.fromCharCode(8211, 8212)}]`);
    expect(texts.filter((t) => dash.test(t))).toEqual([]);
  });

  it('a learner who knows every A1 card (and the present tense) knows every sentence: no unknown word, no other structure', () => {
    const known = knownOf(A1.map((i) => i.id));
    const problems: string[] = [];
    for (const story of STORIES) {
      for (const s of story.sentences) {
        const unknown = sentenceTokens(s.es, 'es').filter((t) => !known.has(t));
        const other = [...detectStructures(s.es)].filter((x) => x !== 'presente');
        if (unknown.length > 0 || other.length > 0 || !isSentenceKnownIn(s.es, 'es', known)) {
          problems.push(`${story.id}: ${s.es} | unknown: ${unknown.join(',')} | structures: ${other.join(',')}`);
        }
      }
      if (!storyWords(story, findPcicItem)) problems.push(`${story.id}: storyWords`);
    }
    expect(problems).toEqual([]);
  });

  it('at least ten stories need only the first 200 cards (a learner early in A1 gets one)', () => {
    const early = A1.filter((i) => i.order <= 200).map((i) => i.id);
    const known = knownOf(early);
    const easy = STORIES.filter((story) => story.sentences.every((s) => early.includes(s.word) && isSentenceKnownIn(s.es, 'es', known)));
    expect(easy.length).toBeGreaterThanOrEqual(10);
    // the stories are not only these: the rest lean on later A1 cards
    expect(idsOf(easy).length).toBeLessThan(idsOf(STORIES).length);
  });
});
