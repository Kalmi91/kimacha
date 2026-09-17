import { doneAsk } from '../doneAsk';

describe('doneAsk', () => {
  it('offers more new words when the daily budget is spent but the level has more', () => {
    expect(doneAsk({ freshLeft: 3, black: 0, levelUntouched: 50 })).toBe('more-new');
  });

  it('offers practise when the whole level is exhausted', () => {
    expect(doneAsk({ freshLeft: 0, black: 0, levelUntouched: 0 })).toBe('practise');
  });

  it('says none when only the topic ran dry but the level did not (FB296/297/298)', () => {
    // This is the bug: freshLeft (topic-scoped) is 0, but black and levelUntouched
    // are both still positive, so the session is NOT over, just this topic is.
    expect(doneAsk({ freshLeft: 0, black: 5, levelUntouched: 100 })).toBe('none');
  });

  it('says none while both budget and level still have room, regardless of freshLeft', () => {
    expect(doneAsk({ freshLeft: 12, black: 4, levelUntouched: 30 })).toBe('none');
    expect(doneAsk({ freshLeft: 0, black: 4, levelUntouched: 30 })).toBe('none');
  });

  it('practise wins over more-new when the level is exhausted even if black is also 0', () => {
    expect(doneAsk({ freshLeft: 0, black: 0, levelUntouched: 0 })).toBe('practise');
  });

  it('practise applies even if black is still positive, once the level has nothing left', () => {
    expect(doneAsk({ freshLeft: 0, black: 7, levelUntouched: 0 })).toBe('practise');
  });
});
