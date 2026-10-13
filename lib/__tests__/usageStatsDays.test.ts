import { buildDayRange, localDateString } from '../usageStats';

// Day ranges must stay one entry per calendar day across DST changes
// (Europe/Budapest: 2026-03-29 and 2026-10-25; America/Mexico_City has none now).
const ANCHORS: Array<[number, number, number]> = [];
for (const [month, day] of [[2, 29], [9, 25]] as const) {
  for (let delta = -8; delta <= 8; delta++) ANCHORS.push([2026, month, day + delta]);
}

const NOW_TIMES: Array<[number, number]> = [
  [0, 30],
  [23, 30],
];

function utcDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

describe('buildDayRange around DST changes', () => {
  for (const days of [7, 30]) {
    for (const [hour, minute] of NOW_TIMES) {
      it(`${days} days, now at ${hour}:${minute}, every day exactly once in order`, () => {
        for (const [y, m, d] of ANCHORS) {
          const now = new Date(y, m, d, hour, minute);
          const range = buildDayRange(days, now);
          expect(range).toHaveLength(days);
          expect(new Set(range).size).toBe(days);
          expect(range[range.length - 1]).toBe(localDateString(now));
          for (let i = 1; i < range.length; i++) {
            expect(utcDayNumber(range[i]) - utcDayNumber(range[i - 1])).toBe(1);
          }
        }
      });
    }
  }
});
