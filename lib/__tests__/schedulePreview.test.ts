import { buildSchedulePreview, daysUntil } from '../schedulePreview';

const NOW = new Date('2026-08-08T10:00:00');
const at = (iso: string) => new Date(iso).toISOString();

describe('daysUntil', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysUntil(new Date('2026-08-08T23:30:00'), NOW)).toBe(0);
    expect(daysUntil(new Date('2026-08-09T06:00:00'), NOW)).toBe(1);
    expect(daysUntil(new Date('2026-08-11T06:00:00'), NOW)).toBe(3);
  });
});

describe('buildSchedulePreview', () => {
  it('separates what is waiting now from what is scheduled', () => {
    const preview = buildSchedulePreview(
      [at('2026-08-07T09:00:00'), at('2026-08-08T09:59:00'), at('2026-08-09T08:00:00')],
      NOW
    );
    expect(preview.dueNow).toBe(2);
    expect(preview.scheduled).toBe(1);
  });

  it('groups the scheduled cards by distance', () => {
    const preview = buildSchedulePreview(
      [
        at('2026-08-08T22:00:00'), // later today
        at('2026-08-09T08:00:00'), // tomorrow
        at('2026-08-10T08:00:00'), // 2-3 days
        at('2026-08-11T08:00:00'),
        at('2026-08-14T08:00:00'), // 4-7 days
        at('2026-09-20T08:00:00'), // later
      ],
      NOW
    );
    expect(preview.buckets).toEqual([
      { key: 'today', count: 1 },
      { key: 'tomorrow', count: 1 },
      { key: 'days2to3', count: 2 },
      { key: 'days4to7', count: 1 },
      { key: 'later', count: 1 },
    ]);
  });

  it('reports the earliest future due date as the next refresh', () => {
    const preview = buildSchedulePreview(
      [at('2026-08-20T08:00:00'), at('2026-08-09T18:30:00'), at('2026-08-01T08:00:00')],
      NOW
    );
    expect(preview.nextDue).toBe(at('2026-08-09T18:30:00'));
  });

  it('has no next refresh when everything is already waiting', () => {
    const preview = buildSchedulePreview([at('2026-08-01T08:00:00')], NOW);
    expect(preview.nextDue).toBeNull();
    expect(preview.buckets).toEqual([]);
  });

  it('skips a corrupt due value instead of dropping the report', () => {
    const preview = buildSchedulePreview(['not-a-date', at('2026-08-09T08:00:00')], NOW);
    expect(preview.scheduled).toBe(1);
    expect(preview.buckets).toEqual([{ key: 'tomorrow', count: 1 }]);
  });

  it('returns an empty report for an empty deck', () => {
    expect(buildSchedulePreview([], NOW)).toEqual({ dueNow: 0, buckets: [], scheduled: 0, nextDue: null });
  });
});
