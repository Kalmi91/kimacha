import { View } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import ExamSpeakCard from '@/components/exam/ExamSpeakCard';
import ExamTypeCard from '@/components/exam/ExamTypeCard';
import { DictationDrillItem } from '@/components/grammar/NewKinds';
import { DockSlotProvider, useDockSlot } from '../DockSlot';

jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

// the Check / Next button of the typed cards (exam, lesson test) is a bar docked above the keyboard
// (DockSlot), like on the word card; without a host (standalone render) the old inline button stays.

function Host({ children }: { children: React.ReactNode }) {
  const dock = useDockSlot(Colors.light);
  return (
    <View style={{ flex: 1 }}>
      <DockSlotProvider host={dock}>{children}</DockSlotProvider>
      {dock.node}
    </View>
  );
}

const typeCard = (onDone = jest.fn()) => (
  <ExamTypeCard prompt="to be" answer="ser" sentence={false} targetLang="es" strictAccents={false} onDone={onDone} />
);

describe('DockSlot: vizsga beírós kártya', () => {
  it('host alatt a Check a dokkolt sávon van (nincs inline), üresen letiltott, a "nem tudom" a kártyában marad', () => {
    render(<Host>{typeCard()}</Host>);
    expect(within(screen.getByTestId('learn-dock')).getByTestId('exam-check')).toBeTruthy();
    expect(screen.getAllByTestId('exam-check')).toHaveLength(1);
    expect(screen.getByTestId('exam-check').props.accessibilityState?.disabled ?? screen.getByTestId('exam-check').props.disabled).toBeTruthy();
    expect(within(screen.getByTestId('learn-dock')).queryByTestId('exam-dont-know')).toBeNull();
    expect(screen.getByTestId('exam-dont-know')).toBeTruthy();
  });

  it('helyes válasz: a sáv Checkje továbbadja a választ; hibás válasz után ugyanott a Next', async () => {
    const onDone = jest.fn();
    render(<Host>{typeCard(onDone)}</Host>);

    fireEvent.changeText(screen.getByTestId('exam-input'), 'xxx');
    fireEvent.press(screen.getByTestId('exam-check'));
    await act(async () => {});

    expect(screen.queryByTestId('exam-check')).toBeNull();
    expect(within(screen.getByTestId('learn-dock')).getByTestId('exam-next')).toBeTruthy();
    expect(screen.getAllByTestId('exam-next')).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('a sáv gombja mindig a legfrissebb beírt szöveggel értékel', () => {
    const onDone = jest.fn();
    render(<Host>{typeCard(onDone)}</Host>);
    fireEvent.changeText(screen.getByTestId('exam-input'), 'se');
    fireEvent.changeText(screen.getByTestId('exam-input'), 'ser');
    fireEvent.press(screen.getByTestId('exam-check'));
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('host nélkül a régi inline Check marad (nincs dokkolt sáv)', () => {
    render(typeCard());
    expect(screen.queryByTestId('learn-dock')).toBeNull();
    expect(screen.getByTestId('exam-check')).toBeTruthy();
  });
});

describe('DockSlot: szóbeli (diktálós) vizsga-kártya', () => {
  it('a Check a dokkolt sávon van, hibás diktálás után ugyanott a Next', async () => {
    render(
      <Host>
        <ExamSpeakCard prompt="Yo soy" expected="Yo soy" mode="repeat" targetLang="es" strictAccents={false} onDone={jest.fn()} />
      </Host>,
    );
    expect(within(screen.getByTestId('learn-dock')).getByTestId('exam-check')).toBeTruthy();
    expect(screen.getAllByTestId('exam-check')).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId('exam-speak-input'), 'tú eres');
    fireEvent.press(screen.getByTestId('exam-check'));
    await act(async () => {});

    expect(within(screen.getByTestId('learn-dock')).getByTestId('exam-next')).toBeTruthy();
    expect(screen.getAllByTestId('exam-next')).toHaveLength(1);
  });
});

describe('DockSlot: diktálás a nyelvtani drillben', () => {
  it('a Check a dokkolt sávon van (nincs inline), a Check után ugyanott a Next', async () => {
    const onDone = jest.fn();
    render(
      <Host>
        <DictationDrillItem
          item={{ kind: 'dictation', id: 'dic-1', es: 'Yo soy Ana', tr: { hu: 'Ana vagyok', en: 'I am Ana', es: 'Yo soy Ana', de: 'Ich bin Ana' } }}
          learnedLang="es"
          contentLang="en"
          strictAccents={false}
          onDone={onDone}
        />
      </Host>,
    );
    expect(within(screen.getByTestId('learn-dock')).getByTestId('dictation-check')).toBeTruthy();
    expect(screen.getAllByTestId('dictation-check')).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId('dictation-input'), 'Yo soy Ana');
    fireEvent.press(screen.getByTestId('dictation-check'));
    await act(async () => {});

    expect(screen.queryByTestId('dictation-check')).toBeNull();
    expect(within(screen.getByTestId('learn-dock')).getByTestId('grammar-next')).toBeTruthy();
    expect(screen.getAllByTestId('grammar-next')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onDone).toHaveBeenCalledWith(true);
  });
});
