// E150: the Small test's miss card for the typed task kinds shows the right answer (every gap) and the item's why, in the
// UI language, in both skins. A choice question keeps LevelTestFeedback (covered in LevelTestFeedback.test.tsx).

import { render, screen } from '@testing-library/react-native';

import ItemAnswer from '@/components/grammar/ItemAnswer';
import { getDb } from '@/lib/database.web';
import type { BankItem, ClozeItem, FixItem, NounItem } from '@/lib/grammar/lessonTypes';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);
const l4 = (en: string, hu?: string) => ({ en, es: en, hu: hu ?? en, de: en }) as never;

const cloze: ClozeItem = {
  kind: 'opencloze', id: 'c1', text: 'Ayer ___ y ___ mucho.', answers: ['pidió', 'durmió'], tr: l4('Yesterday he asked and slept.'), why: l4('Past: e>i.', 'Mult: e>i.'),
};
const fix: FixItem = { kind: 'fix', id: 'f1', es: 'Yo es alto', wrongIndex: 1, answer: 'soy', explain: l4('Yo takes soy.'), tr: l4('I am tall.') };
const bank: BankItem = { kind: 'bank', id: 'b1', bank: ['rojo'], es: 'Los coches son ___.', word: 'rojo', answer: 'rojos', tr: l4('The cars are red.'), why: l4('Agrees in number.') };
const noun: NounItem = { kind: 'noun', id: 'n1', base: 'la ciudad', ask: l4('plural'), answer: 'las ciudades', why: l4('Ends in d, add es.') };

const CASES: [string, ClozeItem | FixItem | BankItem | NounItem, string, string][] = [
  ['opencloze', cloze, 'Ayer pidió y durmió mucho.', 'Past: e>i.'],
  ['fix', fix, 'Yo soy alto', 'Yo takes soy.'],
  ['bank', bank, 'Los coches son rojos.', 'Agrees in number.'],
  ['noun', noun, 'las ciudades', 'Ends in d, add es.'],
];

describe.each(['brand', 'classic'] as const)('ItemAnswer (%s palette)', (palette) => {
  beforeEach(async () => {
    await getDb().setGrammarPalette(palette);
  });
  it.each(CASES)('%s: the right answer and the why are on the card', async (_k, item, answer, why) => {
    render(
      <ThemeProvider>
        <ItemAnswer item={item} contentLang="en" />
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByTestId('small-test-miss-answer')).toHaveTextContent(answer);
    expect(screen.getByTestId('small-test-miss-why')).toHaveTextContent(why);
  });
  it('a typed answer is compared letter by letter, as under a word card (FB735, FB745, FB749)', async () => {
    render(
      <ThemeProvider>
        <ItemAnswer item={cloze} contentLang="en" given="Ayer pidio y durmió mucho." />
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByTestId('answer-compare-typed')).toHaveTextContent('Ayer pidio y durmió mucho.');
    expect(screen.getByTestId('answer-compare-correct')).toHaveTextContent('Ayer pidió y durmió mucho.');
    // the wrong letter is struck in the typed row, the rest of the long sentence is plain
    const struck = screen.getByTestId('answer-compare-typed').findAll((n) => n.props.style?.textDecorationLine === 'line-through' && n.props.children === 'o');
    expect(struck.length).toBeGreaterThan(0);
    expect(screen.getByTestId('small-test-miss-why')).toHaveTextContent('Past: e>i.');
  });
  it('a typed word of a bank item is compared with the right word, the full sentence stays', async () => {
    render(
      <ThemeProvider>
        <ItemAnswer item={bank} contentLang="en" given="rojo" />
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByTestId('answer-compare-correct')).toHaveTextContent('rojos');
    expect(screen.getByTestId('small-test-miss-answer')).toHaveTextContent('Los coches son rojos.');
  });
  it('the why is in the UI language', async () => {
    render(
      <ThemeProvider>
        <ItemAnswer item={cloze} contentLang="hu" />
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByTestId('small-test-miss-why')).toHaveTextContent('Mult: e>i.');
  });
});
