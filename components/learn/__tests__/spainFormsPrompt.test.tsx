import { render } from '@testing-library/react-native';
import PcicCardView, { type PcicCardViewProps } from '../PcicCardView';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';
import type { Lang } from '@/lib/languagePair';
import type { Sm2Card } from '@/lib/sm2';

jest.mock('@/lib/screenFeedback', () => ({ __esModule: true, default: () => null }));
jest.mock('../MistakesEntry', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/LevelPickerSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

async function prompt(es: string, exampleEs: string, sourceLang: Lang = 'es') {
  const current: Sm2Card = { itemId: 'e1', state: 'new', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: '', lastReview: null, introducedAt: null };
  const noop = () => {};
  const asyncNoop = async () => {};
  const props: PcicCardViewProps = {
    loading: false, level: 'B1', newOrder: [], dueRemaining: 0, newRemaining: 1, doneToday: 0, xpToday: 0,
    target: 'en', sourceLang, dockLift: 0, kbHeight: 0, dockH: 0, languagePair: `${sourceLang}→en`,
    current, currentItem: { id: 'e1', es, en: 'flight attendant', exampleEs, kind: 'word', section: '', order: 1 },
    allLevelCards: [], allCards: new Map([[current.itemId, current]]), queue: [current], today: '2026-11-14',
    batchBase: { day: '', level: '', n: 0 }, answerText: 'flight attendant', promptSource: es,
    grade: null, articlePick: '', typedAnswer: '', cardSeq: 0, inputRef: { current: null },
    setLevelSheetOpen: noop, lastGraded: null, handleUndo: asyncNoop,
    introducedTodayByKind: { words: 0, sentences: 0 }, todayNewBudget: 0,
    askMoreNew: false, handleAskMoreNew: noop, handleDeclineMoreNew: noop, levelSheetOpen: false,
    examRow: [], openPlacement: noop, handleSelectLevel: asyncNoop, strictAccents: false,
    setDockH: noop, sessionAnswered: 0, sessionNew: 0, sessionAgain: 0, handleMoreNew: noop,
    noteOpenFor: null, setNoteOpenFor: noop, setArticlePick: noop, setTypedAnswer: noop,
    handleCheck: asyncNoop, handleGrade: asyncNoop, handleDontLearn: asyncNoop,
  };
  const view = render(<ThemeProvider><PcicCardView {...props} /></ThemeProvider>);
  await makeFlush(6)();
  return view;
}

beforeEach(() => setLanguage('en'));

it('labels a Spanish prompt and Spanish question sentence before reveal', async () => {
  const view = await prompt('la azafata', 'Una azafata llegó.');
  expect(view.getByTestId('pcic-prompt-spain')).toHaveTextContent('🇪🇸 Spain: azafata');
  expect(view.getByTestId('pcic-question-sentence-spain')).toHaveTextContent('🇪🇸 Spain: azafata');
  expect(view.queryByTestId('pcic-answer-spain')).toBeNull();
});

it('does not label a Mexican prompt or an identical spelling in another source language', async () => {
  const mexican = await prompt('la aeromoza', 'Una aeromoza llegó.');
  expect(mexican.queryByTestId('pcic-prompt-spain')).toBeNull();
  expect(mexican.queryByTestId('pcic-question-sentence-spain')).toBeNull();
  mexican.unmount();
  const otherLanguage = await prompt('la azafata', 'Una azafata llegó.', 'hu');
  expect(otherLanguage.queryByTestId('pcic-prompt-spain')).toBeNull();
  expect(otherLanguage.queryByTestId('pcic-question-sentence-spain')).toBeNull();
});
