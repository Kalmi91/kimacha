import { feedbackTag } from '../feedbackTag';

describe('feedbackTag', () => {
  it('keeps the game tags the sheet already carries', () => {
    expect(feedbackTag('/games/word-rain')).toBe('game:word-rain');
    expect(feedbackTag('/games/ccat')).toBe('game:ccat');
  });

  it('names the Átbeszélő sub-screens', () => {
    expect(feedbackTag('/talk/comida')).toBe('talk:comida');
    expect(feedbackTag('/talk/quiz')).toBe('talk:quiz');
  });

  it('keeps the deeper path segments, so a nested screen stays traceable', () => {
    expect(feedbackTag('/talk/comida/a2')).toBe('talk:comida:a2');
  });

  it('falls back to the group name on its own index', () => {
    expect(feedbackTag('/talk')).toBe('talk:index');
  });

  it('survives a trailing slash', () => {
    expect(feedbackTag('/games/chat/')).toBe('game:chat');
  });

  it('has something to send even from the root', () => {
    expect(feedbackTag('/')).toBe('app');
  });
});
