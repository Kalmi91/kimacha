import { FUNNEL_EVENTS, parseFunnelEvent, parseFunnelSrc, toFunnelStats } from '../../../cloud/logic';

describe('parseFunnelSrc', () => {
  it('keeps a valid label as is', () => {
    expect(parseFunnelSrc('fb-group-1')).toBe('fb-group-1');
    expect(parseFunnelSrc('a'.repeat(24))).toBe('a'.repeat(24));
  });

  it('gives direct for uppercase, too long, other characters, empty and wrong types', () => {
    for (const raw of ['Abc', 'a'.repeat(25), 'a b', 'a_b', ' ab', '', undefined, null, 5, {}, ['a']]) expect(parseFunnelSrc(raw)).toBe('direct');
  });
});

describe('parseFunnelEvent', () => {
  it('accepts every known event and parses its src', () => {
    for (const event of FUNNEL_EVENTS) expect(parseFunnelEvent({ event, src: 'x' })).toEqual({ event, src: 'x' });
    expect(parseFunnelEvent({ event: 'open', src: 'BAD' })).toEqual({ event: 'open', src: 'direct' });
    expect(parseFunnelEvent({ event: 'open' })).toEqual({ event: 'open', src: 'direct' });
  });

  it('is null for an unknown event or a body that is not a plain object', () => {
    for (const body of [{ event: 'nope' }, { event: 5 }, {}, [], 'open', 5, null, undefined]) expect(parseFunnelEvent(body)).toBeNull();
  });
});

describe('toFunnelStats', () => {
  it('sums over the days, keeps the first and last day, ignores unknown events and sorts by open then src', () => {
    const stats = toFunnelStats([
      { day: '2026-11-02', src: 'b', event: 'open', count: 2 },
      { day: '2026-11-01', src: 'b', event: 'open', count: 3 },
      { day: '2026-11-03', src: 'b', event: 'start', count: 1 },
      { day: '2026-11-01', src: 'b', event: 'mystery', count: 99 },
      { day: '2026-11-05', src: 'a', event: 'open', count: 5 },
      { day: '2026-11-05', src: 'c', event: 'open', count: 9 },
      { day: '2026-11-04', src: 'c', event: 'return', count: 1 },
    ]);
    expect(stats.map((s) => s.src)).toEqual(['c', 'a', 'b']);
    expect(stats[2]).toEqual({ src: 'b', site: 0, open: 5, start: 1, cards5: 0, account: 0, return: 0, firstDay: '2026-11-01', lastDay: '2026-11-03' });
    expect(stats[0]).toMatchObject({ open: 9, return: 1, firstDay: '2026-11-04', lastDay: '2026-11-05' });
  });

  it('is empty for no rows', () => {
    expect(toFunnelStats([])).toEqual([]);
  });
});
