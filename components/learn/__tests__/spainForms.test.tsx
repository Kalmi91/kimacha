import { render } from '@testing-library/react-native';
import PcicRevealedAnswer from '../PcicRevealedAnswer';
import Colors from '@/constants/Colors';
import type { PcicItem, PcicTarget } from '@/data/pcic';
import { setLanguage, t } from '@/lib/i18n';
import type { Lang } from '@/lib/languagePair';
import type { Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const card: Sm2Card = {
  itemId: 'o4216', state: 'learning', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0,
  due: '', lastReview: null, introducedAt: null,
};
const item: PcicItem = {
  id: 'o4216', order: 4216, es: 'la aeromoza / la azafata', en: 'flight attendant', kind: 'word', section: '',
  exampleEs: 'Una azafata me dio agua y un dulce en el avión.',
  exampleEn: 'A flight attendant gave me water and a candy on the plane.',
};

function show(best: string, currentItem = item, nextGrade: 'again' | 'good' = 'again', target: PcicTarget = 'es', sourceLang?: Lang) {
  return render(
    <ThemeProvider>
      <PcicRevealedAnswer colors={Colors.light} s={t()} typedAnswer="" grade={{ match: 'wrong', best }}
        nextGrade={nextGrade} current={card} currentItem={currentItem} today="2026-11-14" target={target}
        sourceLang={sourceLang} onGrade={() => {}} />
    </ThemeProvider>
  );
}

beforeEach(() => setLanguage('en'));
afterEach(() => setLanguage('en'));

describe('Spain labels on revealed cards', () => {
  it('marks a Spain answer and its example with visible localized text and accessibility labels', async () => {
    const view = show('la azafata');
    await makeFlush(6)();
    expect(view.getByTestId('pcic-answer-spain')).toHaveTextContent('🇪🇸 Spain: azafata');
    expect(view.getByTestId('pcic-example-spain')).toHaveTextContent('🇪🇸 Spain: azafata');
    expect(view.getByTestId('pcic-example-spain').props.accessibilityLabel).toBe('Spain: azafata');
    expect(view.queryByTestId('pcic-alternative-spain-0')).toBeNull();
  });

  it.each(['again', 'good'] as const)('marks only the Spain alternative on an %s answer', async nextGrade => {
    const view = show('la aeromoza', item, nextGrade);
    await makeFlush(6)();
    expect(view.queryByTestId('pcic-answer-spain')).toBeNull();
    expect(view.getByTestId(nextGrade === 'good' ? 'pcic-also-spain-0' : 'pcic-alternative-spain-0')).toHaveTextContent('🇪🇸 Spain: azafata');
  });

  it('does not label a Mexican-only card or other target languages', async () => {
    const mexican = { ...item, es: 'la aeromoza', exampleEs: 'Una aeromoza llegó.' };
    const view = show('la aeromoza', mexican);
    await makeFlush(6)();
    expect(view.queryByTestId('pcic-answer-spain')).toBeNull();
    expect(view.queryByTestId('pcic-example-spain')).toBeNull();
    view.unmount();
    const english = show('azafata', item, 'again', 'en', 'hu');
    await makeFlush(6)();
    expect(english.queryByTestId('pcic-answer-spain')).toBeNull();
    expect(english.queryByTestId('pcic-example-spain')).toBeNull();
    expect(english.queryByTestId('pcic-example-gloss-spain')).toBeNull();
  });

  it('marks the Spanish gloss when Spanish is the source language', async () => {
    const view = show('flight attendant', item, 'again', 'en', 'es');
    await makeFlush(6)();
    expect(view.queryByTestId('pcic-answer-spain')).toBeNull();
    expect(view.getByTestId('pcic-example-gloss-spain')).toHaveTextContent('🇪🇸 Spain: azafata');
  });

  it('marks the inflected breakdown example despite its stale Mexican lemma', async () => {
    const view = show('estropearse', {
      ...item, id: 'o4666', es: 'descomponerse / estropearse',
      exampleEs: 'El refrigerador se estropeó y hay que arreglarlo.',
    });
    await makeFlush(6)();
    expect(view.getByTestId('pcic-answer-spain')).toHaveTextContent('🇪🇸 Spain: estropearse');
    expect(view.getByTestId('pcic-example-spain')).toHaveTextContent('🇪🇸 Spain: estropearse');
  });

  it.each([['en', 'Spain'], ['es', 'España'], ['hu', 'spanyolországi'], ['de', 'Spanien']])('uses the %s localization', async (language, label) => {
    setLanguage(language);
    const view = show('la azafata');
    await makeFlush(6)();
    expect(view.getByTestId('pcic-answer-spain')).toHaveTextContent(`🇪🇸 ${label}: azafata`);
  });
});
