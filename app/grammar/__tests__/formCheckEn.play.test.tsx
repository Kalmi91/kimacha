jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockTopic = 'past_simple_irregular';
let mockTheme = 'light';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ topic: mockTopic }),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('@/lib/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import {
  formCheckCells, formCheckProgressKey, freshFormCheckState,
} from '@/lib/grammar/formCheck';
import { setLanguage, t } from '@/lib/i18n';
import FormCheckScreen from '../form-check/[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(5);
const topicId = 'past_simple_irregular';
const cells = formCheckCells(lessonFor('en', topicId), 'en');

beforeEach(async () => {
  jest.clearAllMocks();
  setLanguage('en');
  await getDb().setOnboarding('es', 'en');
  await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, formCheckProgressKey(topicId), 'progress', freshFormCheckState(cells));
});

describe('English form check', () => {
  it('loads the first English cell and accepts "went"', async () => {
    const view = render(<FormCheckScreen />);
    await flush();
    expect(screen.getByText('go · past')).toBeTruthy();
    expect(screen.getByTestId('formcheck-progress')).toHaveTextContent('1/25');
    fireEvent.changeText(screen.getByTestId('formcheck-input'), 'went');
    fireEvent.press(screen.getByTestId('formcheck-check'));
    await flush();
    expect(screen.getByTestId('formcheck-result')).toHaveTextContent(`✓ ${t().grammar.correct} · went`);
    view.unmount();
  });
});
