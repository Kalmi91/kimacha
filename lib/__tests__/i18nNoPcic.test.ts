import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';

// The PCIC corpus is no longer part of the app, so no string a learner can
// read may name it (the tab is called Learn / Aprender).
const texts = (node: unknown, out: string[] = []): string[] => {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') for (const v of Object.values(node)) texts(v, out);
  return out;
};

describe('user-visible strings', () => {
  it.each([
    ['en', en],
    ['es', es],
  ])('%s: none mentions PCIC', (_lang, bundle) => {
    expect(texts(bundle).filter((s) => /PCIC/i.test(s))).toEqual([]);
  });

  it('names the Learn tab Learn / Aprender', () => {
    expect(en.tabs.pcic).toBe('Learn');
    expect(es.tabs.pcic).toBe('Aprender');
  });
});
