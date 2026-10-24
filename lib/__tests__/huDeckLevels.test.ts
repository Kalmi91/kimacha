// The Hungarian target deck at A2-C1, with the real data (es→hu and en→hu): the Sentences tab queue and the Practice tab
// round builders (reading, match, scramble, dictation, opposites) run on every new level without throwing, and find
// something to offer on it. The counts are not pinned here (data/__tests__/pcicPairs.test.ts does that).

import { PCIC_LEVELS, findPcicItem, levelOfItem, pcicItemsForLevel, setPcicTarget, type PcicLevel } from '@/data/pcic';
import { dictationWord } from '@/lib/practice/dictation';
import { buildBoards, isMatchUsable, matchCard } from '@/lib/practice/match';
import { buildQuestion, isOppositesUsable } from '@/lib/practice/opposites';
import { buildReadingSet } from '@/lib/practice/reading';
import { isScrambleUsable, scrambleWord } from '@/lib/practice/scramble';
import { pickSentences } from '@/lib/sentencePick';
import { SENTENCE_ROUND_SIZE, buildSentenceQueue } from '@/lib/sentenceTab';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

const TODAY = '2026-10-23';
const NEW_LEVELS: PcicLevel[] = ['A2', 'B1', 'B2', 'C1'];

const learned = (itemId: string): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 5,
  reps: 3,
  due: '2026-10-01',
  lastReview: '2026-09-26',
  introducedAt: '2026-09-20',
});

describe.each([['es'], ['en']])('%s→hu: A2-C1 in the Sentences and Practice tabs', (source) => {
  beforeAll(() => setPcicTarget('hu', source));
  afterAll(() => setPcicTarget('es'));

  const allItems = () => PCIC_LEVELS.flatMap((level) => pcicItemsForLevel(level));

  it('Sentences tab: a learner who knows the whole deck gets a queue with sentences of every new level, and a full round', () => {
    const cards = allItems().map((i) => learned(i.id));
    const queue = buildSentenceQueue({ target: 'hu', cards, items: allItems(), findItem: findPcicItem, today: TODAY });
    expect(queue.length).toBeGreaterThan(0);
    const levels = new Set(queue.map((e) => levelOfItem(e.itemId)));
    for (const level of NEW_LEVELS) expect(levels.has(level)).toBe(true);
    for (const entry of queue) {
      expect(entry.source.trim()).toBeTruthy();
      expect(entry.target.trim()).toBeTruthy();
    }
    expect(pickSentences(queue, 'hu', SENTENCE_ROUND_SIZE)).toHaveLength(SENTENCE_ROUND_SIZE);
  });

  it.each(NEW_LEVELS.map((level) => [level]))('Sentences tab: %s alone (nothing else learned) does not throw', (level) => {
    const items = pcicItemsForLevel(level);
    const cards = items.map((i) => learned(i.id));
    const queue = buildSentenceQueue({ target: 'hu', cards, items, findItem: findPcicItem, today: TODAY });
    expect(Array.isArray(queue)).toBe(true);
    pickSentences(queue, 'hu', SENTENCE_ROUND_SIZE);
  });

  it.each(NEW_LEVELS.map((level) => [level]))('Practice tab: %s has words for match, scramble and dictation', (level) => {
    const items = pcicItemsForLevel(level);

    const matchable = items.filter((i) => isMatchUsable(i, 'hu'));
    expect(matchable.length).toBeGreaterThan(10);
    for (const i of matchable.slice(0, 50)) {
      const card = matchCard(i, 'hu');
      expect(card.es.trim() || card.en.trim()).toBeTruthy();
    }
    const boards = buildBoards(matchable, 'hu');
    expect(boards.length).toBeGreaterThan(0);
    for (const id of boards.flat()) expect(findPcicItem(id)).toBeDefined();

    const scrambleable = items.filter((i) => isScrambleUsable(i, 'hu'));
    expect(scrambleable.length).toBeGreaterThan(10);
    for (const i of scrambleable) expect(scrambleWord(i, 'hu').letters.length).toBeGreaterThan(1);

    for (const i of items) {
      const word = dictationWord(i, 'hu');
      expect(word.answer.trim()).toBeTruthy();
      expect(word.say.trim()).toBeTruthy();
    }
  });

  it.each(NEW_LEVELS.map((level) => [level]))('Practice tab: %s opposites and reading do not throw', (level) => {
    const items = pcicItemsForLevel(level);
    const known = new Set(items.map((i) => i.id));
    for (const i of items) {
      if (isOppositesUsable(i, 'hu', known)) buildQuestion(i, known);
    }
    const cards = allItems().map((i) => learned(i.id));
    const set = buildReadingSet({ target: 'hu', cards, findItem: findPcicItem, today: TODAY, random: () => 0.5 });
    // null = the empty state (too few usable sentences); a set must be consistent
    if (set) expect(set.questions).toHaveLength(set.resolved.length);
  });
});
