// FB190: mit ajánl a Kész-képernyő, amikor a SZINT szókincse fogyott el, nem
// csak az aktuális témáé. UTEMEZO 5. szakasz: a négy szám + a kör végi kérdés.

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { setLanguage } from '@/lib/i18n';
import DoneScreen from '../DoneScreen';

const stats = { reviewsAnswered: 12, wordsStarted: 4, wordsLearned: 2, wrongLaps: 1 };

const base = {
  streak: 3,
  level: 'A1' as const,
  masteredPct: 85,
  direction: ['hu', 'es'] as [string, string],
  onStartExam: jest.fn(),
  examAvailable: true,
  stats,
  ask: 'none' as const,
  dailyDefault: 10,
};

describe('DoneScreen, level exhausted (FB190)', () => {
  beforeEach(() => {
    setLanguage('hu');
    jest.clearAllMocks();
  });

  it('stays quiet about it while the level still has new words', () => {
    render(<DoneScreen {...base} levelExhausted={false} onPractiseLevel={jest.fn()} onNextLevel={jest.fn()} />);
    expect(screen.queryByText('Vizsga')).toBeNull();
  });

  it('offers exam and next level once the level runs out', () => {
    const onNext = jest.fn();
    render(<DoneScreen {...base} levelExhausted onPractiseLevel={jest.fn()} onNextLevel={onNext} />);

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

// UTEMEZO 5. szakasz: a kör végi egyetlen kérdés, a helyzettől függően.
describe('DoneScreen ask question', () => {
  beforeEach(() => {
    setLanguage('hu');
    jest.clearAllMocks();
  });

  it('renders the four numbers', () => {
    render(<DoneScreen {...base} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('more-new: shows askMoreNew and yes calls onMoreNewWords with the typed number', () => {
    const onMore = jest.fn();
    render(<DoneScreen {...base} ask="more-new" onMoreNewWords={onMore} />);
    expect(screen.getByText('Tanulsz még új szót?')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('askNumber'), '7');
    fireEvent.press(screen.getByText('Igen, ennyit'));
    expect(onMore).toHaveBeenCalledWith(7);
  });

  it('practise: shows askPractise and yes calls onPractiseLevel with the typed number', () => {
    const onPractise = jest.fn();
    render(<DoneScreen {...base} ask="practise" onPractiseLevel={onPractise} />);
    expect(screen.getByText('Gyakorolsz még véletlen szavakat a szintből?')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('askNumber'), '20');
    fireEvent.press(screen.getByText('Igen'));
    expect(onPractise).toHaveBeenCalledWith(20);
  });

  it('none: renders neither question', () => {
    render(<DoneScreen {...base} ask="none" />);
    expect(screen.queryByText('Tanulsz még új szót?')).toBeNull();
    expect(screen.queryByText('Gyakorolsz még véletlen szavakat a szintből?')).toBeNull();
  });
});
