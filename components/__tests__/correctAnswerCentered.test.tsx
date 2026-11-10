// FB638: the correct answer shown after checking is centered horizontally, per kind of screen.
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';

import AnswerCompare from '../grammar/AnswerCompare';
import ExamSpeakCard from '../exam/ExamSpeakCard';
import PcicRevealedAnswer from '../learn/PcicRevealedAnswer';
import Colors from '@/constants/Colors';
import type { PcicItem } from '@/data/pcic';
import { grammarColorsFor } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flat = (style: unknown) => RN.StyleSheet.flatten(style as RN.StyleProp<RN.TextStyle>);

describe('the correct answer is centered', () => {
  it('word card (PCIC revealed answer)', async () => {
    const item = { id: 'x-1', es: 'casa', en: 'house', kind: 'word', section: 's', order: 1 } as PcicItem;
    const card: Sm2Card = {
      itemId: 'x-1', state: 'learning', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0,
      due: '', lastReview: null, introducedAt: null,
    };
    const view = render(
      <ThemeProvider>
        <PcicRevealedAnswer
          colors={Colors.light}
          s={t()}
          typedAnswer="caza"
          grade={{ match: 'wrong', best: 'casa' } as never}
          nextGrade="again"
          current={card}
          currentItem={item}
          today="2026-10-01"
          target="es"
          onGrade={() => {}}
        />
      </ThemeProvider>,
    );
    await makeFlush(6)();
    expect(flat(view.getByTestId('pcic-correct-answer').props.style).textAlign).toBe('center');
  });

  it('grammar form drill (AnswerCompare)', () => {
    const view = render(<AnswerCompare typed="estas" correct="estás" g={grammarColorsFor('light')} />);
    expect(flat(view.getByTestId('answer-compare-correct').props.style).textAlign).toBe('center');
  });

  it('exam sentence card (wrong dictation)', () => {
    const view = render(
      <ExamSpeakCard prompt="I eat at home." expected="Yo como en casa." mode="translate" targetLang="es" strictAccents={false} onDone={jest.fn()} />,
    );
    fireEvent.changeText(view.getByTestId('exam-speak-input'), 'yo como');
    fireEvent.press(view.getByTestId('exam-check'));
    expect(flat(view.getByTestId('exam-speak-correct').props.style).textAlign).toBe('center');
  });
});
