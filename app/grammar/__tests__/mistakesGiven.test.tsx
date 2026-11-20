// FB692: the "Mistakes:" list shows what the learner GAVE next to the right solution, for every kind that has learner input.
// Each kind: one wrong answer ("zzz") played in the drill, then the round's misses drawn by the shared result screen.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill, { type RoundStats } from '@/components/grammar/GrammarDrill';
import GrammarResult from '@/components/grammar/GrammarResult';
import { getDb } from '@/lib/database.web';
import type { GrammarKind } from '@/lib/games/content';
import { missOfItem } from '@/lib/grammar/roundMiss';
import { lessonFor } from '@/lib/grammar/syllabus';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

// a one-item lesson of the wanted kind, taken from a real lesson (not one lane B edits)
function oneItem(topic: string, kind: string) {
  const lesson = lessonFor('es', topic)!;
  const item = (lesson.items as unknown as { kind?: string }[]).find((i) => i.kind === kind)!;
  expect(item).toBeTruthy();
  return { lesson: { ...lesson, items: [item] } as typeof lesson, item: item as any };
}

async function playWrong(topic: string, kind: GrammarKind, answerKind: string, before?: (item: any) => void) {
  const { lesson, item } = oneItem(topic, answerKind);
  let stats: RoundStats | null = null;
  render(
    <ThemeProvider>
      <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" kinds={[kind]} onFinish={() => {}} onRoundStats={(s) => (stats = s)} />
    </ThemeProvider>,
  );
  await flush(2);
  before?.(item);
  const prefix = answerKind === 'write' ? 'write' : answerKind === 'transform' ? 'transform' : answerKind;
  fireEvent.changeText(screen.getByTestId(`${prefix}-input`), 'zzz');
  fireEvent.press(screen.getByTestId(`${prefix}-check`));
  await flush(1);
  fireEvent.press(screen.getByTestId(answerKind === 'transform' ? 'transform-next' : 'grammar-next'));
  await flush(2);
  expect(stats).not.toBeNull();
  const misses = (stats as unknown as RoundStats).misses;
  expect(misses).toHaveLength(1);
  screen.unmount();
  render(
    <ThemeProvider>
      <GrammarResult correct={0} total={1} misses={misses} onRetake={() => {}} onBack={() => {}} />
    </ThemeProvider>,
  );
  await flush(1);
  return item;
}

beforeEach(async () => {
  const db = getDb();
  await db.setOnboarding('en', 'es');
  (db as any).__setLevelForTest('A1');
});

describe('Mistakes list: what the learner gave and the right solution', () => {
  it('noun (sustantivo-numero)', async () => {
    const item = await playWrong('sustantivo-numero', 'noun', 'noun');
    expect(screen.getByTestId('grammar-mistakes')).toBeTruthy();
    expect(screen.getByTestId('grammar-mistake-given')).toHaveTextContent('zzz');
    expect(screen.getByTestId('grammar-mistake-correct')).toHaveTextContent(item.answer);
  });

  it('write (por-para)', async () => {
    const item = await playWrong('por-para', 'write', 'write');
    expect(screen.getByTestId('grammar-mistake-given')).toHaveTextContent('zzz');
    expect(screen.getByTestId('grammar-mistake-correct')).toHaveTextContent(item.es);
  });

  it('transform (por-para)', async () => {
    const item = await playWrong('por-para', 'transform', 'transform');
    expect(screen.getByTestId('grammar-mistake-given')).toHaveTextContent('zzz');
    expect(screen.getByTestId('grammar-mistake-correct')).toHaveTextContent(item.answer);
  });

  it('fix (verbos-reflexivos): the sentence as the learner left it, and the fixed one', async () => {
    const item = await playWrong('verbos-reflexivos', 'fix', 'fix', (it) => fireEvent.press(screen.getByTestId(`fix-word-${it.wrongIndex}`)));
    expect(screen.getByTestId('grammar-mistake-given')).toHaveTextContent(/zzz/);
    expect(screen.getByTestId('grammar-mistake-correct')).toHaveTextContent(new RegExp(item.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  it('bank (verbos-reflexivos): the sentence with the learner word in the gap', async () => {
    const item = await playWrong('verbos-reflexivos', 'bank', 'bank');
    expect(screen.getByTestId('grammar-mistake-given')).toHaveTextContent(item.es.replace('___', 'zzz'));
    expect(screen.getByTestId('grammar-mistake-correct')).toHaveTextContent(item.es.replace('___', item.answer));
  });
});

describe('missOfItem', () => {
  it('keeps given null when the learner gave nothing, and nothing for matching', () => {
    const { item } = oneItem('por-para', 'write');
    expect(missOfItem(item, 'en')?.given).toBeNull();
    expect(missOfItem(item, 'en', 'zzz')?.given).toBe('zzz');
  });
});
