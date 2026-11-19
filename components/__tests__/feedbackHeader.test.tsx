// Where the 💬 button sits (FeedbackModal `placement`): 'header' puts it into the tab navigator's header (headerRight)
// with the screen's own context (level, language pair, card), so it never floats over a row or a toggle; with no
// navigator around (jest renders the screens bare) it sits in the screen's top right corner; 'inline' is a header-sized
// button in the normal layout flow (the Learn tab and the neo-brutalist Course tab draw their own top row); the default
// is that same button in the top right corner (E206: one standard, the Learn card's size, never floating or at the bottom).
// Pinned: every placement is the level chip's size (HEADER_CHIP), the corner one sits inside the top safe area.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { HEADER_CHIP } from '@/components/learn/pcicStyles';
import type { ReactNode } from 'react';

import { FeedbackHeaderProvider } from '@/lib/feedbackHeader';
import FeedbackButton from '../FeedbackModal';

jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

// The navigator of the tabs layout, as the provider sees it.
const mockSetOptions = jest.fn();
const navigation = { setOptions: mockSetOptions };
const inTabs = (node: ReactNode) => <FeedbackHeaderProvider navigation={navigation}>{node}</FeedbackHeaderProvider>;

type HeaderOptions = { headerRight?: () => ReactNode };
const lastHeaderRight = () => {
  const calls = mockSetOptions.mock.calls.filter(([o]: [HeaderOptions]) => typeof o.headerRight === 'function');
  return (calls[calls.length - 1][0] as HeaderOptions).headerRight!;
};
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

// What the header would render: the control itself, mounted on its own.
const mountHeader = () => render(<>{lastHeaderRight()()}</>);

describe('FeedbackButton placement', () => {
  beforeEach(() => {
    mockSetOptions.mockClear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as never);
  });
  afterEach(() => {
    // @ts-expect-error test-only cleanup of a global we set per test
    delete global.fetch;
  });

  it('header: nothing is drawn in the screen, the button goes into the navigator header, header-sized and in the flow', () => {
    const screen = render(inTabs(<FeedbackButton placement="header" level="-" languagePair="en-es" currentCard="sentences:o724" />));
    expect(screen.queryByLabelText('Feedback')).toBeNull();
    expect(mockSetOptions).toHaveBeenCalledTimes(1);

    const header = mountHeader();
    const fab = styleOf(header.getByLabelText('Feedback'));
    expect(fab.position).not.toBe('absolute');
    expect(fab.width).toBe(HEADER_CHIP.width);
    expect(fab.height).toBe(HEADER_CHIP.height);
    // clear of the screen edge (the native header has no padding of its own at its right end)
    expect(styleOf(header.getByTestId('feedback-header-end')).marginRight).toBe(16);
  });

  it('header: the same modal and the screen context travel with it (language pair, card)', async () => {
    render(inTabs(<FeedbackButton placement="header" level="A2" languagePair="en-es" currentCard="sentences:o724" />));
    const header = mountHeader();
    fireEvent.press(header.getByText('💬'));
    fireEvent.changeText(header.getByPlaceholderText('Share your thoughts...'), 'Nice');
    await act(async () => {
      fireEvent.press(header.getByText('Send'));
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.currentCard).toMatch(/ · sentences:o724$/);
    expect(body.languagePair).toBe('en-es');
    expect(body.level).toBe('A2');
  });

  it('header: the context follows the screen (a new card sets the header again) and leaving the screen clears it', async () => {
    const screen = render(inTabs(<FeedbackButton placement="header" level="-" languagePair="en-es" currentCard="practice:q1" />));
    screen.rerender(inTabs(<FeedbackButton placement="header" level="-" languagePair="en-es" currentCard="practice:q2" />));

    const header = mountHeader();
    fireEvent.press(header.getByText('💬'));
    fireEvent.changeText(header.getByPlaceholderText('Share your thoughts...'), 'Nice');
    await act(async () => {
      fireEvent.press(header.getByText('Send'));
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string).currentCard).toMatch(/ · practice:q2$/);

    mockSetOptions.mockClear();
    screen.unmount();
    expect(mockSetOptions).toHaveBeenCalledWith({ headerRight: undefined });
  });

  it('header, no navigator around: the button sits in the top right corner of the screen, header-sized', () => {
    const screen = render(<FeedbackButton placement="header" level="-" languagePair="en-es" currentCard="stats-tab" />);
    const fab = styleOf(screen.getByLabelText('Feedback'));
    expect(fab).toMatchObject({ position: 'absolute', top: 8, right: 8, width: HEADER_CHIP.width, height: HEADER_CHIP.height });
    expect(fab.bottom).toBeUndefined();
    expect(mockSetOptions).not.toHaveBeenCalled();
  });

  it('inline: a header-sized button in the layout flow (the screen draws its own top row)', () => {
    const screen = render(<FeedbackButton placement="inline" level="A1" languagePair="en-es" currentCard="pcic" />);
    const fab = styleOf(screen.getByLabelText('Feedback'));
    expect(fab.position).not.toBe('absolute');
    expect(fab).toMatchObject({ width: HEADER_CHIP.width, height: HEADER_CHIP.height });
    expect(mockSetOptions).not.toHaveBeenCalled();
  });

  it('default: the standard, the top right corner, the Learn card button size (no floating button at the bottom)', () => {
    const screen = render(<FeedbackButton level="A1" languagePair="en-es" currentCard="exam:A1:1" />);
    expect(styleOf(screen.getByLabelText('Feedback'))).toMatchObject({ position: 'absolute', top: 8, right: 8, width: HEADER_CHIP.width, height: HEADER_CHIP.height });
  });
});
