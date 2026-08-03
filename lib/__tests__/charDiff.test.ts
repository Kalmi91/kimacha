import { charDiff } from '../charDiff';

const render = (typed: string, correct: string, fold = true) =>
  charDiff(typed, correct, fold)
    .map(d => (d.missing ? `[${d.ch}]` : d.wrong ? `<${d.ch}>` : d.ch))
    .join('');

describe('charDiff', () => {
  it('marks nothing on an exact answer', () => {
    expect(charDiff('quiero', 'quiero').every(d => !d.wrong)).toBe(true);
  });

  // FB84: the dropped letter itself has to show up, not just vanish.
  it('marks a letter left out in the middle', () => {
    expect(render('we hve', 'we have')).toBe('we h[a]ve');
  });

  it('marks a letter left out at the end', () => {
    expect(render('quier', 'quiero')).toBe('quier[o]');
  });

  it('marks an extra typed letter without cascading', () => {
    expect(render('quierro', 'quiero')).toBe('quier<r>o');
  });

  it('marks a substituted letter on both sides', () => {
    expect(render('qiero', 'quiero')).toBe('q[u]iero');
  });

  it('folds case and accents by default, keeps them when told not to', () => {
    expect(charDiff('Anos', 'años', true).some(d => d.wrong)).toBe(false);
    expect(charDiff('Anos', 'años', false).some(d => d.wrong)).toBe(true);
    expect(charDiff('años', 'años', false).some(d => d.wrong)).toBe(false);
  });
});
