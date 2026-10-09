// The feedback button is on every part of the placement test, and the
// card id says which part it is (placement:<part>). Pattern: placement.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string; languagePair: string; level: string }) => (
      <Text testID="fb-card">{`${p.currentCard} | ${p.languagePair} | ${p.level}`}</Text>
    ),
  };
});

// At odd positions grammar, otherwise a word question (as in placement.test.tsx).
jest.mock('@/lib/exam/placementQuestions', () => ({
  ...jest.requireActual('@/lib/exam/placementQuestions'),
  buildPlacementQuestion: (input: { level: string; position: number; used: Set<string> }) =>
    input.position % 2 === 1
      ? { kind: 'gap', level: input.level, topicId: 'presente-regular', itemId: `g${input.used.size}`, sentence: 'Yo ___ español.', options: ['hablo', 'hablas', 'habla'], correctIndex: 0 }
      : { kind: 'word', level: input.level, itemId: `o${100 + input.used.size}`, word: 'la ventana', options: ['the window', 'the door', 'the wall', 'the roof'], correctIndex: 0 },
}));

import { act, fireEvent, render } from '@testing-library/react-native';

import PlacementScreen from '../placement';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Placement test: feedback button on every part', () => {
  it('word question, grammar question, exit, result: all with their own identifier', async () => {
    const s = render(<PlacementScreen />);
    await flush();
    const card = () => s.getByTestId('fb-card').props.children as string;
    const press = async (id: string) => {
      fireEvent.press(s.getByTestId(id));
      await flush();
    };

    expect(card()).toBe('placement:q1:word | en→es | A2');
    await press('placement-option-0');
    expect(card()).toBe('placement:q2:gap | en→es | A2');
    await press('placement-close');
    expect(card()).toBe('placement:leave | en→es | A2');
    await press('placement-keep-going');
    expect(card()).toMatch(/^placement:q2:gap /);
    // Goes through the questions (with correct answers) until the result page appears.
    for (let n = 0; n < 40 && s.queryByTestId('placement-dont-know'); n++) await press('placement-option-0');
    expect(s.getByTestId('placement-result')).toBeTruthy();
    expect(card()).toMatch(/^placement:result \| en→es \| /);
    s.unmount();
  });
});
