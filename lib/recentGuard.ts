// FB213, Kálmán 2026-09-09 (word:contrario): „ohh mintha akkor menne bele a loopba
// amikor kevés szót dob fel ha a good ra nyomok. mintha az befolyásolná ezt. lehet
// hogy mukodik a difficulty gomb csak ha good ra nyomok akkor ismétli a szót?"
//
// Igaza volt. A FB198-as nehézség-hézag (lib/requeueGap.ts) eddig CSAK a kézi
// vissza-sorolásra hatott (`requeueCurrent`), a rendes Good/Again értékelésre nem.
// A rendes úton a kártya nem kerül vissza a sorba: a sor a végén ÚJRAÉPÜL a
// DB-ből, és az FSRS tanulási lépései percekben mérnek, tehát az imént „Good"-dal
// megválaszolt szó azonnal esedékes marad, és az új sor elejére kerül. Kevés
// kártyánál ez a hurok: ugyanaz a szó jön vissza két lap múlva.
//
// Ez a modul a mostanában LÁTOTT kártyákat tartja számon (session-szinten, nem
// DB-ben), és az újraépített sorban hátra teszi őket. Nem dob el semmit: ha csak
// látott kártya maradt, azok jönnek, csak a legrégebben látott elöl.

export interface RecentSeen {
  wordId: number;
  type: string;
}

/** A sorban egy kártyát a szó ÉS a kártyatípus együtt azonosít. */
export function recentKey(item: RecentSeen): string {
  return `${item.wordId}:${item.type}`;
}

/**
 * Az imént megválaszolt kártya felvétele a „mostanában látott" listára.
 *
 * @param recent az eddigi lista, elöl a legrégebben látott
 * @param key az új kulcs
 * @param gap hány lapig számít egy kártya frissnek (a nehézség-beállítás)
 * @returns új lista, legfeljebb `gap` elemű
 */
export function rememberRecent(recent: string[], key: string, gap: number): string[] {
  const keep = Math.max(0, gap);
  if (keep === 0) return [];
  const next = recent.filter((k) => k !== key);
  next.push(key);
  return next.slice(-keep);
}

/**
 * A mostanában látott kártyák hátra sorolása egy frissen épített sorban.
 *
 * A nem látott kártyák megtartják az eredeti sorrendjüket, utánuk jönnek a
 * látottak, a legrégebben látottal kezdve, tehát a legfrissebb szó kerül a
 * legmesszebbre.
 */
export function deferRecent<T extends RecentSeen>(items: T[], recent: string[]): T[] {
  if (recent.length === 0 || items.length === 0) return items;
  const rank = new Map(recent.map((k, i) => [k, i]));
  const fresh: T[] = [];
  const seen: T[] = [];
  for (const item of items) {
    if (rank.has(recentKey(item))) seen.push(item);
    else fresh.push(item);
  }
  if (seen.length === 0) return items;
  seen.sort((a, b) => (rank.get(recentKey(a)) ?? 0) - (rank.get(recentKey(b)) ?? 0));
  return [...fresh, ...seen];
}
