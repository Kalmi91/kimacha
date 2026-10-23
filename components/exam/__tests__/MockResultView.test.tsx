// The result sheet of the longer papers: under a scale rule every skill shows its scale score (the Use of English too,
// where the exam has it) and the average carries the "approximate" label; under the groups rule it stays as before.

import { render } from '@testing-library/react-native';

import { buildMockExam } from '@/lib/exam/mock/build';
import { scoreMockExam } from '@/lib/exam/mock/score';
import type { MockAnswers } from '@/lib/exam/mock/types';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import { fixturePapers } from '@/test-utils/mockExamFixtures';
import { speakingFile } from '@/test-utils/mockSpeakingFixture';
import { MockResultView, MockReviewView } from '../MockResultView';

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

// The speaking paper has tasks (test-utils/mockSpeakingFixture.ts): its band counts, and the review goes turn by turn.
const speakingResult = (answers: MockAnswers) =>
  scoreMockExam(buildMockExam({ target: 'en', level: 'B1', items: [], seed: 0, authored: [...fixturePapers('en', 'B1'), speakingFile('en', 'B1')] }), answers);

const SPOKEN: MockAnswers = {
  'speaking-1': { choice: 'a', t1: 'Last summer I went to the beach with my family', t2: 'Yes I liked it' },
  'speaking-2': { t1: 'Yes I would go there again' },
};

describe('MockResultView: a speaking paper with tasks', () => {
  afterEach(() => setLanguage('en'));

  it('the speaking band counts, one sentence under it says what the scoring measures, and nothing is provisional', () => {
    const view = show(speakingResult(SPOKEN));
    expect(view.getByTestId('mock-band-speaking').props.children).toMatch(/^Speaking: about \d+ on the exam scale \(\d+ \/ 25\)$/);
    expect(view.getByTestId('mock-speaking-note').props.children).toBe('Speaking is scored from the content and length of your answers; pronunciation and fluency are not measured.');
    expect(view.getByTestId('mock-scale').props.children).not.toMatch(/provisional/);
  });

  it('the Spanish interface says the same in Spanish', () => {
    setLanguage('es');
    const view = show(speakingResult(SPOKEN));
    expect(view.getByTestId('mock-speaking-note').props.children).toBe('La expresión oral se puntúa por el contenido y la extensión de tus respuestas; la pronunciación y la fluidez no se miden.');
  });

  it('without a speaking task the band stays "not included" and the sentence is not shown', () => {
    const view = show(resultOf('en', 'B1'));
    expect(view.getByTestId('mock-band-speaking').props.children).toBe('Speaking: not included');
    expect(view.queryByTestId('mock-speaking-note')).toBeNull();
    expect(view.getByTestId('mock-scale').props.children).toMatch(/provisional/);
  });
});

describe('MockReviewView: a speaking task', () => {
  const review = (answers: MockAnswers) => render(<ThemeProvider><MockReviewView result={speakingResult(answers)} onBack={jest.fn()} /></ThemeProvider>);

  it('per turn: the question, what the learner said, the marks with check labels, the word count and the model answer in its own block', () => {
    const view = review(SPOKEN);
    expect(view.getByTestId('mock-review-speaking-1-turn-0-ask').props.children).toBe('Where did you go last summer?');
    expect(view.getByTestId('mock-review-speaking-1-turn-0-answer').props.children.join('')).toBe('Your answer: Last summer I went to the beach with my family');
    expect(view.getByTestId('mock-review-speaking-1-turn-0-point-0').props.children.join('')).toBe('✓ a place');
    expect(view.getByTestId('mock-review-speaking-1-turn-0-words').props.children).toBe('✓ 10 words (at least 8)');
    expect(view.getByTestId('mock-review-speaking-1-turn-0-model')).toBeTruthy();
    expect(view.getByText('Last summer I went to the beach with my family and we had a very good time there')).toBeTruthy();
    expect(view.getByText('Question 2 / 2')).toBeTruthy();
    // the second turn has no content point, only the word count (4 needed, 4 said)
    expect(view.queryByTestId('mock-review-speaking-1-turn-1-point-0')).toBeNull();
    expect(view.getByTestId('mock-review-speaking-1-turn-1-words').props.children).toBe('✓ 4 words (at least 4)');
    // the followed task: the sheet it continued was the holiday one (the choice a)
    expect(view.getByTestId('mock-review-speaking-2-turn-0-ask').props.children).toBe('Would you go there again?');
  });

  it('a missed point shows ✗, no answer shows "no answer", and the model answer is still there to learn from', () => {
    const view = review({});
    expect(view.getByTestId('mock-review-speaking-1-turn-0-answer').props.children.join('')).toBe('Your answer: no answer');
    expect(view.getByTestId('mock-review-speaking-1-turn-0-point-0').props.children.join('')).toBe('✗ a place');
    expect(view.getByTestId('mock-review-speaking-1-turn-0-words').props.children).toBe('✗ 0 words (at least 8)');
    expect(view.getAllByText('Model answer').length).toBe(3);
  });
});
