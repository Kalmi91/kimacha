// The mode chips on top of the Practice tab (components/practice/ModeChips.tsx): the row opens with the active chip in view.

import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import ModeChips from '@/components/practice/ModeChips';
import { ThemeProvider } from '@/lib/ThemeContext';

// the jest ScrollView keeps its methods on the class: one jest.fn for every row
const scrollTo = ScrollView.prototype.scrollTo as unknown as jest.Mock;

const CHIPS = ['reading', 'dictation', 'scramble', 'match', 'opposites', 'situations'].map((id) => ({ id, title: id }));
const layout = (x: number, width = 110) => ({ nativeEvent: { layout: { x, y: 0, width, height: 44 } } });

beforeEach(() => scrollTo.mockClear());

describe('<ModeChips />', () => {
  it('scrolls the active chip into view once, when it is laid out (a padding of 24 stays on its left)', () => {
    const view = render(<ThemeProvider><ModeChips chips={CHIPS} activeId="situations" onSelect={() => {}} /></ThemeProvider>);
    // the other chips being laid out change nothing
    fireEvent(view.getByTestId('practice-mode-reading'), 'layout', layout(24));
    fireEvent(view.getByTestId('practice-mode-match'), 'layout', layout(480));
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent(view.getByTestId('practice-mode-situations'), 'layout', layout(640));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 616, animated: false });
    // a later layout of it (a font change, a rotation) does not pull the row back
    fireEvent(view.getByTestId('practice-mode-situations'), 'layout', layout(640, 130));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('the first chip active: the row stays at the start; choosing another chip later does not scroll', () => {
    const picked: string[] = [];
    const view = render(<ThemeProvider><ModeChips chips={CHIPS} activeId="reading" onSelect={(id) => picked.push(id)} /></ThemeProvider>);
    fireEvent(view.getByTestId('practice-mode-reading'), 'layout', layout(24));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, animated: false });
    scrollTo.mockClear();
    fireEvent.press(view.getByTestId('practice-mode-match'));
    expect(picked).toEqual(['match']);
    view.rerender(<ThemeProvider><ModeChips chips={CHIPS} activeId="match" onSelect={(id) => picked.push(id)} /></ThemeProvider>);
    fireEvent(view.getByTestId('practice-mode-match'), 'layout', layout(480));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(view.getByTestId('practice-mode-match').props.accessibilityState.selected).toBe(true);
    view.unmount();
  });
});
