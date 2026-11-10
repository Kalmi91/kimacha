// FB639: after Check, every row of the word card is in the tree (the correct answer, its speaker, the example sentence, the
// translation, the grade buttons). A row dropped by a style or markup change must fail here; where the rows sit is the
// layout lock of scripts/ui-overlap.mjs (jest has no layout engine).
import { render } from '@testing-library/react-native';

import PcicRevealedAnswer from '../PcicRevealedAnswer';
import Colors from '@/constants/Colors';
import type { PcicItem } from '@/data/pcic';
import { t } from '@/lib/i18n';
import type { Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const item = {
  id: 'x-1',
  es: 'el carro / el coche',
  en: 'the car',
  exampleEs: 'Mi padre compró un carro nuevo.',
  exampleEn: 'My father bought a new car.',
  kind: 'word',
  section: 's',
  order: 1,
} as PcicItem;
const card: Sm2Card = {
  itemId: 'x-1', state: 'learning', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0,
  due: '', lastReview: null, introducedAt: null,
};

const renderCard = (nextGrade: 'again' | 'good', accentOnly: boolean) =>
  render(
    <ThemeProvider>
      <PcicRevealedAnswer
        colors={Colors.light}
        s={t()}
        typedAnswer="el carr"
        grade={{ match: nextGrade === 'good' ? 'exact' : 'wrong', best: 'el carro', accentOnly } as never}
        nextGrade={nextGrade}
        current={card}
        currentItem={item}
        today="2026-10-01"
        target="es"
        onGrade={() => {}}
      />
    </ThemeProvider>,
  );

describe('PcicRevealedAnswer keeps every row', () => {
  it('wrong answer: answer + speaker, the other accepted form, sentence, translation, both grade buttons', async () => {
    const view = renderCard('again', false);
    await makeFlush(6)();
    for (const id of [
      'pcic-result-badge', 'pcic-diff-line', 'pcic-correct-answer', 'pcic-correct-speak',
      'pcic-correct-answer-2', 'pcic-correct-speak-2',
      'pcic-example', 'pcic-example-speak', 'pcic-example-gloss',
      'pcic-grades', 'pcic-grade-again', 'pcic-grade-good',
    ]) {
      expect(view.queryByTestId(id)).not.toBeNull();
    }
  });

  it('right answer: the "also" row replaces the second answer row, the accent note shows when forgiven', async () => {
    const view = renderCard('good', true);
    await makeFlush(6)();
    for (const id of ['pcic-correct-answer', 'pcic-correct-speak', 'learn-also', 'pcic-accent-note', 'pcic-example', 'pcic-example-gloss', 'pcic-grade-good']) {
      expect(view.queryByTestId(id)).not.toBeNull();
    }
    expect(view.queryByTestId('pcic-correct-answer-2')).toBeNull();
  });
});
