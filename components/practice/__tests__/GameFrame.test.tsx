// The frame of the Practice tab games: the header row holds the level counter and the progress text. A screen that has neither
// (the Speak tab) gets no header row at all, so its own content starts at the top; the default is the header as before.

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import GameFrame from '@/components/practice/GameFrame';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(12);

const mount = async (props: Partial<React.ComponentProps<typeof GameFrame>> = {}) => {
  const view = render(
    <ThemeProvider>
      <GameFrame testID="frame" target="es" currentCard="test" {...props}>
        <Text>content</Text>
      </GameFrame>
    </ThemeProvider>,
  );
  await flush();
  return view;
};

describe('GameFrame header', () => {
  it('by default: the header row with the level counter, and the progress text next to it', async () => {
    const view = await mount({ progress: { text: '2/5', label: 'Word 2 of 5' } });
    expect(view.getByTestId('game-header')).toBeTruthy();
    expect(view.getByTestId('level-counter')).toBeTruthy();
    expect(view.getByText('2/5')).toBeTruthy();
    view.unmount();
  });

  it('hideLevelCounter without progress: no header row at all, the content and the top slot are there', async () => {
    const view = await mount({ hideLevelCounter: true, top: <Text>top row</Text> });
    expect(view.queryByTestId('game-header')).toBeNull();
    expect(view.queryByTestId('level-counter')).toBeNull();
    expect(view.getByText('top row')).toBeTruthy();
    expect(view.getByText('content')).toBeTruthy();
    view.unmount();
  });

  it('hideLevelCounter with progress: the header row keeps the progress text, without the counter', async () => {
    const view = await mount({ hideLevelCounter: true, progress: { text: '1/3', label: 'Word 1 of 3' } });
    expect(view.getByTestId('game-header')).toBeTruthy();
    expect(view.queryByTestId('level-counter')).toBeNull();
    expect(view.getByText('1/3')).toBeTruthy();
    view.unmount();
  });
});
