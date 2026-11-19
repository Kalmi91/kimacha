// E201 / FB684: on the inflection (form) and transform drills, too, a wrong answer's "I mistyped" sits on the docked bar
// above Next (visible without scrolling), and not a second time in the card.

import { View } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { TransformDrillItem } from '../grammar/drill/WhyTransformItems';
import { FormDrillItem } from '../grammar/drill/MatchFormItems';
import type { FormItem, TransformItem } from '@/lib/grammar/lessonTypes';
import { t } from '@/lib/i18n';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

function Host({ children }: { children: React.ReactNode }) {
  const dock = useDockSlot(Colors.light);
  return (
    <View style={{ flex: 1 }}>
      <DockSlotProvider host={dock}>{children}</DockSlotProvider>
      {dock.node}
    </View>
  );
}

const L = (en: string) => ({ en, es: en, hu: en, de: en });
const TRANSFORM: TransformItem = {
  kind: 'transform',
  id: 'tr1',
  tense: { from: 'presente', to: 'indefinido' },
  prompt: L('Como pan.'),
  answer: 'Comí pan.',
  wordIds: [],
  why: L('past'),
};
const FORM: FormItem = { kind: 'form', id: 'fo1', verb: 'hablar', person: 'yo', answer: 'hablo', table: 't' } as FormItem;

describe('drill: "I mistyped" on the docked bar', () => {
  it('form: after a wrong answer it is on the bar only, and counts the answer as right', async () => {
    const onDone = jest.fn();
    render(<Host><FormDrillItem item={FORM} table={undefined} contentLang="en" learnedLang="es" colors={Colors.light} s={t()} onDone={onDone} /></Host>);
    fireEvent.changeText(screen.getByTestId('formInput'), 'hablao');
    fireEvent.press(screen.getByTestId('formCheck'));
    await act(async () => {});
    expect(within(screen.getByTestId('learn-dock')).getByTestId('grammar-mistyped')).toBeTruthy();
    expect(screen.getAllByTestId('grammar-mistyped')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('form: a right answer has no "I mistyped" on the bar', async () => {
    render(<Host><FormDrillItem item={FORM} table={undefined} contentLang="en" learnedLang="es" colors={Colors.light} s={t()} onDone={jest.fn()} /></Host>);
    fireEvent.changeText(screen.getByTestId('formInput'), 'hablo');
    fireEvent.press(screen.getByTestId('formCheck'));
    await act(async () => {});
    expect(screen.queryByTestId('grammar-mistyped')).toBeNull();
  });

  it('transform: after a wrong answer it is on the bar only, and counts the answer as right', async () => {
    const onDone = jest.fn();
    render(<Host><TransformDrillItem item={TRANSFORM} contentLang="en" strictAccents colors={Colors.light} s={t()} onDone={onDone} /></Host>);
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comi pann');
    fireEvent.press(screen.getByTestId('transform-check'));
    await act(async () => {});
    expect(within(screen.getByTestId('learn-dock')).getByTestId('grammar-mistyped')).toBeTruthy();
    expect(screen.getAllByTestId('grammar-mistyped')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    expect(onDone).toHaveBeenCalledWith(true);
  });
});
