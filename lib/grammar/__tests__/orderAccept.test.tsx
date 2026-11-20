// Word order (`order`): `accept` lists further right orders of the same words. The lesson practice (OrderDrillItem ->
// EasySentenceCard) and the tests (ExamTilesCard, via the `tiles` view of lessonTest) both take such an order as right;
// what is shown after a miss stays `es`. The data test holds every `accept` entry of every direction to the same words.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { OrderDrillItem } from '@/components/grammar/NewKinds';
import ExamTilesCard from '@/components/exam/ExamTilesCard';
import { ThemeProvider } from '@/lib/ThemeContext';
import { getGrammarTopics, isOrderItem, type GrammarItem, type GrammarTopicData } from '@/lib/games/content';
import { tileWords } from '@/lib/sentenceCards';
import { lessonFor } from '../syllabus';
import { questionOfItem } from '../lessonTest';
import type { OrderItem } from '../lessonTypes';

jest.mock('@/lib/speech', () => ({ ...require('@/test-utils/mocks').speechMock(), stop: jest.fn() }));

const item: OrderItem = {
  kind: 'order',
  id: 'accept-test',
  prompt: { en: 'Yesterday I spoke.', es: 'Ayer hablé.' },
  es: 'Ayer hablé.',
  accept: ['Hablé ayer.'],
};

const wrap = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);

describe('lesson practice (OrderDrillItem)', () => {
  const run = (words: string[]) => {
    const onDone = jest.fn();
    wrap(<OrderDrillItem item={item} learnedLang="es" contentLang="en" onDone={onDone} />);
    for (const w of words) fireEvent.press(screen.getAllByText(w)[0]);
    fireEvent.press(screen.getByText('Check'));
    fireEvent.press(screen.getByText(/Next/));
    return onDone;
  };

  it('the main order is right', () => expect(run(['ayer', 'hablé'])).toHaveBeenCalledWith(true, undefined, expect.any(String)));
  it('an accept order is right', () => expect(run(['hablé', 'ayer'])).toHaveBeenCalledWith(true, undefined, expect.any(String)));
  it('another order is still wrong', () => {
    const wrong: OrderItem = { ...item, es: 'Yo hablé ayer.', accept: ['Ayer yo hablé.'] };
    const onDone = jest.fn();
    wrap(<OrderDrillItem item={wrong} learnedLang="es" contentLang="en" onDone={onDone} />);
    for (const w of ['hablé', 'yo', 'ayer']) fireEvent.press(screen.getAllByText(w)[0]);
    fireEvent.press(screen.getByText('Check'));
    fireEvent.press(screen.getByText(/Next/));
    expect(onDone).toHaveBeenCalledWith(false, undefined, expect.any(String));
  });
});

describe('tests (the tiles view)', () => {
  const lesson = lessonFor('es', 'por-para') as unknown as GrammarTopicData;
  const view = () => {
    const q = questionOfItem(item as unknown as GrammarItem, lesson, 'es', 'en', 1);
    if (!q || q.view.card !== 'tiles') throw new Error('no tiles view');
    return q.view;
  };

  it('the view carries the accept orders as tiles and keeps es as the shown answer', () => {
    const v = view();
    expect(v.answerTokens).toEqual(['ayer', 'hablé']);
    expect(v.acceptTokens).toEqual([['hablé', 'ayer']]);
    expect(v.sentence).toBe('Ayer hablé.');
  });

  it('an item without accept has no acceptTokens', () => {
    const q = questionOfItem({ ...item, accept: undefined } as unknown as GrammarItem, lesson, 'es', 'en', 1);
    expect(q?.view).not.toHaveProperty('acceptTokens');
  });

  const card = (onDone: jest.Mock) => {
    const v = view();
    return <ExamTilesCard prompt={v.prompt} answerTokens={v.answerTokens} acceptTokens={v.acceptTokens} sentence={v.sentence} distractors={[]} instant onDone={onDone} />;
  };
  const build = (words: string[]) => {
    for (const w of words) fireEvent.press(screen.getByText(w));
    fireEvent.press(screen.getByTestId('exam-check'));
  };

  it('an accept order is right in the test', () => {
    const onDone = jest.fn();
    wrap(card(onDone));
    build(['hablé', 'ayer']);
    expect(onDone).toHaveBeenCalledWith(true, 'hablé ayer');
  });

  it('a wrong order is still wrong in the test', () => {
    const onDone = jest.fn();
    wrap(<ExamTilesCard prompt="p" answerTokens={['a', 'b', 'c']} acceptTokens={[['c', 'b', 'a']]} distractors={[]} instant onDone={onDone} />);
    build(['b', 'a', 'c']);
    expect(onDone).toHaveBeenCalledWith(false, 'b a c');
  });
});

describe('order accept in the data', () => {
  const key = (s: string) => tileWords(s).map((w) => w.toLowerCase()).sort().join('|');

  it('every accept entry has the same words as es (counted), differs from es, no repeat, no empty entry', () => {
    for (const lang of ['es', 'en', 'hu', 'de']) {
      for (const l of getGrammarTopics(lang)) {
        for (const it of l.items as GrammarItem[]) {
          if (!isOrderItem(it) || it.accept === undefined) continue;
          const where = `${lang}/${l.topic}/${it.id}`;
          expect({ where, isArray: Array.isArray(it.accept) }).toEqual({ where, isArray: true });
          const seen = new Set<string>();
          for (const a of it.accept) {
            expect({ where, a, nonEmpty: typeof a === 'string' && a.trim().length > 0 }).toEqual({ where, a, nonEmpty: true });
            expect({ where, a, sameWords: key(a) === key(it.es) }).toEqual({ where, a, sameWords: true });
            expect({ where, a, equalsEs: a === it.es || tileWords(a).join(' ').toLowerCase() === tileWords(it.es).join(' ').toLowerCase() }).toEqual({ where, a, equalsEs: false });
            expect({ where, a, repeated: seen.has(a) }).toEqual({ where, a, repeated: false });
            seen.add(a);
          }
        }
      }
    }
  });
});
