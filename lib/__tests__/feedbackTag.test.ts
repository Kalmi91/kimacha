import { feedbackTag } from '../feedbackTag';

describe('feedbackTag', () => {
  it('names a sub-screen from its route group', () => {
    expect(feedbackTag('/grammar/ser-estar')).toBe('grammar:ser-estar');
    expect(feedbackTag('/pcic/b1')).toBe('pcic:b1');
  });

  it('keeps the deeper path segments, so a nested screen stays traceable', () => {
    expect(feedbackTag('/grammar/ser-estar/drill')).toBe('grammar:ser-estar:drill');
  });

  it('falls back to the group name on its own index', () => {
    expect(feedbackTag('/grammar')).toBe('grammar:index');
  });

  it('survives a trailing slash', () => {
    expect(feedbackTag('/grammar/ser-estar/')).toBe('grammar:ser-estar');
  });

  it('has something to send even from the root', () => {
    expect(feedbackTag('/')).toBe('app');
  });
});
