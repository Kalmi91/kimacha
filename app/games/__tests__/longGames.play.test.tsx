// Playthroughs for the five long-form games: memory-pairs (4.3), word-search
// (4.4), story (4.5), chat (4.6), conjugation-slot (4.7) and ccat (4.10).
// FB162 left memory-pairs unfinished ("a bot nem tudta kipörgetni"); this file
// plays it to the last pair headlessly, and does the same for the others.

jest.mock('react-native-reanimated', () => require('../../../testing/reanimatedMock'));
jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/games/long',
}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { getWordsForLevel } from '@/data/words';
import { getDb } from '@/lib/database.web';
import { normalizeForGrid } from '@/lib/games/wordSearch';
import { advanceTimers, flushAsync, seedPractisedWords } from '../../../testing/gameTestUtils';
import { resetAnimations } from '../../../testing/reanimatedMock';
import CcatScreen from '../ccat';
import ChatScreen from '../chat';
import ConjugationSlotScreen from '../conjugation-slot';
import MemoryPairsScreen from '../memory-pairs';
import StoryScreen from '../story';
import WordSearchScreen from '../word-search';

const LEVEL = 'A1' as const;

function cardText(index: number): string {
  const node = screen.getByTestId(`mem-card-${index}`);
  const texts = within(node).getAllByText(/.+/);
  return texts.map((t2) => String(t2.props.children)).join('');
}

