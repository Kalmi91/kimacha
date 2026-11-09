// FB617: every typed grammar input opens the keyboard on EVERY new item (useFocusOnNewCard, no bare autoFocus).
import { act, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import fs from 'fs';
import path from 'path';

import { FormDrillItem } from '../grammar/drill/MatchFormItems';
import { TransformDrillItem } from '../grammar/drill/WhyTransformItems';
import { DictationDrillItem, WriteDrillItem } from '../grammar/NewKinds';
import { t } from '@/lib/i18n';
import Colors from '@/constants/Colors';

jest.mock('@/lib/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));

const focusSpy = jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(() => {});
jest.spyOn(TextInput.prototype as unknown as { isFocused: () => boolean }, 'isFocused').mockReturnValue(true); // the retry stops once the field has the focus
beforeEach(() => {
  jest.useFakeTimers();
  focusSpy.mockClear();
});
afterEach(() => jest.useRealTimers());

const run = () => act(() => { jest.advanceTimersByTime(200); });
const colors = Colors.light;

describe('typed grammar inputs focus on each new item', () => {
  it('FormDrillItem', () => {
    const base = { table: undefined, contentLang: 'en' as const, learnedLang: 'es', strictAccents: false, colors, s: t(), onDone: jest.fn() };
    const mk = (id: string) => <FormDrillItem key={id} item={{ id, kind: 'form', verb: 'ser', person: 'yo', answer: 'soy', table: 't' }} {...base} />;
    const { rerender } = render(mk('a'));
    run();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    rerender(mk('b'));
    run();
    expect(focusSpy).toHaveBeenCalledTimes(2);
  });

  it('TransformDrillItem', () => {
    const mk = (id: string) => (
      <TransformDrillItem
        key={id}
        item={{ id, kind: 'transform', prompt: { en: 'x' }, source: 'Yo como.', answer: 'Yo comí.', tense: { from: 'presente', to: 'indefinido' } } as never}
        contentLang="en"
        strictAccents={false}
        colors={colors}
        s={t()}
        onDone={jest.fn()}
      />
    );
    const { rerender } = render(mk('a'));
    run();
    rerender(mk('b'));
    run();
    expect(focusSpy).toHaveBeenCalledTimes(2);
  });

  it('DictationDrillItem and WriteDrillItem', () => {
    const d = (id: string) => (
      <DictationDrillItem key={id} item={{ id, kind: 'dictation', es: 'Hola.', tr: { en: 'x' } } as never} learnedLang="es" contentLang="en" strictAccents={false} onDone={jest.fn()} />
    );
    const w = (id: string) => (
      <WriteDrillItem key={id} item={{ id, kind: 'write', es: 'Hola.', prompt: { en: 'x' }, accept: [], why: { en: 'x' } } as never} learnedLang="es" contentLang="en" strictAccents={false} onDone={jest.fn()} />
    );
    const a = render(d('a'));
    run();
    a.rerender(d('b'));
    run();
    const b = render(w('a'));
    run();
    b.rerender(w('b'));
    run();
    expect(focusSpy).toHaveBeenCalledTimes(4);
  });
});

describe('no bare autoFocus is left on a grammar / practice typed input', () => {
  it.each([
    'app/grammar/deck/[topic].tsx',
    'app/grammar/tense-drill.tsx',
    'components/practice/DictationGame.tsx',
    'components/grammar/drill/MatchFormItems.tsx',
    'components/grammar/drill/WhyTransformItems.tsx',
    'components/grammar/NewKinds.tsx',
  ])('%s', (file) => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
    expect(src).not.toMatch(/^\s*autoFocus\b/m);
    expect(src).toContain('useFocusOnNewCard(');
  });
});
