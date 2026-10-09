// Per-topicId memory of the lesson scroll position, so that the position can be
// restored after the ScrollView re-mounts on a phase change.

import { clearScrollY, getScrollY, setScrollY } from '../scrollMemory';

describe('scrollMemory', () => {
  it('returns 0 for a topic that was never set', () => {
    expect(getScrollY('never-set')).toBe(0);
  });

  it('remembers the last set position per topic', () => {
    setScrollY('ser-estar', 240);
    setScrollY('hay-estar', 80);
    expect(getScrollY('ser-estar')).toBe(240);
    expect(getScrollY('hay-estar')).toBe(80);
  });

  it('clears a topic back to 0', () => {
    setScrollY('ser-estar', 240);
    clearScrollY('ser-estar');
    expect(getScrollY('ser-estar')).toBe(0);
  });
});
