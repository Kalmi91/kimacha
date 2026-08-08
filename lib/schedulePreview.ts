// FB100, Kálmán 2026-08-08: "valahol jeleznie kellene, hogy mennyi szó van hány
// napra elrakva, meg higy mikor frissül."
//
// The FSRS due dates already hold that answer, they were just never shown. This
// module turns a plain list of due timestamps into the buckets the Stats tab
// renders, so the grouping stays pure and testable (the DB only hands over the
// raw `due` strings).

export type ScheduleBucketKey = 'today' | 'tomorrow' | 'days2to3' | 'days4to7' | 'later';

export interface ScheduleBucket {
  key: ScheduleBucketKey;
  count: number;
}

export interface SchedulePreview {
  // Cards waiting right now (due in the past or earlier today's clock time).
  dueNow: number;
  // Everything still scheduled ahead, grouped by how far out it sits.
  buckets: ScheduleBucket[];
  scheduled: number;
  // Earliest still-future due timestamp, i.e. when the queue next refills.
  nextDue: string | null;
}

const BUCKET_ORDER: ScheduleBucketKey[] = ['today', 'tomorrow', 'days2to3', 'days4to7', 'later'];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// Calendar days between two instants, so "tomorrow" means the next date on the
// wall clock, not 24 hours from now (a card due tonight is still "today").
export function daysUntil(due: Date, now: Date): number {
  return Math.round((startOfDay(due) - startOfDay(now)) / 86400000);
}

function bucketFor(days: number): ScheduleBucketKey {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 3) return 'days2to3';
  if (days <= 7) return 'days4to7';
  return 'later';
}

export function buildSchedulePreview(dueDates: string[], now: Date): SchedulePreview {
  const counts = new Map<ScheduleBucketKey, number>();
  let dueNow = 0;
  let scheduled = 0;
  let nextDue: string | null = null;

  for (const raw of dueDates) {
    const due = new Date(raw);
    if (Number.isNaN(due.getTime())) continue; // a corrupt row must not hide the rest
    if (due.getTime() <= now.getTime()) {
      dueNow++;
      continue;
    }
    scheduled++;
    const key = bucketFor(daysUntil(due, now));
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (nextDue === null || due.getTime() < new Date(nextDue).getTime()) nextDue = raw;
  }

  return {
    dueNow,
    buckets: BUCKET_ORDER.filter((key) => counts.has(key)).map((key) => ({ key, count: counts.get(key)! })),
    scheduled,
    nextDue,
  };
}
