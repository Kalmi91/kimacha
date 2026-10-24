// The screens that only differ by palette: on the brutalist ("brand") palette the BrutalBox pieces
// are there, on the classic palette today's look stays. One table row = one old case; a row renders
// the screen on one palette, checks the testIDs (and styles) per step, and presses between the steps.
// Rows that write to the DB (grammar level, mistake batch) come last, so the rows before them run on
// the default state, as they did in their own files. Mock pattern: settingsPalette.test.tsx,
// onboarding.test.tsx, credits.test.tsx, tableDeck.play.test.tsx, lessonV2.play.test.tsx, FeedbackModal.test.tsx.

jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => {
  const React = require('react');
  // The tab bar test renders only the bar's own buttons (tabBarButton, one icon each; app/(tabs)/_layout.tsx).
  const Tabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      React.Fragment,
      null,
      React.Children.map(children, (c: React.ReactElement<any>) =>
        c.props.options.tabBarButton
          ? c.props.options.tabBarButton({ children: null, 'aria-selected': c.props.name === 'index' })
          : null
      )
    );
  Tabs.Screen = function Screen() {
    return null;
  };
  return {
    Tabs,
    Stack: { Screen: () => null },
    Link: ({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) =>
      asChild ? children : React.createElement(React.Fragment, null, children),
    router: { replace: jest.fn(), push: jest.fn() },
    useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    usePathname: () => '/grammar',
    useLocalSearchParams: () => ({ topic: 'ser-estar' }),
    useFocusEffect: (cb: () => void) => {
      const { useEffect } = require('react');
      useEffect(cb, []);
    },
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import FeedbackButton from '@/components/FeedbackModal';
import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import { ThemeProvider } from '@/lib/ThemeContext';
import TabLayout from '@/app/(tabs)/_layout';
import SettingsScreen from '@/app/(tabs)/settings';
import StatsScreen from '@/app/(tabs)/stats';
import NotFoundScreen from '@/app/+not-found';
import CreditsScreen from '@/app/credits';
import GrammarLessonScreen from '@/app/grammar/[topic]';
import TableDeckScreen from '@/app/grammar/deck/[topic]';
import MistakesReportScreen from '@/app/mistakes/index';
import OnboardingScreen from '@/app/onboarding';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

type Step = {
  has?: string[]; // testID present, exactly one
  any?: string[]; // testID present, one or more
  lacks?: string[]; // testID absent
  text?: string[]; // text present
  style?: Record<string, object>; // the flattened style of the testID matches
  press?: string; // press this testID after the checks
  pressText?: string; // press this text after the checks
};

type Row = {
  name: string;
  palette: 'brand' | 'classic';
  ui: React.ReactElement;
  setup?: () => Promise<void>;
  steps: Step[];
};

const grammarState = async () => {
  const db = getDb();
  await db.setOnboarding('en', 'es');
  (db as any).__setLevelForTest('A1');
};

const mistakeBatch = async () => {
  const result = validateMistakesPayload(sample);
  if (!result.ok) throw new Error(result.error);
  await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');
};

const feedback = <FeedbackButton level="B1" languagePair="es-en" currentCard="pcic" />;

const ROWS: Row[] = [
  { name: 'Settings, brand palette: the rows are BrutalBox boxes', palette: 'brand', ui: <SettingsScreen />, steps: [{ any: ['settings-row'] }] },
  {
    // the palette chips moved to the Themes screen; Settings has the Themes row.
    name: 'Settings, classic palette: the current look stays: no BrutalBox row, the settings are present',
    palette: 'classic',
    ui: <SettingsScreen />,
    steps: [{ lacks: ['settings-row'], has: ['settings-theme-row'] }],
  },
  { name: 'Stats, brand palette: the weekly-goal segmented bar appears', palette: 'brand', ui: <StatsScreen />, steps: [{ has: ['stats-goal-bar'] }] },
  { name: 'Stats, classic palette: the current look stays: no segmented bar', palette: 'classic', ui: <StatsScreen />, steps: [{ lacks: ['stats-goal-bar'] }] },
  { name: 'Tab bar, brand palette: the active icon sits in a box', palette: 'brand', ui: <TabLayout />, steps: [{ has: ['tab-icon-active'] }] },
  { name: 'Tab bar, classic palette: the current icon: no box', palette: 'classic', ui: <TabLayout />, steps: [{ lacks: ['tab-icon-active'] }] },
  { name: 'Not-found, brand palette: BrutalButton', palette: 'brand', ui: <NotFoundScreen />, steps: [{ has: ['not-found-home'] }] },
  { name: 'Not-found, classic palette: the current link', palette: 'classic', ui: <NotFoundScreen />, steps: [{ lacks: ['not-found-home'] }] },
  { name: 'Credits, brand palette: a BrutalBox card', palette: 'brand', ui: <CreditsScreen />, steps: [{ has: ['credits-card'] }] },
  { name: 'Credits, classic palette: no card', palette: 'classic', ui: <CreditsScreen />, steps: [{ lacks: ['credits-card'] }] },
  { name: 'Credits, brand palette: the back arrow is a BrutalBox', palette: 'brand', ui: <CreditsScreen />, steps: [{ has: ['credits-back'] }] },
  { name: 'Credits, classic palette: the back arrow is not', palette: 'classic', ui: <CreditsScreen />, steps: [{ lacks: ['credits-back'] }] },
  {
    name: 'Feedback FAB, brand palette: a square BrutalBox FAB, the modal is a box too',
    palette: 'brand',
    ui: feedback,
    steps: [{ has: ['feedback-fab'], pressText: '💬' }, { has: ['feedback-modal'] }],
  },
  {
    name: 'Feedback FAB, classic palette: the current round button: no BrutalBox',
    palette: 'classic',
    ui: feedback,
    steps: [{ lacks: ['feedback-fab'], pressText: '💬' }, { lacks: ['feedback-modal'], text: ['Feedback'] }],
  },
  {
    name: 'Onboarding, brand palette: the language and start buttons are BrutalBox, the steps work',
    palette: 'brand',
    ui: <OnboardingScreen />,
    steps: [
      { has: ['onboarding-lang-es', 'onboarding-lang-hu'], press: 'onboarding-lang-en' },
      { has: ['onboarding-target-es', 'onboarding-target-hu'], press: 'onboarding-target-es' },
      { has: ['onboarding-start'], press: 'onboarding-start' },
      // intro + theme step before the level.
      { press: 'onboarding-intro-start' },
      { press: 'onboarding-theme-next' },
      { text: ['Choose level'] },
    ],
  },
  {
    name: 'Onboarding, classic palette: the current look stays: no BrutalBox button',
    palette: 'classic',
    ui: <OnboardingScreen />,
    steps: [{ lacks: ['onboarding-lang-en'], text: ['English'] }],
  },
  // From here on the rows write to the DB.
  {
    name: 'Mistakes report, brand palette: the batch is a BrutalBox card',
    palette: 'brand',
    ui: <MistakesReportScreen />,
    setup: mistakeBatch,
    steps: [{ has: ['mistakes-batch', 'mistakes-practice-btn'] }],
  },
  {
    name: 'Mistakes report, classic palette: the current look stays: no BrutalBox card',
    palette: 'classic',
    ui: <MistakesReportScreen />,
    setup: mistakeBatch,
    steps: [{ lacks: ['mistakes-batch'], has: ['mistakes-practice-btn'] }],
  },
  {
    name: 'Table drill, brand palette: back box + SegmentBar',
    palette: 'brand',
    ui: <TableDeckScreen />,
    setup: grammarState,
    steps: [{ has: ['tabledeck-back', 'tabledeck-segments'] }],
  },
  {
    name: 'Table drill, classic palette: the current header: no box, no SegmentBar',
    palette: 'classic',
    ui: <TableDeckScreen />,
    setup: grammarState,
    steps: [{ lacks: ['tabledeck-back', 'tabledeck-segments'] }],
  },
  {
    name: 'Lesson page, brand palette: the back box, the filled start button and the table are present, the button uses the a color',
    palette: 'brand',
    ui: <GrammarLessonScreen />,
    setup: grammarState,
    steps: [{ has: ['grammar-back', 'table-ser-presente'], style: { 'grammar-start-choice': { backgroundColor: PALETTE_FILLS.brand.a } } }],
  },
  {
    name: 'Lesson page, classic palette: the current page shows (no back box)',
    palette: 'classic',
    ui: <GrammarLessonScreen />,
    setup: grammarState,
    steps: [{ lacks: ['grammar-back'], style: { 'grammar-start-choice': { borderRadius: 26 } }, press: 'grammar-start-choice' }],
  },
];

describe('Palette screens, neo-brutalist', () => {
  it.each(ROWS)('$name', async ({ palette, ui, setup, steps }) => {
    await setup?.();
    await getDb().setGrammarPalette(palette);
    const view = render(<ThemeProvider>{ui}</ThemeProvider>);
    await flush();
    for (const s of steps) {
      s.has?.forEach((id) => expect(view.queryByTestId(id)).toBeTruthy());
      s.any?.forEach((id) => expect(view.queryAllByTestId(id).length).toBeGreaterThan(0));
      s.lacks?.forEach((id) => expect(view.queryByTestId(id)).toBeNull());
      s.text?.forEach((t) => expect(view.queryByText(t)).toBeTruthy());
      Object.entries(s.style ?? {}).forEach(([id, style]) =>
        expect(StyleSheet.flatten(view.getByTestId(id).props.style)).toMatchObject(style)
      );
      if (s.press) fireEvent.press(view.getByTestId(s.press));
      if (s.pressText) fireEvent.press(view.getByText(s.pressText));
    }
    view.unmount();
  });
});
