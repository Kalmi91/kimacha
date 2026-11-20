// FB671 / FB672: the word order task is silent, and its tile bank holds 2 or 3 words that are not needed.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { OrderDrillItem } from '@/components/grammar/NewKinds';
import { ThemeProvider } from '@/lib/ThemeContext';
import { getGrammarTopics, isOrderItem, type GrammarItem, type GrammarTopicData } from '@/lib/games/content';
import { tileWords } from '@/lib/sentenceCards';
import { sentenceBuildMatch } from '@/lib/answerMatch';
import { speak } from '@/lib/speech';
import { buildLessonTest, questionOfItem } from '../lessonTest';
import { orderDistractorCount, orderDistractors } from '../orderTiles';
import type { OrderItem } from '../lessonTypes';

jest.mock('@/lib/speech', () => ({ ...require('@/test-utils/mocks').speechMock(), stop: jest.fn() }));

const key = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wrap = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);

const LANGS = ['es', 'en', 'hu', 'de'];
const orderCases = () =>
  LANGS.flatMap((lang) =>
    getGrammarTopics(lang).flatMap((l) =>
      (l.items as GrammarItem[]).filter(isOrderItem).map((it) => ({ lang, lesson: l, item: it as OrderItem, where: `${lang}/${l.topic}/${it.id}` })),
    ),
  );

describe('order distractors (FB672)', () => {
  const cases = orderCases();

  it('there are order tasks to check', () => expect(cases.length).toBeGreaterThan(0));

  it('every order task gets 2 or 3 unneeded tiles, both counts occur', () => {
    const counts = new Set<number>();
    for (const c of cases) {
      const d = orderDistractors(c.item, c.lesson.items);
      expect({ where: c.where, n: d.length }).toEqual({ where: c.where, n: orderDistractorCount(c.item.id) });
      expect({ where: c.where, ok: d.length === 2 || d.length === 3 }).toEqual({ where: c.where, ok: true });
      counts.add(d.length);
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });

  it('no unneeded tile is a word of the right sentence or of an accept sentence, or repeats', () => {
    for (const c of cases) {
      const own = new Set([c.item.es, ...(c.item.accept ?? [])].flatMap(tileWords).map(key));
      const d = orderDistractors(c.item, c.lesson.items);
      expect({ where: c.where, clash: d.filter((w) => own.has(key(w))) }).toEqual({ where: c.where, clash: [] });
      expect({ where: c.where, dup: new Set(d.map(key)).size }).toEqual({ where: c.where, dup: d.length });
    }
  });

  it('the tiles are words of other sentences of the same lesson', () => {
    for (const c of cases) {
      const others = new Set(
        (c.lesson.items as unknown as { id: string; es?: unknown }[])
          .filter((o) => o.id !== c.item.id && typeof o.es === 'string')
          .flatMap((o) => tileWords(o.es as string)),
      );
      for (const w of orderDistractors(c.item, c.lesson.items)) expect({ where: c.where, w, from: others.has(w) }).toEqual({ where: c.where, w, from: true });
    }
  });

  it('the same item always gets the same tiles', () => {
    for (const c of cases.slice(0, 40)) expect(orderDistractors(c.item, c.lesson.items)).toEqual(orderDistractors(c.item, [...c.lesson.items].reverse()));
  });

  it('an unneeded tile never builds a right answer', () => {
    for (const c of cases) {
      const right = [tileWords(c.item.es), ...(c.item.accept ?? []).map(tileWords)];
      for (const w of orderDistractors(c.item, c.lesson.items)) {
        const built = [...tileWords(c.item.es), w];
        expect({ where: c.where, w, right: right.some((r) => sentenceBuildMatch(built, r)) }).toEqual({ where: c.where, w, right: false });
      }
    }
  });
});

describe('tests carry the same tiles on a rebuild (resume)', () => {
  it('the tiles view of a Small / Big test question is the same when the test is built again', () => {
    for (const lang of LANGS) {
      for (const l of getGrammarTopics(lang)) {
        const lesson = l as unknown as GrammarTopicData;
        const a = buildLessonTest(lesson, { seed: 1, learnedLang: lang, contentLang: 'en', size: 9999 });
        const b = buildLessonTest(lesson, { seed: 1, learnedLang: lang, contentLang: 'en', size: 9999 });
        const tiles = (qs: typeof a) => qs.filter((q) => q.view.card === 'tiles').map((q) => (q.view.card === 'tiles' ? [q.id, q.view.distractors, q.say] : null));
        expect(tiles(a)).toEqual(tiles(b));
        for (const q of a.filter((x) => x.view.card === 'tiles')) {
          const n = q.view.card === 'tiles' ? q.view.distractors?.length : 0;
          expect({ id: q.id, ok: n === 2 || n === 3 }).toEqual({ id: q.id, ok: true });
          expect(q.say).toBeUndefined();
        }
      }
    }
  });

  it('the view built from the item alone (another seed) has the same tiles', () => {
    const c = orderCases()[0];
    const v = (seed: number) => questionOfItem(c.item as unknown as GrammarItem, c.lesson as unknown as GrammarTopicData, c.lang, 'en', seed)?.view;
    expect(v(1)).toEqual(v(99));
  });
});

describe('the drill reads nothing aloud (FB671)', () => {
  const lesson = getGrammarTopics('es').find((l) => (l.items as GrammarItem[]).filter(isOrderItem).length > 2)!;
  const item = (lesson.items as GrammarItem[]).filter(isOrderItem)[0] as OrderItem;

  it('no speak on a tile, on Check or on Next; the unneeded tiles are on the card and a wrong tile is a wrong answer', () => {
    (speak as jest.Mock).mockClear();
    const onDone = jest.fn();
    wrap(<OrderDrillItem item={item} learnedLang="es" contentLang="en" lessonItems={lesson.items} onDone={onDone} />);
    const extra = orderDistractors(item, lesson.items);
    for (const w of extra) expect(screen.getAllByText(w).length).toBeGreaterThan(0);
    for (const w of [...tileWords(item.es), extra[0]]) fireEvent.press(screen.getAllByText(w)[0]);
    fireEvent.press(screen.getByText('Check'));
    fireEvent.press(screen.getByText(/Next/));
    expect(onDone).toHaveBeenCalledWith(false, undefined, expect.any(String));
    expect(speak).not.toHaveBeenCalled();
  });

  it('the right build is still right and silent', () => {
    (speak as jest.Mock).mockClear();
    const onDone = jest.fn();
    wrap(<OrderDrillItem item={item} learnedLang="es" contentLang="en" lessonItems={lesson.items} onDone={onDone} />);
    for (const w of tileWords(item.es)) fireEvent.press(screen.getAllByText(w)[0]);
    fireEvent.press(screen.getByText('Check'));
    fireEvent.press(screen.getByText(/Next/));
    expect(onDone).toHaveBeenCalledWith(true, undefined, expect.any(String));
    expect(speak).not.toHaveBeenCalled();
  });
});
