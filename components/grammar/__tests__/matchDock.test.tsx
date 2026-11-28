// Q1 / Q2 / Q3 / Q7 / Q11 (2026-11-27): the drill's Check / Next goes through the dock (tone check before the answer,
// tone next after it, the default Next label), a solved matching pair is drawn with the success colour, and the form
// item's Check is gone while its table is open.

import { StyleSheet, View } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { defaultActionLabel } from '@/components/learn/DockedAction';
import GrammarDrill from '../GrammarDrill';
import { FormDrillItem, MatchDrillItem } from '../drill/MatchFormItems';
import { TransformDrillItem, WhyDrillItem } from '../drill/WhyTransformItems';
import { grammarColorsFor } from '@/lib/grammarColors';
import type { FormItem, MatchItem, TransformItem, WhyItem, LessonBlock } from '@/lib/grammar/lessonTypes';
import type { GrammarTopicData } from '@/lib/games/content';
import { t } from '@/lib/i18n';

let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

function Host({ children }: { children: React.ReactNode }) {
  const dock = useDockSlot(Colors.light);
  return (
    <View style={{ flex: 1 }}>
      <DockSlotProvider host={dock}>
        <View testID="item-root">{children}</View>
      </DockSlotProvider>
      {dock.node}
    </View>
  );
}

const L = (en: string) => ({ en, es: en, hu: en, de: en });
const s = t();
const MATCH: MatchItem = {
  kind: 'match',
  id: 'm1',
  pairs: [
    { es: 'soy', en: 'I am' },
    { es: 'somos', en: 'we are' },
  ],
};
const FORM: FormItem = { kind: 'form', id: 'fo1', verb: 'hablar', person: 'yo', answer: 'hablo', table: 't' } as FormItem;
const TABLE: Extract<LessonBlock, { kind: 'table' }> = {
  kind: 'table',
  id: 't',
  title: L('hablar'),
  header: [L('Person'), L('hablar')],
  rows: [['yo', 'hablo']],
};
const TRANSFORM: TransformItem = {
  kind: 'transform',
  id: 'tr1',
  tense: { from: 'presente', to: 'indefinido' },
  prompt: L('Como pan.'),
  answer: 'Comí pan.',
  wordIds: [],
  why: L('past'),
};
const WHY: WhyItem = {
  kind: 'why',
  id: 'w1',
  es: 'Soy profesor.',
  tr: L('I am a teacher.'),
  options: [{ text: L('profession') }, { text: L('location'), wrong: L('x') }, { text: L('state'), wrong: L('y') }],
  correctIndex: 0,
};
const CHOICE_TOPIC = {
  schema: 2,
  topic: 'test-dock-choice',
  level: 'A2',
  title: L('t'),
  body: [],
  speak: L('s'),
  items: [
    {
      id: 'g1',
      sentence: 'De niño, mi abuela siempre ___ pan los domingos.',
      options: ['hacía', 'hizo', 'hará'],
      correct: 0,
      why: L('why'),
      wrong: { hizo: L('x'), hará: L('x') },
      examples: ['Siempre me contaba historias.'],
    },
  ],
} as unknown as GrammarTopicData;

