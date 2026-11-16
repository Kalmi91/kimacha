// FB660: an English-deck card shows its own word class (verb / adjective / noun ...) in every theme, readable before and after reveal.
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import PcicCardView, { type PcicCardViewProps } from '../PcicCardView';
import { SKINS, SKIN_IDS, DEFAULT_SKIN_MIX, contrastRatio } from '@/constants/Skins';
import { ThemeContext } from '@/lib/ThemeContext';
import { themeKeyFor } from '@/lib/skinTheme';
import { setLanguage, t } from '@/lib/i18n';
import type { Pos } from '@/lib/pcicPos';
import type { Sm2Card } from '@/lib/sm2';
import { makeFlush } from '@/test-utils/flush';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/screenFeedback', () => ({ __esModule: true, default: () => null }));
jest.mock('../MistakesEntry', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/LevelPickerSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const current: Sm2Card = { itemId: 'e1', state: 'new', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: '', lastReview: null, introducedAt: null };
const noop = () => {};
const asyncNoop = async () => {};
const props: PcicCardViewProps = {
  loading: false, level: 'B1', newOrder: [], dueRemaining: 0, newRemaining: 1, doneToday: 0, xpToday: 0,
  target: 'en', sourceLang: 'es', dockLift: 0, kbHeight: 0, dockH: 0, languagePair: 'es→en',
  current, currentItem: { id: 'e1', es: 'leer', en: 'read', kind: 'word', section: '', order: 1 },
  allLevelCards: [], allCards: new Map([[current.itemId, current]]), queue: [current], today: '2026-11-16',
  batchBase: { day: '', level: '', n: 0 }, answerText: 'read', promptSource: 'leer',
  grade: null, articlePick: '', typedAnswer: '', cardSeq: 0, inputRef: { current: null },
  setLevelSheetOpen: noop, lastGraded: null, handleUndo: asyncNoop,
  introducedTodayByKind: { words: 0, sentences: 0 }, todayNewBudget: 0,
  askMoreNew: false, handleAskMoreNew: noop, handleDeclineMoreNew: noop, levelSheetOpen: false,
  examRow: [], openPlacement: noop, handleSelectLevel: asyncNoop, strictAccents: false,
  setDockH: noop, sessionAnswered: 0, sessionNew: 0, sessionAgain: 0, handleMoreNew: noop,
  noteOpenFor: null, setNoteOpenFor: noop, setArticlePick: noop, setTypedAnswer: noop,
  handleCheck: asyncNoop, handleGrade: asyncNoop, handleDontLearn: asyncNoop,
  tired: false, showTired: false, handleTired: asyncNoop, parkedCards: [], progressQueue: [current],
  fatigueOffer: null, handleFatigueOfferAccept: asyncNoop, handleFatigueOfferDecline: asyncNoop,
};

const themes = SKIN_IDS.flatMap(skin => SKINS[skin].modes.map(mode => ({ skin, mode })));
beforeEach(() => setLanguage('en'));

it.each(themes)('shows readable English word classes before and after reveal in $skin/$mode', async ({ skin, mode }) => {
  const context = {
    theme: themeKeyFor(skin, mode, 'brand'), skin, override: mode, grammarPalette: 'brand' as const,
    skinMix: DEFAULT_SKIN_MIX, setOverride: noop, setSkin: noop, setGrammarPalette: noop, setSkinMix: noop,
  };
  const content = (pos: Pos, revealed: boolean) => (
    <ThemeContext.Provider value={context}>
      <PcicCardView {...props} currentItem={{ ...props.currentItem!, pos }}
        grade={revealed ? { best: 'read', match: 'exact' } : null} />
    </ThemeContext.Provider>
  );
  const view = render(content('verb', false));
  for (const pos of ['verb', 'adj', 'noun'] as const) {
    for (const revealed of [false, true]) {
      view.rerender(content(pos, revealed));
      await makeFlush(2)();
      const label = view.getByText(t().pos[pos]);
      const ink = StyleSheet.flatten(label.props.style).color;
      const paper = StyleSheet.flatten(view.getByTestId('learn-pos').props.style).backgroundColor;
      expect(contrastRatio(ink, paper)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

it('does not infer an English class from the Spanish prompt or label a sentence as a word', () => {
  const view = render(<PcicCardView {...props} />);
  expect(view.queryByText(t().pos.verb)).toBeNull();
  view.rerender(<PcicCardView {...props} currentItem={{ ...props.currentItem!, kind: 'sentence', pos: 'verb' }} />);
  expect(view.queryByText(t().pos.verb)).toBeNull();
});
