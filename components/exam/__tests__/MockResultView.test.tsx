// The result sheet of the longer papers: under a scale rule every skill shows its scale score (the Use of English too,
// where the exam has it) and the average carries the "approximate" label; under the groups rule it stays as before.

import { render } from '@testing-library/react-native';

import { buildMockExam } from '@/lib/exam/mock/build';
import { scoreMockExam } from '@/lib/exam/mock/score';
import { ThemeProvider } from '@/lib/ThemeContext';
import { fixturePapers } from '@/test-utils/mockExamFixtures';
import { MockResultView } from '../MockResultView';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), speakSequence: jest.fn(), stop: jest.fn(), stopSpeaking: jest.fn() }));

const resultOf = (target: 'es' | 'en', level: 'B1' | 'B2' | 'C1') =>
  scoreMockExam(buildMockExam({ target, level, items: [], seed: 0, authored: fixturePapers(target, level) }), {});

const show = (result: ReturnType<typeof resultOf>) =>
  render(
    <ThemeProvider>
      <MockResultView result={result} timedOut={false} onReview={jest.fn()} onRetry={jest.fn()} onExit={jest.fn()} />
    </ThemeProvider>,
  );

describe('MockResultView: scale rule', () => {
  it('B2: Use of English is its own band; every counted skill has a scale score; the average is labelled approximate', () => {
    const view = show(resultOf('en', 'B2'));
    for (const skill of ['reading', 'use', 'writing', 'listening']) {
      expect(view.getByTestId(`mock-band-${skill}`).props.children).toMatch(/: about \d+ on the exam scale \(\d+ \/ 25\)$/);
    }
    expect(view.getByTestId('mock-band-use').props.children).toMatch(/^Use of English/);
    expect(view.getByTestId('mock-band-speaking').props.children).toMatch(/not included$/);
    expect(view.getByTestId('mock-scale').props.children).toMatch(/about \d+ \(estimate\), needed 160/);
    expect(view.getByTestId('mock-scale-note').props.children).toMatch(/^Approximate/);
    expect(view.queryByTestId('mock-group-1')).toBeNull();
  });
});

describe('MockResultView: groups rule', () => {
  it('es B2: the groups as before, no scale line, no Use of English band', () => {
    const view = show(resultOf('es', 'B2'));
    expect(view.getByTestId('mock-group-1')).toBeTruthy();
    expect(view.getByTestId('mock-group-2')).toBeTruthy();
    expect(view.queryByTestId('mock-scale')).toBeNull();
    expect(view.queryByTestId('mock-band-use')).toBeNull();
    expect(view.getByTestId('mock-band-reading').props.children).toMatch(/: \d+ \/ 25$/);
  });
});