const NEXT = defaultActionLabel('next');
const CHECK_PREFIX = '✓';
const dock = () => screen.queryByTestId('learn-dock');
const matchItem = (lang = 'es') => (
  <Host>
    <MatchDrillItem item={MATCH} learnedLang={lang} colors={Colors.light} s={s} onDone={jest.fn()} />
  </Host>
);
const solve = () => {
  fireEvent.press(screen.getByTestId('match-left-0'));
  fireEvent.press(screen.getByText('soy'));
  fireEvent.press(screen.getByTestId('match-left-1'));
  fireEvent.press(screen.getByText('somos'));
};
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style) ?? {};

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
])('%s skin', (_name, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('T1 matching task solved: Next only on the dock, default label, none in the item', () => {
    render(matchItem());
    expect(dock()).toBeNull();
    solve();
    expect(within(screen.getByTestId('item-root')).queryByTestId('grammar-next')).toBeNull();
    expect(screen.getAllByTestId('grammar-next')).toHaveLength(1);
    expect(within(screen.getByTestId('learn-dock')).getByTestId('grammar-next')).toBeTruthy();
    expect(within(screen.getByTestId('learn-dock')).queryByText(NEXT)).toBeTruthy();
  });

  it('T2 matching task: solved pair is success, a selected unsolved tile is the accent', () => {
    const g = grammarColorsFor(theme as 'light');
    const success = g.extra?.success ?? Colors.light.success;
    render(matchItem());
    fireEvent.press(screen.getByTestId('match-left-0'));
    if (g.brutal) expect(flat('match-left-0').backgroundColor).toBe(g.b);
    else expect(flat('match-left-0').borderColor).toBe(Colors.light.tint);
    solve();
    if (g.brutal) expect(flat('match-left-0').backgroundColor).toBe(success);
    else expect(flat('match-left-0').borderColor).toBe(success);
  });

  it('T3 form item with a table: no Check while the table is open, Check back with the typed text', () => {
    render(
      <Host>
        <FormDrillItem item={FORM} table={TABLE} contentLang="en" learnedLang="es" colors={Colors.light} s={s} onDone={jest.fn()} />
      </Host>
    );
    fireEvent.changeText(screen.getByTestId('formInput'), 'habl');
    expect(within(screen.getByTestId('learn-dock')).getByTestId('formCheck')).toBeTruthy();
    fireEvent.press(screen.getByText(`▸ ${s.grammar.showTable}`));
    expect(dock()).toBeNull();
    expect(screen.queryByTestId('formCheck')).toBeNull();
    fireEvent.press(screen.getByText(`▾ ${s.grammar.showTable}`));
    expect(within(screen.getByTestId('learn-dock')).getByTestId('formCheck')).toBeTruthy();
    expect(screen.getByTestId('formInput').props.value).toBe('habl');
  });

  it('T4 form: Check before the answer, default Next after it', async () => {
    render(
      <Host>
        <FormDrillItem item={FORM} table={undefined} contentLang="en" learnedLang="es" colors={Colors.light} s={s} onDone={jest.fn()} />
      </Host>
    );
    expect(within(screen.getByTestId('learn-dock')).queryByText(new RegExp(`^${CHECK_PREFIX}`))).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('formInput'), 'hablo');
    fireEvent.press(screen.getByTestId('formCheck'));
    await act(async () => {});
    expect(within(screen.getByTestId('learn-dock')).queryByText(NEXT)).toBeTruthy();
  });

  it('T4 transform: Check before the answer, default Next after it', async () => {
    render(
      <Host>
        <TransformDrillItem item={TRANSFORM} contentLang="en" strictAccents colors={Colors.light} s={s} onDone={jest.fn()} />
      </Host>
    );
    expect(within(screen.getByTestId('learn-dock')).queryByText(new RegExp(`^${CHECK_PREFIX}`))).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comí pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    await act(async () => {});
    expect(within(screen.getByTestId('learn-dock')).queryByText(NEXT)).toBeTruthy();
  });

  it('T4 why item: Next only on the dock after the answer, default label', () => {
    render(
      <Host>
        <WhyDrillItem item={WHY} learnedLang="es" contentLang="en" colors={Colors.light} s={s} onDone={jest.fn()} />
      </Host>
    );
    expect(dock()).toBeNull();
    fireEvent.press(screen.getByText('profession'));
    expect(within(screen.getByTestId('item-root')).queryByTestId('grammar-next')).toBeNull();
    expect(within(screen.getByTestId('learn-dock')).queryByText(NEXT)).toBeTruthy();
  });

  it('T4 choice item (GrammarDrill): Next only on the dock after the answer, default label', async () => {
    const view = render(
      <Host>
        <GrammarDrill topic={CHOICE_TOPIC} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} />
      </Host>
    );
    await act(async () => {});
    expect(dock()).toBeNull();
    fireEvent.press(screen.getAllByTestId('grammar-option')[0]);
    expect(within(screen.getByTestId('item-root')).queryByTestId('grammar-next')).toBeNull();
    expect(within(screen.getByTestId('learn-dock')).queryByText(NEXT)).toBeTruthy();
    view.unmount();
  });
});
