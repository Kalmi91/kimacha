// FB327: a lecke-body ScrollView (app/grammar/[topic].tsx) újra-mountol,
// amikor a képernyő fázist vált (lesson -> drill -> lesson), mert a drill és
// a done fázis egy másik JSX-ágat rajzol ki, a ScrollView-t nem tartalmazza.
// Ez a modul-szintű memória topicId szerint tartja a görgetési pozíciót, hogy
// a lecke-fázisba visszatérve visszaállítható legyen, ne ugorjon a tetejére.
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
