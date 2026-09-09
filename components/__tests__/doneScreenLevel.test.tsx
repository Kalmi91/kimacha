// FB190: mit ajánl a Kész-képernyő, amikor a SZINT szókincse fogyott el, nem
// csak az aktuális témáé.

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { setLanguage } from '@/lib/i18n';
import DoneScreen from '../DoneScreen';

const base = {
  reviewed: 12,
  streak: 3,
  level: 'A1' as const,
  masteredPct: 85,
  direction: ['hu', 'es'] as [string, string],
  onStartExam: jest.fn(),
  examAvailable: true,
};

describe('DoneScreen, level exhausted (FB190)', () => {
  beforeEach(() => {
    setLanguage('hu');
    jest.clearAllMocks();
  });

  it('stays quiet about it while the level still has new words', () => {
    render(<DoneScreen {...base} levelExhausted={false} onPractiseLevel={jest.fn()} onNextLevel={jest.fn()} />);
    expect(screen.queryByText(/minden szót elkezdtél/)).toBeNull();
  });

  it('offers all three ways on once the level runs out', () => {
    const onPractise = jest.fn();
    const onNext = jest.fn();
    render(<DoneScreen {...base} levelExhausted onPractiseLevel={onPractise} onNextLevel={onNext} />);

    expect(screen.getByText(/minden szót elkezdtél/)).toBeTruthy();

    fireEvent.press(screen.getByText('Gyakorlás: 32 szó a szintről'));
    expect(onPractise).toHaveBeenCalled();

    fireEvent.press(screen.getByText('Vizsga'));
    expect(base.onStartExam).toHaveBeenCalled();

    fireEvent.press(screen.getByText('Tovább a következő szintre'));
    expect(onNext).toHaveBeenCalled();
  });

  it('shows the exam as locked instead of hiding it below the pass mark', () => {
    render(<DoneScreen {...base} examAvailable={false} levelExhausted onPractiseLevel={jest.fn()} />);
    expect(screen.getByText('Vizsga (80% készültségtől)')).toBeTruthy();
    fireEvent.press(screen.getByText('Vizsga (80% készültségtől)'));
    expect(base.onStartExam).not.toHaveBeenCalled();
  });

  it('drops the next-level button on the last level', () => {
    render(<DoneScreen {...base} level="C2" levelExhausted onPractiseLevel={jest.fn()} />);
    expect(screen.queryByText('Tovább a következő szintre')).toBeNull();
  });
});
