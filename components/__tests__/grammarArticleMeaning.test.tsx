// User feedback: "the words should be in English here too, so I know what they mean when I guessed": for an el / la item the noun's
// meaning (tr) appears on its own after the answer (in the translation row behind the F button), and is closed again on the next item;
// for a plain choice item the translation still opens only on the F button.
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { GrammarTopicData } from '@/lib/games/content';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';

const four = (s: string) => ({ hu: s, en: s, es: s, de: s });

const noun = (id: string, word: string, article: 'el' | 'la', meaning: { hu: string; en: string; es: string; de: string }) => ({
  id,
  set: 'article' as const,
  sentence: `___ ${word}`,
  options: ['el', 'la'],
  correct: article === 'el' ? 0 : 1,
  why: four('why'),
  wrong: { [article === 'el' ? 'la' : 'el']: four('x') },
  examples: [],
  tr: meaning,
});

const AGUA = { hu: 'víz', en: 'water', es: 'water', de: 'Wasser' };
const MESA = { hu: 'asztal', en: 'table', es: 'table', de: 'Tisch' };

const articleTopic: GrammarTopicData = {
  schema: 2,
  topic: 'test-article',
  level: 'A1',
  title: four('t'),
  body: [],
  speak: four('s'),
  items: [noun('n1', 'agua', 'el', AGUA), noun('n2', 'mesa', 'la', MESA)],
};

const plainGapTopic: GrammarTopicData = {
  ...articleTopic,
  topic: 'test-plain-gap',
  items: [
    {
      id: 'g1',
      sentence: 'De niño, mi abuela siempre ___ pan los domingos.',
      options: ['hacía', 'hizo', 'hará'],
      correct: 0,
      why: four('why'),
      wrong: { hizo: four('x'), hará: four('x') },
      examples: ['Siempre me contaba historias.'],
      tr: four('As a child, my grandmother always baked bread on Sundays.'),
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
    <GrammarDrill topic={topic} learnedLang="es" contentLang={contentLang} onFinish={jest.fn()} kinds={['article']} />
  </ThemeProvider>
);

describe.each([
  ['classic', 'classic'],
  ['brutal', 'brand'],
])('the noun meaning of the el / la item, %s palette', (_name, palette) => {
  beforeEach(async () => {
    await getDb().setGrammarPalette(palette as 'classic' | 'brand');
  });

  it('hidden before answering, appears by itself after answering (on a right and a wrong guess), in the UI language', async () => {
    render(drill({ ...articleTopic, items: [articleTopic.items[0]] }, 'en'));
    await flush();

    expect(screen.queryByTestId('choice-translation')).toBeNull();
    fireEvent.press(screen.getAllByTestId('grammar-option')[1]); // wrong guess: la
    expect(screen.getByTestId('choice-translation')).toHaveTextContent('water');
  });

  it('on the hu / de UI the meaning is in its own language', async () => {
    const view = render(drill({ ...articleTopic, items: [articleTopic.items[0]] }, 'hu'));
    await flush();
    fireEvent.press(screen.getAllByTestId('grammar-option')[0]);
    expect(screen.getByTestId('choice-translation')).toHaveTextContent('víz');
    view.unmount();

    render(drill({ ...articleTopic, items: [articleTopic.items[0]] }, 'de'));
    await flush();
    fireEvent.press(screen.getAllByTestId('grammar-option')[0]);
    expect(screen.getByTestId('choice-translation')).toHaveTextContent('Wasser');
  });

  it('the F button shows it even before answering, and it is closed again on the next item', async () => {
    render(drill(articleTopic, 'en'));
    await flush();

    // the round's order is seeded: from the displayed word we know which meaning belongs to it
    fireEvent.press(screen.getByTestId('choice-f'));
    expect(screen.getByTestId('choice-translation')).toBeTruthy();
    fireEvent.press(screen.getByTestId('choice-f'));
    expect(screen.queryByTestId('choice-translation')).toBeNull();

    fireEvent.press(screen.getAllByTestId('grammar-option')[0]);
    expect(screen.getByTestId('choice-translation')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    await flush();
    expect(screen.queryByTestId('choice-translation')).toBeNull();
  });

  it('on a plain choice item the translation opens only on the F button even after answering', async () => {
    render(
      <ThemeProvider>
        <GrammarDrill topic={plainGapTopic} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} />
      </ThemeProvider>
    );
    await flush();

    fireEvent.press(screen.getAllByTestId('grammar-option')[0]);
    expect(screen.queryByTestId('choice-translation')).toBeNull();
    fireEvent.press(screen.getByTestId('choice-f'));
    expect(screen.getByTestId('choice-translation')).toBeTruthy();
  });
});
