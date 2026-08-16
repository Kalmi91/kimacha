// FB135/FB136, Kálmán 2026-08-16: "va néhány topic amit nem tudok ki választani,
// mármint kivalasztom, és nincs benne szó de azt irja 8/9 mint a színek" and
// "done for today nél vagyok és még több szót akarok, azt akarom, hogy adjon új
// szavakat, de ilyen opció nincs itt".
//
// Both come from the same state. The queue is scoped to the active topic (FB117),
// and it only ever carries DUE cards, so a topic whose remaining words are all
// scheduled for a later day yields an empty queue: the session ends on the Done
// screen the moment it starts, while the tree still shows the topic as unfinished
// (8 of 9 mastered is correct, the ninth is simply not due yet). Until now the
// Done screen offered nothing in that state, because the "+N new words" buttons
// only appear when the DAILY BUDGET is spent, which it is not here.
//
// The way out is another topic that still has untouched words. This module picks
// it, so the rule is one testable place instead of being buried in the screen.

export interface TopicNewWords {
  id: string;
  order: number;
  /** Words in the topic the learner has never answered (reps === 0). */
  newWords: number;
}

export function countNewWords(wordIds: number[], repsMap: Map<number, number>): number {
  let n = 0;
  for (const id of wordIds) if ((repsMap.get(id) ?? 0) === 0) n++;
  return n;
}

// The next topic by curriculum order that can still hand out brand-new words.
// The active topic is skipped: it is precisely the one that ran dry.
export function nextTopicWithNewWords(candidates: TopicNewWords[], activeId: string | null): string | null {
  const usable = candidates
    .filter((c) => c.id !== activeId && c.newWords > 0)
    .sort((a, b) => a.order - b.order);
  return usable.length ? usable[0].id : null;
}
