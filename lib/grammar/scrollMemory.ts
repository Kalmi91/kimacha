// The lesson-body ScrollView (app/grammar/[topic].tsx) re-mounts
// when the screen changes phase (lesson -> drill -> lesson), because the drill and
// the done phase render another JSX branch that does not contain the ScrollView.
// This module-level memory keeps the scroll position by topicId so it can be
// restored on returning to the lesson phase instead of jumping to the top.
const positions = new Map<string, number>();

export function getScrollY(topicId: string): number {
  return positions.get(topicId) ?? 0;
}

export function setScrollY(topicId: string, y: number): void {
  positions.set(topicId, y);
}

export function clearScrollY(topicId: string): void {
  positions.delete(topicId);
}
