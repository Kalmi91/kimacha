// NY22: a neo-brutalista drill (2. képernyő): szegmentált progress, combo-matrica
// (csak memóriában, hibánál nullázódik, x2-től látszik), 2x2 válasz-rács, a
// helyes = a kitöltés + pipa, b kitöltésű visszajelző, "next →" gomb.
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import lessonJson from '@/data/games/grammar/es/presente-irregular.json';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { getDb } from '@/lib/database';
import { hashString, shuffleArray } from '@/lib/shuffle';
import { ThemeProvider } from '@/lib/ThemeContext';

const lesson = lessonJson as unknown as LessonV2;

const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('GrammarDrill, neo-brutalista (NY22)', () => {
  const now = 1700000000000;
  beforeEach(async () => {
    await getDb().setGrammarPalette('brand');
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const roundItems = () =>
    buildGrammarRound(lesson, hashString(`${lesson.topic}:${now}`)).filter(isChoiceRoundItem);
  const pick = (idx: number) => fireEvent.press(screen.getAllByTestId('grammar-option')[idx]);

  it('a combo x2-től látszik, hibánál nullázódik; a helyes válasz a kitöltést és a pipát kapja', async () => {
    const items = roundItems();
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} />
      </ThemeProvider>
    );
    await flush();

    expect(screen.queryByTestId('grammar-drill-segments')).toBeTruthy();
    expect(screen.queryByTestId('grammar-combo')).toBeNull();

    pick(items[0].correctIndex);
    // helyes = a kitöltés + pipa, visszajelző + next gomb
    const options = screen.getAllByTestId('grammar-option');
    expect(StyleSheet.flatten(options[items[0].correctIndex].props.style).backgroundColor).toBe(PALETTE_FILLS.brand.a);
    expect(screen.queryByText('perfect!')).toBeTruthy();
    expect(screen.queryByText(' ✓')).toBeTruthy();
    expect(screen.queryByTestId('grammar-combo')).toBeNull();
    fireEvent.press(screen.getByTestId('grammar-next'));

    pick(items[1].correctIndex);
    expect(screen.queryByText('combo x2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));

    const wrong = (items[2].correctIndex + 1) % items[2].options.length;
    pick(wrong);
    expect(screen.queryByTestId('grammar-combo')).toBeNull();
    expect(screen.queryByText('Not quite!')).toBeTruthy();
    view.unmount();
  });

  it('a bezáró X doboz a fejlécben van, és az onClose-t hívja (mint a ← gomb)', async () => {
    const onClose = jest.fn();
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} onClose={onClose} />
      </ThemeProvider>
    );
    await flush();
    fireEvent.press(screen.getByTestId('grammar-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  const renderKind = async (kind: 'match' | 'form' | 'why' | 'transform', topic: LessonV2 = lesson) => {
    const onFinish = jest.fn();
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={topic} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={[kind]} />
      </ThemeProvider>
    );
    await flush();
    return { onFinish, view };
  };
  const dashedCount = () =>
    screen.UNSAFE_getAllByType(View).filter((v) => StyleSheet.flatten(v.props.style)?.borderStyle === 'dashed').length;
  const front = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

  it('match: a párosított cella a-kitöltés + pipa, a hibás szaggatott, visszajelző + next gomb', async () => {
    const { onFinish, view } = await renderKind('match');
    const items = buildGrammarRound(lesson, hashString(`${lesson.topic}:${now}`));
    const match = items.map((r) => r.item).find((i) => (i as { kind?: string }).kind === 'match') as unknown as {
      id: string;
      pairs: { en: string; es: string }[];
    };
    const rightOrder = shuffleArray(match.pairs.map((_, i) => i), hashString(match.id));
    // hibás pár: az 1. bal a 0. jobb (ha az nem az övé)
    const wrongPos = rightOrder.findIndex((p) => p !== 0);
    fireEvent.press(screen.getByTestId('match-left-0'));
    fireEvent.press(screen.getByTestId(`match-right-${wrongPos}`));
    expect(front(`match-right-${wrongPos}`).borderStyle).toBe('dashed');
    match.pairs.forEach((_, li) => {
      fireEvent.press(screen.getByTestId(`match-left-${li}`));
      fireEvent.press(screen.getByTestId(`match-right-${rightOrder.indexOf(li)}`));
    });
    expect(front('match-left-0').backgroundColor).toBe(PALETTE_FILLS.brand.a);
    expect(screen.queryAllByText(' ✓').length).toBeGreaterThan(0);
    expect(screen.queryByText('Not quite!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    // FB420: a párosítás részpontot kap: 6 pár, 1 elrontott = 5/6 (nem 0/1).
    expect(onFinish).toHaveBeenCalledWith(5, 6);
    view.unmount();
  });

  it('form: a beviteli mező dobozban, hibás válasz után szaggatott keret és b kitöltésű visszajelző', async () => {
    const { onFinish, view } = await renderKind('form');
    fireEvent.changeText(screen.getByTestId('formInput'), 'zzz');
    expect(dashedCount()).toBe(0);
    fireEvent.press(screen.getByTestId('formCheck'));
    expect(screen.queryByText('Not quite!')).toBeTruthy();
    expect(dashedCount()).toBe(1);
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.queryByTestId('formCheck')).toBeTruthy();
    view.unmount();
  });

  it('why: a helyes válasz a-kitöltés + pipa, a hibás szaggatott', async () => {
    const { view } = await renderKind('why');
    const item = lesson.items.find((i) => i.kind === 'why') as unknown as { correctIndex: number };
    const options = screen.getAllByTestId('grammar-option');
    // a nem-helyes elsőt nyomjuk meg
    const picked = options.findIndex((_, i) => i !== item.correctIndex);
    fireEvent.press(options[picked]);
    expect(StyleSheet.flatten(screen.getAllByTestId('grammar-option')[picked].props.style).borderStyle).toBe('dashed');
    expect(screen.queryByText('Not quite!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-next'));
    view.unmount();
  });

  it('transform: beviteli doboz, hibás után szaggatott + b kitöltésű visszajelző, ink next gomb', async () => {
    const transformLesson: LessonV2 = {
      schema: 2,
      topic: 'test-transform-brutal',
      level: 'A2',
      title: { hu: 't', en: 't', es: 't', de: 't' },
      body: [],
      speak: { hu: 'h', en: 'e', es: 's', de: 'd' },
      items: [
        {
          kind: 'transform',
          id: 'tr-b1',
          tense: { from: 'presente', to: 'indefinido' },
          prompt: { hu: 'Eszem kenyeret.', en: 'I eat bread.', es: 'Como pan.', de: 'Ich esse Brot.' },
          answer: 'Comí pan.',
          wordIds: ['1'],
          why: { hu: 'ok', en: 'because', es: 'porque', de: 'weil' },
        },
      ],
    };
    const { onFinish, view } = await renderKind('transform', transformLesson);
    expect(screen.queryByText('Como pan.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'nope');
    expect(dashedCount()).toBe(0);
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(dashedCount()).toBe(1);
    expect(screen.queryByText('Correct answer')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('transform-next').props.style).backgroundColor).toBe('#111111');
    fireEvent.press(screen.getByTestId('transform-next'));
    expect(onFinish).toHaveBeenCalledWith(0, 1);
    view.unmount();
  });

  it('classic palettával a mai drill jelenik meg (nincs szegmentált sáv)', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} />
      </ThemeProvider>
    );
    await flush();
    await flush();
    expect(screen.queryByTestId('grammar-drill-segments')).toBeNull();
    expect(screen.queryByTestId('grammar-drill-progress')).toBeTruthy();
    view.unmount();
  });
});
