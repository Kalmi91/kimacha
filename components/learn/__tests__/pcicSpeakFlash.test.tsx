// FB656: every sound button of the revealed answer flashes in the theme colour when tapped (like SpeakButton).
import { Animated, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { speak } from '@/lib/speech';
import type { ThemeKey } from '@/lib/ThemeContext';
import type { Sm2Card } from '@/lib/sm2';
import PcicRevealedAnswer from '@/components/learn/PcicRevealedAnswer';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockTheme: ThemeKey = 'light';
const current: Sm2Card = { itemId: 'o1', state: 'new', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: '', lastReview: null, introducedAt: null };

afterEach(() => jest.restoreAllMocks());

describe.each(['light', 'dark', 'brand-light', 'brand-dark'] as const)('revealed answer sound buttons flash: %s', theme => {
  beforeEach(() => { mockTheme = theme; jest.clearAllMocks(); });

  it('flashes the answer, the alternative and the example independently and keeps their audio', () => {
    let accent = '';
    function Probe() { accent = useGrammarColors().a; return null; }
    const view = render(<>
      <Probe />
      <PcicRevealedAnswer colors={Colors[theme]} s={t()} typedAnswer="" grade={{ best: 'el carro', match: 'wrong' }}
        nextGrade="again" current={current} currentItem={{ id: 'o1', es: 'el carro / el coche', en: 'car', kind: 'word', section: '', order: 1, exampleEs: 'El carro es rojo.', exampleEn: 'The car is red.' }}
        today="2026-11-16" target="es" onGrade={jest.fn()} />
    </>);
    const timing = jest.spyOn(Animated, 'timing');
    for (const [id, text] of [['pcic-correct-speak', 'el carro'], ['pcic-correct-speak-2', 'el coche'], ['pcic-example-speak', 'El carro es rojo.']]) {
      const layer = view.getByTestId(`${id}-flash`);
      expect(StyleSheet.flatten(layer.props.style).backgroundColor).toBe(accent);
      timing.mockClear();
      fireEvent.press(view.getByTestId(id));
      expect(timing).toHaveBeenCalledTimes(1);
      expect((speak as jest.Mock).mock.calls.at(-1)[0]).toBe(text);
    }
  });
});

describe('gloss bubble sound button flashes', () => {
  it('flashes on tap and still speaks the word', () => {
    mockTheme = 'light';
    const GlossText = require('@/components/games/GlossText').default;
    const view = render(<GlossText text="vida" glosses={new Map()} learnedLang="es" forceOpen={{ learned: 'vida', native: 'life', isNew: true }} onForceClose={jest.fn()} />);
    const timing = jest.spyOn(Animated, 'timing');
    const btn = view.getByLabelText(t().a11y.speak);
    expect(view.getByTestId('gloss-speak-flash')).toBeTruthy();
    fireEvent.press(btn);
    expect(timing).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('vida', 'es-MX');
  });
});
