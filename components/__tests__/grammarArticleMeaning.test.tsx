// FB493, Kálmán: „itt legyenek angolul is a szavak, hogy mit jelentenek ha tippeltem": az el / la tételnél a főnév
// jelentése (tr) a válasz után magától megjelenik (az F-gomb mögötti fordítás-sorban), a következő tételnél újra zárt;
// a sima választós tételnél a fordítás továbbra is csak az F-gombra nyílik.
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
])('az el / la tétel főnév-jelentése (FB493), %s paletta', (_name, palette) => {
  beforeEach(async () => {
    await getDb().setGrammarPalette(palette as 'classic' | 'brand');
  });

  it('válasz előtt rejtett, válasz után magától megjelenik (jó és rossz tippnél is), a felület nyelvén', async () => {
    render(drill({ ...articleTopic, items: [articleTopic.items[0]] }, 'en'));
    await flush();

    expect(screen.queryByTestId('choice-translation')).toBeNull();
    fireEvent.press(screen.getAllByTestId('grammar-option')[1]); // rossz tipp: la
    expect(screen.getByTestId('choice-translation')).toHaveTextContent('water');
  });

  it('a jelentés a hu / de felületen a saját nyelvén áll', async () => {
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

  it('az F-gomb válasz előtt is megmutatja, és a következő tételnél újra zárt', async () => {
    render(drill(articleTopic, 'en'));
    await flush();

    // a kör sorrendje seedelt: a megjelenített szóból tudjuk, melyik jelentés jár hozzá
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

  it('a sima választós tételnél a fordítás válasz után is csak az F-gombra nyílik', async () => {
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
