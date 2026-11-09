const { isUniqueLongestWhyOption, whyLengthIssue } = require('../../scripts/whyGiveaway.cjs');

const item = (texts: string[], correctIndex: number) => ({
  kind: 'why',
  correctIndex,
  options: texts.map((en) => ({ text: { en } })),
});

describe('why option length gate', () => {
  it('counts the correct answer only when it is strictly longer than every distractor', () => {
    expect(isUniqueLongestWhyOption(item(['habit', 'a finished event', 'request'], 1))).toBe(true);
    expect(isUniqueLongestWhyOption(item(['a finished event', 'habit', 'request'], 1))).toBe(false);
    expect(isUniqueLongestWhyOption(item(['habit', 'a finished event', 'a repeated event'], 1))).toBe(false);
    expect(isUniqueLongestWhyOption(item(['same', 'same', 'same'], 2))).toBe(false);
  });

  it('uses character length, as the corpus audit does', () => {
    expect(isUniqueLongestWhyOption(item(['one long word', 'extraordinary', 'two'], 1))).toBe(false);
    expect(isUniqueLongestWhyOption(item(['one long word', 'extraordinarily', 'two'], 1))).toBe(true);
  });

  it('ignores non-why and malformed items, which have separate schema checks', () => {
    expect(isUniqueLongestWhyOption({ ...item(['long', 'x'], 0), kind: 'choice' })).toBe(false);
    expect(isUniqueLongestWhyOption(item(['long', 'x'], 3))).toBe(false);
    expect(isUniqueLongestWhyOption(item(['long', 'x'], 0.5))).toBe(false);
    expect(isUniqueLongestWhyOption(item(['long'], 0))).toBe(false);
    expect(isUniqueLongestWhyOption({})).toBe(false);
  });

  it('rejects exactly 45 percent and higher, and accepts a lower ratio or an empty course', () => {
    expect(whyLengthIssue(9, 20)).toContain('45.0%');
    expect(whyLengthIssue(10, 20)).toContain('50.0%');
    expect(whyLengthIssue(44, 100)).toBeNull();
    expect(whyLengthIssue(449, 1000)).toBeNull();
    expect(whyLengthIssue(0, 0)).toBeNull();
    expect(whyLengthIssue(0, 10)).toBeNull();
  });
});
