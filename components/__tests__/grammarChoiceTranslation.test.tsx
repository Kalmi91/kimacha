// User feedback: "put a sentence translation here too": the translation of the sentence of a choice (gap) and a marking
// (mark) item is behind the F button, just like for the rewrite item; if the item has
// no `tr` (scripts/grammar-translate.py has not run yet), there is no button. Fixture with a hand-written `tr`.
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { GrammarTopicData } from '@/lib/games/content';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';

const four = (s: string) => ({ hu: s, en: s, es: s, de: s });

const gap = (id: string, tr?: { hu: string; en: string; es: string; de: string }) => ({
  id,
  sentence: 'De niño, mi abuela siempre ___ pan los domingos.',
  options: ['hacía', 'hizo', 'hará'],
  correct: 0,
  why: four('why'),
  wrong: { hizo: four('x'), hará: four('x') },
  examples: ['Siempre me contaba historias.'],
  ...(tr ? { tr } : {}),
});

const TR = {
  hu: 'Gyerekként a nagyim mindig kenyeret sütött vasárnaponként.',
  en: 'As a child, my grandmother always baked bread on Sundays.',
  es: 'De niño, mi abuela siempre hacía pan los domingos.',
  de: 'Als Kind backte meine Großmutter sonntags immer Brot.',
};

const withTr: GrammarTopicData = {
  schema: 2,
  topic: 'test-tr',
  level: 'A2',
  title: four('t'),
  body: [],
  speak: four('s'),
  items: [gap('g1', TR)],
};

const withoutTr: GrammarTopicData = { ...withTr, topic: 'test-no-tr', items: [gap('g2')] };

const markWithTr: GrammarTopicData = {
  ...withTr,
  topic: 'test-mark-tr',
  items: [
    {
      id: 'm1',
      kind: 'mark',
      sentence: 'Mi hermana come una manzana.',
      target: 'verb',
      answer: 'come',
      why: four('why'),
      wrong: { hermana: four('x') },
      examples: ['El niño lee un libro.'],
      tr: { hu: 'A húgom almát eszik.', en: 'My sister eats an apple.', es: 'Mi hermana come una manzana.', de: 'Meine Schwester isst einen Apfel.' },
    },
  ],
};

const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const drill = (topic: GrammarTopicData, contentLang = 'en') => (
  <ThemeProvider>
    <GrammarDrill topic={topic} learnedLang="es" contentLang={contentLang} onFinish={jest.fn()} kinds={['choice']} />
  </ThemeProvider>
);

describe.each([
  ['classic', 'classic'],
  ['brutal', 'brand'],
])('sentence translation of a choice item, %s palette', (_name, palette) => {
  beforeEach(async () => {
    await getDb().setGrammarPalette(palette as 'classic' | 'brand');
  });

  it('with tr: the F button is there, the translation is hidden by default, shows on F in the UI language, disappears on F again', async () => {
    render(drill(withTr, 'hu'));
    await flush();

    expect(screen.queryByTestId('choice-translation')).toBeNull();
    fireEvent.press(screen.getByTestId('choice-f'));
    expect(screen.getByTestId('choice-translation')).toHaveTextContent(TR.hu);
    fireEvent.press(screen.getByTestId('choice-f'));
    expect(screen.queryByTestId('choice-translation')).toBeNull();
  });

  it('for a language other than the UI language the English translation is the fallback', async () => {
    render(drill(withTr, 'xx'));
    await flush();
    fireEvent.press(screen.getByTestId('choice-f'));
    expect(screen.getByTestId('choice-translation')).toHaveTextContent(TR.en);
  });

  it('without tr: no F button and no translation', async () => {
    render(drill(withoutTr));
    await flush();
    expect(screen.queryByTestId('choice-f')).toBeNull();
    expect(screen.queryByTestId('choice-translation')).toBeNull();
  });

  it('the same for a mark item', async () => {
    render(drill(markWithTr, 'de'));
    await flush();
    fireEvent.press(screen.getByTestId('choice-f'));
    expect(screen.getByTestId('choice-translation')).toHaveTextContent('Meine Schwester isst einen Apfel.');
  });

  it('the translation stays after answering, and is closed again on the next item', async () => {
    const topic: GrammarTopicData = { ...withTr, items: [gap('g1', TR), gap('g3', TR)] };
    render(drill(topic, 'en'));
    await flush();

    fireEvent.press(screen.getByTestId('choice-f'));
    fireEvent.press(screen.getAllByTestId('grammar-option')[0]);
    expect(screen.getByTestId('choice-translation')).toHaveTextContent(TR.en);

    fireEvent.press(screen.getByTestId('grammar-next'));
    await flush();
    expect(screen.queryByTestId('choice-translation')).toBeNull();
    expect(screen.getByTestId('choice-f')).toBeTruthy();
  });
});
