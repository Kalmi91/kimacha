import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

// FB470 (kártya-szintű folytatás): ha az app a nyelvtani lecke egy gyakorlatában (drill) záródott be, a
// következő hidegindításkor (lib/useAppResume.ts a leckére lép) a lecke ugyanabban a gyakorlatban nyílik meg;
// a gyakorlat maga a mentett körből (FB421, a haladás-sor `run` mezője) ugyanazt a tételt adja. A leckéből
// kilépve (a képernyő unmountol) a mentés törlődik, így a leckét később a listából megnyitva nem ugrik a drillbe.
// Napváltáskor érvénytelen.

const DRILL_KEY = 'drill';

interface DrillResume {
  topicId: string;
  kind: string;
  day: string;
}

export async function loadDrillResume(db: DB): Promise<DrillResume | null> {
  const raw = await loadResumeValue(db, DRILL_KEY);
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<DrillResume>;
  return typeof r.topicId === 'string' && typeof r.kind === 'string' && typeof r.day === 'string'
    ? { topicId: r.topicId, kind: r.kind, day: r.day }
    : null;
}

export async function saveDrillResume(db: DB, resume: DrillResume): Promise<void> {
  await saveResumeValue(db, DRILL_KEY, resume);
}

export async function clearDrillResume(db: DB): Promise<void> {
  await saveResumeValue(db, DRILL_KEY, null);
}

/** A mentett gyakorlat, ha ehhez a leckéhez és mai naphoz tartozik, és a lecke még kínálja ezt a fajtát. */
export function drillToResume<K extends string>(saved: DrillResume | null, topicId: string, day: string, availableKinds: readonly K[]): K | null {
  if (!saved || saved.topicId !== topicId || saved.day !== day) return null;
  return availableKinds.find((k) => k === saved.kind) ?? null;
}
