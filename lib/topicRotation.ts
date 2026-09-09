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

// FB139, Kálmán 2026-08-17 (word:"identity card"): "ha 15 új szót kell beadni ...
// és a témakörből, nincsen 15 szó akkor szedjen össze a körülötte lévő
// topicokból ... csak akkor amikor a másik témakör szava van akkor jelezze,
// hogy melyik szó az."
//
// New words only ever come from the active topic (FB117), so asking for +15 while
// the topic holds three untouched words hands out three. The shortfall is topped
// up from the NEAREST topics by curriculum order, and every borrowed word carries
// its own topic back, so the card can name where it came from.

export interface TopicNewWordIds {
  id: string;
  order: number;
  /** Untouched words of the topic (reps === 0), in curriculum order. */
  newWordIds: number[];
}

export interface BorrowedWord {
  wordId: number;
  topicId: string;
}

export function borrowNewWords(
  candidates: TopicNewWordIds[],
  activeOrder: number,
  needed: number,
): BorrowedWord[] {
  if (needed <= 0) return [];
  const picked: BorrowedWord[] = [];
  // FB195, Kálmán 2026-09-09 (tree-tab): „csak zavar, hogy az elozp A1 es szintből
  // mindig maradt 1-2 szó egy témakörből". A kölcsönzés eddig a LEGKÖZELEBBI
  // témától kért, ami a szomszédokat morzsolta, a távolabb rekedt egy-két szavas
  // maradékokhoz pedig sosem ért el. Mostantól a majdnem kész témák mennek elöl:
  // kevés maradék előre, és csak azonos maradék esetén dönt a távolság. Így a
  // szintből tényleg elfogynak a szavak, nem marad témánként egy-kettő.
  const byLeftover = [...candidates].sort(
    (a, b) =>
      a.newWordIds.length - b.newWordIds.length ||
      Math.abs(a.order - activeOrder) - Math.abs(b.order - activeOrder) ||
      a.order - b.order,
  );
  for (const topic of byLeftover) {
    for (const wordId of topic.newWordIds) {
      if (picked.length >= needed) return picked;
      picked.push({ wordId, topicId: topic.id });
    }
  }
  return picked;
}