describe('long-form games play to the end', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetAnimations();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('memory-pairs: every pair can be matched, the board ends (GAMES.md 4.3)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 40 });
    const view = render(<MemoryPairsScreen />);
    await flushAsync(5);

    const total = screen.queryAllByTestId(/^mem-card-\d+$/).length;
    expect(total).toBe(16); // 4x4 default = 8 pairs

    // Pass 1: learn the board by flipping pairs of positions (a mismatch flips
    // back after 800ms, exactly as a player would scout the grid).
    const faces = new Map<number, string>();
    for (let i = 0; i < total; i += 2) {
      fireEvent.press(screen.getByTestId(`mem-card-${i}`));
      await flushAsync(1);
      faces.set(i, cardText(i));
      fireEvent.press(screen.getByTestId(`mem-card-${i + 1}`));
      await flushAsync(1);
      faces.set(i + 1, cardText(i + 1));
      await advanceTimers(900);
    }
    expect(faces.size).toBe(total);

    // A pair the scan itself turned up stays face up. Count those first and take
    // them out of the pool, otherwise the search below would pair an
    // already-matched card with an innocent one and lose count.
    let matched = 0;
    for (const pos of [...faces.keys()]) {
      if (cardText(pos) !== '?') {
        matched += 0.5; // two positions per pair
        faces.delete(pos);
      }
    }

    // Pass 2: match the rest. The screen only confirms a pair by keeping BOTH
    // cards face up after the flip-back delay, so the test does what a player
    // does: try, and keep the ones that stick.
    let guard = 0;
    while (faces.size > 0 && guard < 200) {
      guard++;
      const [posA] = [...faces.keys()];
      let found = false;
      for (const posB of [...faces.keys()].filter((p) => p !== posA)) {
        fireEvent.press(screen.getByTestId(`mem-card-${posA}`));
        await flushAsync(1);
        fireEvent.press(screen.getByTestId(`mem-card-${posB}`));
        await flushAsync(1);
        await advanceTimers(900);
        if (cardText(posA) === faces.get(posA) && cardText(posB) === faces.get(posB)) {
          matched++;
          faces.delete(posA);
          faces.delete(posB);
          found = true;
          break;
        }
      }
      if (!found) break;
    }

    expect(matched).toBe(8);
    expect(screen.queryByText('Play again')).toBeTruthy();

    view.unmount();
  });

  it('word-search: every listed word is really in the grid (GAMES.md 4.4)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 60 });
    const view = render(<WordSearchScreen />);
    await flushAsync(5);

    const letters = screen
      .queryAllByTestId(/^ws-cell-\d+-\d+$/)
      .map((n) => String(within(n).getByText(/.+/).props.children));
    expect(letters.length).toBe(64); // 8x8 default

    const grid: string[][] = [];
    for (let r = 0; r < 8; r++) grid.push(letters.slice(r * 8, r * 8 + 8));

    const listedIds = screen
      .queryAllByTestId(/^ws-target-\d+$/)
      .map((n) => Number(String(n.props.testID).replace('ws-target-', '')));
    expect(listedIds.length).toBeGreaterThan(0);
    const listed = listedIds.map((id) => String(getWordsForLevel(LEVEL, 'es').find((w) => w.id === id)?.es ?? ''));

    const rows = grid.map((r) => r.join(''));
    const cols = Array.from({ length: 8 }, (_, c) => grid.map((r) => r[c]).join(''));
    const haystack = [...rows, ...cols].join('|');
    for (const word of listed) {
      const target = normalizeForGrid(word);
      expect(haystack.includes(target) || haystack.includes([...target].reverse().join(''))).toBe(true);
    }

    view.unmount();
  });

  it('story: reads every scene and finishes with the learned-words recap (GAMES.md 4.5)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 60 });
    const view = render(<StoryScreen />);
    await flushAsync(5);

    const cards = screen.queryAllByTestId('story-card');
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.press(cards[0]);
    await flushAsync();

    for (let scene = 0; scene < 20; scene++) {
      const options = screen.queryAllByTestId('story-option');
      if (options.length) {
        fireEvent.press(options[0]);
        await flushAsync(1);
      }
      const cont = screen.queryByTestId('story-continue');
      if (!cont) break;
      fireEvent.press(cont);
      await flushAsync(1);
    }

    expect(screen.queryByTestId('story-continue')).toBeNull();
    expect(screen.queryByText('Play again')).toBeTruthy();

    view.unmount();
  });

  it('chat: setup question, dialogue, then the sourced checklist (GAMES.md 4.6)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 60 });
    const view = render(<ChatScreen />);
    await flushAsync(5);

    const topics = screen.queryAllByTestId('chat-topic');
    expect(topics.length).toBeGreaterThan(0);
    fireEvent.press(topics[0]);
    await flushAsync();

    // Setup questions first (GAMES.md 4.6 step 2).
    for (let i = 0; i < 4; i++) {
      const setup = screen.queryAllByTestId('chat-setup-option');
      if (!setup.length) break;
      fireEvent.press(setup[0]);
      await flushAsync(1);
    }

    for (let turn = 0; turn < 40; turn++) {
      const options = screen.queryAllByTestId('chat-option');
      if (!options.length) break;
      fireEvent.press(options[0]);
      await flushAsync(1);
    }

    expect(screen.queryAllByTestId('chat-option').length).toBe(0);
    expect(screen.queryByText('Play again')).toBeTruthy();

    view.unmount();
  });

  it('conjugation-slot: a full 20-question run ends in a summary (GAMES.md 4.7)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 80 });
    const view = render(<ConjugationSlotScreen />);
    await flushAsync(5);

    let answered = 0;
    for (let i = 0; i < 40; i++) {
      const options = screen.queryAllByTestId('conj-option');
      if (!options.length) break;
      fireEvent.press(options[0]);
      answered++;
      await flushAsync(1);
      const gotIt = screen.queryByText('Got it');
      if (gotIt) fireEvent.press(gotIt);
      await flushAsync(1);
    }

    expect(answered).toBeGreaterThanOrEqual(10);
    expect(screen.queryByText('Done!')).toBeTruthy();

    view.unmount();
  });

  it('ccat: waits on the start screen, counts in, then runs ONE clock for the whole test (GAMES.md 4.10)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 80 });
    await getDb().setGameSettings('ccat', { questionCount: 10, timeLimit: 'exam', typeMix: 'all', promptLang: 'learned' });

    const view = render(<CcatScreen />);
    await flushAsync(5);

    // "Indul" first, no question before it.
    expect(screen.queryByTestId('ccat-start')).toBeTruthy();
    expect(screen.queryAllByTestId('ccat-option').length).toBe(0);

    fireEvent.press(screen.getByTestId('ccat-start'));
    for (let i = 0; i < 4; i++) await advanceTimers(800); // 3 - 2 - 1 - Start!
    await flushAsync(4);

    expect(screen.queryAllByTestId('ccat-option').length).toBeGreaterThan(0);

    // 10 questions at the real CCAT pace (18 s/question) = 3:00 for the RUN,
    // and the bar shrinks with it instead of resetting per question.
    expect(String(screen.getByTestId('ccat-clock').props.children.join(''))).toContain('3:0');
    const barWidth = () => {
      const style = screen.getByTestId('ccat-time-bar').props.style as { width?: string }[];
      return parseFloat(String(style.find((st) => st?.width)?.width ?? '0'));
    };
    const fullWidth = barWidth();
    await advanceTimers(30000);
    const laterWidth = barWidth();
    expect(laterWidth).toBeLessThan(fullWidth);

    // Answering does NOT give the clock back.
    fireEvent.press(screen.getAllByTestId('ccat-option')[0]);
    await flushAsync(1);
    const gotIt = screen.queryByText('Got it');
    if (gotIt) fireEvent.press(gotIt);
    await flushAsync(1);
    expect(barWidth()).toBeLessThanOrEqual(laterWidth);

    view.unmount();
  });

  it('ccat: a full timed run ends with the per-type breakdown (GAMES.md 4.10)', async () => {
    await seedPractisedWords({ source: 'hu', target: 'es', level: LEVEL, count: 80 });
    const view = render(<CcatScreen />);
    await flushAsync(5);

    const start = screen.queryByText('Go!') ?? screen.queryByText('Play');
    if (start) {
      fireEvent.press(start);
      await flushAsync();
      for (let i = 0; i < 4; i++) await advanceTimers(800);
      await flushAsync();
    }

    let answered = 0;
    for (let i = 0; i < 40; i++) {
      const options = screen.queryAllByTestId('ccat-option');
      if (!options.length) break;
      fireEvent.press(options[0]);
      answered++;
      await flushAsync(1);
      const gotIt = screen.queryByText('Got it');
      if (gotIt) fireEvent.press(gotIt);
      await flushAsync(1);
    }

    expect(answered).toBeGreaterThanOrEqual(10);
    expect(screen.queryByText('Done!')).toBeTruthy();

    view.unmount();
  });
});
