// The weekly leaderboard tab (components/board/BoardScreen.tsx, lib/cloud/board.ts): the join form on native, the name-taken message,
// the podium + panel + list + bottom bar, leaving, the live refresh, and no board for a guest on web. The network is a mocked
// fetch; the database is the in-memory one, so joining really stores the identity. The made-up players are switched off (the
// board is exactly what the fake server says) except in the test that wants them.

const mockNavigate = jest.fn();
const mockBlur: (() => void)[] = [];
const mockFocus: (() => void | (() => void))[] = [];
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(() => {
      mockFocus.push(cb);
      const cleanup = cb();
      if (typeof cleanup === 'function') mockBlur.push(cleanup);
      return cleanup;
    }, []);
  },
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/lib/cloud/boardBots', () => {
  const actual = jest.requireActual('@/lib/cloud/boardBots');
  return { ...actual, withBots: jest.fn((d: unknown) => d) };
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, AppState, Platform, StyleSheet } from 'react-native';

import { BOTS } from '@/lib/cloud/boardBots';
import * as botsModule from '@/lib/cloud/boardBots';
import { BOARD_LIST_MAX, shiftDate } from '@/lib/cloud/boardStats';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import BoardScreen from '../board/BoardScreen';
import { BOARD_REFRESH_MS, BOARD_TICK_MS } from '../board/useBoard';

jest.setTimeout(30000);

const mockFetch = jest.fn();
const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// The week starts two days ago: today is its third day, 5 days are left.
const WEEK_START = shiftDate(localDateString(), -2);
const row = (rank: number, name: string, xp: number, me = false) => ({ rank, name, xp, me });
const BOARD = {
  weekStart: WEEK_START,
  rows: [row(1, 'Ana', 412), row(2, 'Beto', 396), row(3, 'Cris', 305), row(4, 'Dani', 241), row(5, 'Eva', 198), row(6, 'Kálmán', 172, true), row(7, 'Fede', 164)],
  me: { rank: 6, xp: 172, name: 'Kálmán' },
};

const NATIVE_URL = 'https://kimacha.kichata.workers.dev';

// Answers the way the server does, by method + path.
function serve(routes: Record<string, () => ReturnType<typeof answer> | Promise<ReturnType<typeof answer>>>) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace(NATIVE_URL, '').split('?')[0]}`;
    return routes[key]?.() ?? answer(404, { error: 'server' });
  });
}
const serveBoard = (board: () => unknown = () => BOARD) => serve({ 'PUT /api/board/xp': () => answer(200, {}), 'GET /api/board': () => answer(200, board()) });

const renderScreen = () =>
  render(
    <ThemeProvider>
      <BoardScreen />
    </ThemeProvider>,
  );

const callsTo = (method: string, path: string) =>
  mockFetch.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === method && String(url).includes(path));

describe('BoardScreen', () => {
  beforeEach(async () => {
    setLanguage('en');
    mockFetch.mockReset();
    mockNavigate.mockReset();
    mockBlur.length = 0;
    mockFocus.length = 0;
    (botsModule.withBots as jest.Mock).mockReset().mockImplementation((d: unknown) => d);
    (globalThis as any).fetch = mockFetch;
    await getDb().setGrammarPalette('classic');
    await getDb().setBoardIdentity(null);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    setLanguage('en');
  });

  it('native without a name: the form warns that others see the name; joining stores the identity and shows the board', async () => {
    serve({
      'POST /api/board/join': () => answer(200, { token: 'dev-tok', displayName: 'Kálmán' }),
      'PUT /api/board/xp': () => answer(200, {}),
      'GET /api/board': () => answer(200, BOARD),
    });
    const view = renderScreen();
    expect(await view.findByText('Other learners can see your name and your weekly XP.')).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
    // no data before joining: three faint "?" columns, no panel, no bottom bar
    expect(view.getAllByText('?', { includeHiddenElements: true })).toHaveLength(3);
    expect(view.queryByTestId('board-mebar')).toBeNull();

    fireEvent.changeText(view.getByTestId('board-name'), 'Kálmán');
    fireEvent.press(view.getByTestId('board-join'));

    expect(await view.findByTestId('board-mebar')).toBeTruthy();
    expect(view.getByTestId('board-rank').props.children).toBe('6.');
    expect(await getDb().getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    expect(callsTo('POST', '/api/board/join')[0][0]).toBe(`${NATIVE_URL}/api/board/join`);
    expect(JSON.parse(callsTo('POST', '/api/board/join')[0][1].body)).toEqual({ name: 'Kálmán' });
    expect(callsTo('PUT', '/api/board/xp')[0][1].headers.Authorization).toBe('Bearer dev-tok');
    expect(callsTo('GET', '/api/board')[0][0]).toBe(`${NATIVE_URL}/api/board?today=${localDateString()}`);
    view.unmount();
  });

  it('the join button stays off until the name is valid', async () => {
    const view = renderScreen();
    const join = await view.findByTestId('board-join');
    expect(join.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(view.getByTestId('board-name'), 'Ana');
    expect(view.getByTestId('board-join').props.accessibilityState.disabled).toBe(false);
    view.unmount();
  });

  it('a name that is taken shows the message and stores nothing', async () => {
    serve({ 'POST /api/board/join': () => answer(409, { error: 'name_taken' }) });
    const view = renderScreen();
    fireEvent.changeText(await view.findByTestId('board-name'), 'Ana');
    fireEvent.press(view.getByTestId('board-join'));
    expect(await view.findByText('That name is taken, pick another one.')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).toBeNull();
    expect(callsTo('PUT', '/api/board/xp')).toHaveLength(0);
    view.unmount();
  });

  it('too many joins from one network show their own message, not the offline line', async () => {
    serve({ 'POST /api/board/join': () => answer(429, { error: 'locked', retryAfterSec: 3600 }) });
    const view = renderScreen();
    fireEvent.changeText(await view.findByTestId('board-name'), 'Ana');
    fireEvent.press(view.getByTestId('board-join'));
    expect(await view.findByText('Too many people have joined from this network today. Try again tomorrow.')).toBeTruthy();
    expect(view.queryByText('The leaderboard is not available right now.')).toBeNull();
    expect(await getDb().getBoardIdentity()).toBeNull();
    view.unmount();
  });

  it('an unreachable server while joining shows the offline line and a server error the same', async () => {
    serve({ 'POST /api/board/join': () => answer(500, { error: 'server' }) });
    const view = renderScreen();
    fireEvent.changeText(await view.findByTestId('board-name'), 'Ana');
    fireEvent.press(view.getByTestId('board-join'));
    expect(await view.findByText('The leaderboard is not available right now.')).toBeTruthy();
    view.unmount();
  });

  it('joined: the podium holds the top 3, the list starts at 4th, only the own row is marked, no toggle', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serveBoard();
    const view = renderScreen();
    expect(await view.findByTestId('board-panel')).toBeTruthy();

    for (const n of [1, 2, 3]) expect(view.getByTestId(`board-podium-${n}`)).toBeTruthy();
    expect(view.getByText('Ana')).toBeTruthy();
    expect(view.getByText('412 XP')).toBeTruthy();
    expect(view.queryByTestId('board-row-1')).toBeNull();
    expect(view.queryByTestId('board-row-3')).toBeNull();
    expect(view.getByTestId('board-row-4').props.accessibilityState).toEqual({ selected: false });
    expect(view.getByTestId('board-row-me').props.accessibilityState).toEqual({ selected: true });
    expect(view.getByTestId('board-row-me').props.accessibilityLabel).toBe('Kálmán, Rank 6 · 172 XP');
    expect(view.getByText('164 XP')).toBeTruthy();
    expect(view.queryByTestId('board-toggle')).toBeNull();
    expect(view.getByText('Leave the leaderboard')).toBeTruthy();
    expect(view.getByText('5 days left · resets Monday')).toBeTruthy();
    view.unmount();
  });

  it('the own name on the podium carries the "(you)" mark, and a player below three leaves a faint placeholder', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serveBoard(() => ({ weekStart: WEEK_START, rows: [row(1, 'Ana', 90), row(2, 'Kálmán', 40, true)], me: { rank: 2, xp: 40, name: 'Kálmán' } }));
    const view = renderScreen();
    await view.findByTestId('board-panel');
    expect(view.getByText('Kálmán (you)')).toBeTruthy();
    expect(view.getByTestId('board-podium-ghost-3', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getAllByText('?', { includeHiddenElements: true })).toHaveLength(1);
    expect(view.queryByTestId('board-row-4')).toBeNull();
    view.unmount();
  });

  it('the own-week panel shows the place, the week, the days left, the six figures and last week', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    await getDb().addDailyXpTenths(WEEK_START, 580);
    await getDb().addDailyXpTenths(shiftDate(WEEK_START, 1), 710);
    await getDb().addDailyXpTenths(shiftDate(WEEK_START, 2), 430);
    await getDb().addDailyXpTenths(shiftDate(WEEK_START, -7), 2860);
    serveBoard();
    const view = renderScreen();
    const panel = await view.findByTestId('board-panel');
    await waitFor(() => expect(view.getByText('last week 286 XP')).toBeTruthy());
    expect(panel).toBeTruthy();
    expect(view.getByText('today 43 XP')).toBeTruthy();
    expect(view.getByText('5 days')).toBeTruthy();
    expect(view.getByText('27 XP')).toBeTruthy();
    expect(view.getByText('8 XP')).toBeTruthy();
    expect(view.getByText('7 XP')).toBeTruthy();
    expect(view.getByText('T · 71')).toBeTruthy();
    expect(view.getByText('57 XP')).toBeTruthy();
    expect(view.getByText('goal 50')).toBeTruthy();
    expect(view.getByText('Your week')).toBeTruthy();
    expect(view.getByText('Place')).toBeTruthy();
    view.unmount();
  });

  it('the bottom bar says what is missing to pass, how far ahead the leader is, or that the learner is alone', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serveBoard();
    const view = renderScreen();
    expect(await view.findByText('27 XP to pass')).toBeTruthy();
    expect(view.getByText('Kálmán · 172 XP')).toBeTruthy();
    expect(view.getByTestId('board-open-week').props.accessibilityLabel).toBe('Kálmán, Rank 6 · 172 XP, 27 XP to pass');
    view.unmount();

    serveBoard(() => ({ weekStart: WEEK_START, rows: [row(1, 'Kálmán', 90, true), row(2, 'Ana', 40)], me: { rank: 1, xp: 90, name: 'Kálmán' } }));
    const lead = renderScreen();
    expect(await lead.findByText('Leading by 50 XP')).toBeTruthy();
    lead.unmount();

    serveBoard(() => ({ weekStart: WEEK_START, rows: [row(1, 'Kálmán', 90, true)], me: { rank: 1, xp: 90, name: 'Kálmán' } }));
    const solo = renderScreen();
    expect(await solo.findByText('Just you so far this week')).toBeTruthy();
    solo.unmount();
  });

  it('the Learn button goes to the Learn tab, and the bar\'s left side is a button', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serveBoard();
    const view = renderScreen();
    fireEvent.press(await view.findByTestId('board-learn'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)');
    fireEvent.press(view.getByTestId('board-open-week'));
    expect(view.getByTestId('board-open-week').props.accessibilityRole).toBe('button');
    view.unmount();
  });

  it('nobody has XP yet: the empty line instead of a list', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serveBoard(() => ({ weekStart: WEEK_START, rows: [row(1, 'Kálmán', 0, true)], me: { rank: 1, xp: 0, name: 'Kálmán' } }));
    const view = renderScreen();
    expect(await view.findByTestId('board-empty')).toBeTruthy();
    view.unmount();
  });

  it('speaks Hungarian in the Hungarian UI', async () => {
    setLanguage('hu');
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serveBoard();
    const view = renderScreen();
    expect(await view.findByText('Még 5 nap · hétfőn nullázódik')).toBeTruthy();
    expect(view.getByText('Heti rangsor')).toBeTruthy();
    expect(view.getByText('27 XP az előzéshez')).toBeTruthy();
    expect(view.getByText('Tanulok')).toBeTruthy();
    expect(view.getByText('Kilépés a rangsorból')).toBeTruthy();
    view.unmount();
  });

  it('with the made-up players on, they take places in the list and the own rank counts them', async () => {
    (botsModule.withBots as jest.Mock).mockImplementation(jest.requireActual('@/lib/cloud/boardBots').withBots);
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    // the end of the week: every bot has its XP
    const week = shiftDate(localDateString(), -6);
    serveBoard(() => ({ weekStart: week, rows: [row(1, 'Kálmán', 1, true)], me: { rank: 1, xp: 1, name: 'Kálmán' } }));
    const view = renderScreen();
    await view.findByTestId('board-mebar');
    const rank = Number(String(view.getByTestId('board-rank').props.children).replace('.', ''));
    expect(rank).toBeGreaterThan(BOTS.length - 4);
    view.unmount();
  });

  it('leaving asks first, then deletes the row, drops the identity and offers the form again', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serve({
      'PUT /api/board/xp': () => answer(200, {}),
      'GET /api/board': () => answer(200, BOARD),
      'DELETE /api/board/me': () => answer(200, {}),
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = renderScreen();
    fireEvent.press(await view.findByTestId('board-leave'));

    expect(callsTo('DELETE', '/api/board/me')).toHaveLength(0);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][1]).toBe('Leave? Your name and your weekly XP will be deleted from the leaderboard.');
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')!.onPress!();
    });

    expect(await view.findByTestId('board-join')).toBeTruthy();
    expect(callsTo('DELETE', '/api/board/me')[0][1].headers.Authorization).toBe('Bearer dev-tok');
    expect(await getDb().getBoardIdentity()).toBeNull();
    expect(view.queryByTestId('board-mebar')).toBeNull();
    view.unmount();
  });

  it('a failed delete keeps the identity (the name could not be removed later without the token)', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serve({
      'PUT /api/board/xp': () => answer(200, {}),
      'GET /api/board': () => answer(200, BOARD),
      'DELETE /api/board/me': () => answer(500, { error: 'server' }),
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons!.find((b) => b.style === 'destructive')!.onPress!());
    const view = renderScreen();
    fireEvent.press(await view.findByTestId('board-leave'));

    expect(await view.findByTestId('board-error')).toBeTruthy();
    expect(view.getByText('The leaderboard is not available right now.')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    view.unmount();
  });

  it('a token the server does not know sends the screen back to the join form and drops the identity', async () => {
    await getDb().setBoardIdentity({ token: 'dead', name: 'Kálmán' });
    serve({ 'PUT /api/board/xp': () => answer(401, { error: 'bad_token' }), 'GET /api/board': () => answer(401, { error: 'bad_token' }) });
    const view = renderScreen();
    expect(await view.findByTestId('board-join')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).toBeNull();
    view.unmount();
  });

  it('an unreachable server shows the offline line, not an error screen', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    mockFetch.mockRejectedValue(new Error('offline'));
    const view = renderScreen();
    expect(await view.findByTestId('board-offline')).toBeTruthy();
    expect(view.getByText('The leaderboard is not available right now.')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).not.toBeNull();
    view.unmount();
  });

  describe('live refresh', () => {
    const fakeTimers = () => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const tick = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    };

    it('reads the board again every 30 seconds and stops when the screen loses focus', async () => {
      await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
      fakeTimers();
      serveBoard();
      const view = renderScreen();
      await view.findByTestId('board-panel');
      expect(callsTo('GET', '/api/board')).toHaveLength(1);

      await tick(BOARD_REFRESH_MS);
      expect(callsTo('GET', '/api/board')).toHaveLength(2);
      await tick(BOARD_REFRESH_MS);
      expect(callsTo('GET', '/api/board')).toHaveLength(3);

      await act(async () => mockBlur.forEach((blur) => blur()));
      await tick(BOARD_REFRESH_MS * 3);
      expect(callsTo('GET', '/api/board')).toHaveLength(3);
      view.unmount();
    });

    it('does not read while the app is not active, and starts again when it is', async () => {
      await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
      fakeTimers();
      let onChange: (state: string) => void = () => {};
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (state: string) => void) => {
        onChange = fn;
        return { remove: jest.fn() };
      }) as never);
      serveBoard();
      const view = renderScreen();
      await view.findByTestId('board-panel');
      act(() => onChange('background'));
      await tick(BOARD_REFRESH_MS * 2);
      expect(callsTo('GET', '/api/board')).toHaveLength(1);
      act(() => onChange('active'));
      await tick(BOARD_REFRESH_MS);
      expect(callsTo('GET', '/api/board')).toHaveLength(2);
      view.unmount();
    });

    it('a failed refresh keeps the last board and does not switch to offline', async () => {
      await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
      fakeTimers();
      serveBoard();
      const view = renderScreen();
      await view.findByTestId('board-panel');
      mockFetch.mockRejectedValue(new Error('offline'));
      await tick(BOARD_REFRESH_MS);
      expect(mockFetch.mock.calls.length).toBeGreaterThan(2);
      expect(view.queryByTestId('board-offline')).toBeNull();
      expect(view.getByTestId('board-panel')).toBeTruthy();
      expect(view.getByTestId('board-row-4')).toBeTruthy();
      view.unmount();
    });

    it('the made-up players are mixed in again at every refresh, from the last server answer', async () => {
      await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
      fakeTimers();
      serveBoard();
      const view = renderScreen();
      await view.findByTestId('board-panel');
      const withBots = botsModule.withBots as jest.Mock;
      const before = withBots.mock.calls.length;
      mockFetch.mockRejectedValue(new Error('offline'));
      await tick(BOARD_REFRESH_MS);
      expect(withBots.mock.calls.length).toBeGreaterThan(before);
      expect(withBots.mock.calls[withBots.mock.calls.length - 1][0]).toMatchObject({ weekStart: WEEK_START });
      view.unmount();
    });

    it('moves the made-up players between two server reads, without calling the server, and stops on blur', async () => {
      await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
      fakeTimers();
      serveBoard();
      const view = renderScreen();
      await view.findByTestId('board-panel');
      const withBots = botsModule.withBots as jest.Mock;
      const before = withBots.mock.calls.length;
      const reads = callsTo('GET', '/api/board').length;

      await tick(BOARD_TICK_MS);
      expect(withBots.mock.calls.length).toBe(before + 1);
      expect(callsTo('GET', '/api/board')).toHaveLength(reads);

      await act(async () => mockBlur.forEach((blur) => blur()));
      const atBlur = withBots.mock.calls.length;
      await tick(BOARD_TICK_MS * 4);
      expect(withBots.mock.calls.length).toBe(atBlur);
      view.unmount();
    });

    it('a "+N" shows where XP grew at a refresh, and not on the first load', async () => {
      await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
      fakeTimers();
      let anaXp = 412;
      serveBoard(() => ({ ...BOARD, rows: BOARD.rows.map((r) => (r.name === 'Ana' ? { ...r, xp: anaXp } : r)) }));
      const view = renderScreen();
      await view.findByTestId('board-panel');
      expect(view.queryByTestId('board-gain')).toBeNull();

      anaXp = 420;
      await tick(BOARD_REFRESH_MS);
      expect(view.getByText('+8')).toBeTruthy();
      // it fades out and leaves
      await tick(1500);
      await waitFor(() => expect(view.queryByTestId('board-gain')).toBeNull());
      view.unmount();
    });

    it('a "+N" also floats on a list row (4th place and below)', async () => {
      await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
      fakeTimers();
      let faXp = 164;
      serveBoard(() => ({ ...BOARD, rows: BOARD.rows.map((r) => (r.name === 'Fede' ? { ...r, xp: faXp } : r)) }));
      const view = renderScreen();
      await view.findByTestId('board-panel');
      faXp = 170;
      await tick(BOARD_REFRESH_MS);
      expect(view.getByText('+6')).toBeTruthy();
      view.unmount();
    });
  });

  describe('review fixes', () => {
    const fakeTimers = () => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const tick = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    };
    const confirmLeave = () => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons!.find((b) => b.style === 'destructive')!.onPress!());
    const identity = () => getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });

    it('a first load that failed offline gets its panel when a later refresh succeeds', async () => {
      await identity();
      fakeTimers();
      let up = false;
      serve({ 'PUT /api/board/xp': () => answer(200, {}), 'GET /api/board': () => (up ? answer(200, BOARD) : answer(500, { error: 'server' })) });
      const view = renderScreen();
      await view.findByTestId('board-offline');
      expect(view.queryByTestId('board-panel')).toBeNull();
      up = true;
      await tick(BOARD_REFRESH_MS);
      expect(await view.findByTestId('board-panel')).toBeTruthy();
      expect(view.queryByTestId('board-offline')).toBeNull();
      view.unmount();
    });

    it('a database failure while reading the week leaves the board without the panel, the open-week button does nothing, and a later refresh brings the panel', async () => {
      await identity();
      fakeTimers();
      const spy = jest.spyOn(getDb(), 'getDailyXpTenths').mockRejectedValue(new Error('db'));
      serveBoard();
      const view = renderScreen();
      expect(await view.findByTestId('board-mebar')).toBeTruthy();
      expect(view.queryByTestId('board-loading')).toBeNull();
      expect(view.queryByTestId('board-panel')).toBeNull();
      expect(view.getByTestId('board-row-4')).toBeTruthy();
      expect(view.getByTestId('board-open-week').props.accessibilityState).toMatchObject({ disabled: true });
      spy.mockRestore();
      await tick(BOARD_REFRESH_MS);
      expect(await view.findByTestId('board-panel')).toBeTruthy();
      view.unmount();
    });

    it('when the server turns to the next week the panel is rebuilt for it', async () => {
      await identity();
      fakeTimers();
      let week = WEEK_START;
      serveBoard(() => ({ ...BOARD, weekStart: week }));
      const view = renderScreen();
      await view.findByTestId('board-panel');
      expect(view.getByText('5 days left · resets Monday')).toBeTruthy();
      week = shiftDate(WEEK_START, 7);
      await tick(BOARD_REFRESH_MS);
      expect(await view.findByText('7 days left · resets Monday')).toBeTruthy();
      expect(view.getByText('today 0 XP')).toBeTruthy();
      view.unmount();
    });

    it('a refresh that is still in flight when the learner leaves cannot bring the ready state back', async () => {
      await identity();
      fakeTimers();
      let hold = false;
      let release: (r: ReturnType<typeof answer>) => void = () => {};
      const pending = new Promise<ReturnType<typeof answer>>((r) => {
        release = r;
      });
      serve({
        'PUT /api/board/xp': () => answer(200, {}),
        'GET /api/board': () => (hold ? pending : answer(200, BOARD)),
        'DELETE /api/board/me': () => answer(200, {}),
      });
      confirmLeave();
      const view = renderScreen();
      await view.findByTestId('board-panel');
      hold = true;
      await tick(BOARD_REFRESH_MS);
      fireEvent.press(view.getByTestId('board-leave'));
      expect(await view.findByTestId('board-join')).toBeTruthy();
      await act(async () => release(answer(200, BOARD)));
      expect(view.queryByTestId('board-mebar')).toBeNull();
      expect(view.queryByTestId('board-panel')).toBeNull();
      expect(view.getByTestId('board-join')).toBeTruthy();
      view.unmount();
    });

    it('a token the server forgot, found by a refresh, sends the screen back to the join form like a load does', async () => {
      await identity();
      fakeTimers();
      let dead = false;
      serve({
        'PUT /api/board/xp': () => answer(200, {}),
        'GET /api/board': () => (dead ? answer(401, { error: 'bad_token' }) : answer(200, BOARD)),
      });
      const view = renderScreen();
      await view.findByTestId('board-panel');
      dead = true;
      await tick(BOARD_REFRESH_MS);
      expect(await view.findByTestId('board-join')).toBeTruthy();
      expect(await getDb().getBoardIdentity()).toBeNull();
      expect(view.queryByTestId('board-mebar')).toBeNull();
      view.unmount();
    });

    it('a plus label shows only for refreshes while the screen stays open: coming back to the tab (a load) shows none', async () => {
      await identity();
      fakeTimers();
      let anaXp = 412;
      serveBoard(() => ({ ...BOARD, rows: BOARD.rows.map((r) => (r.name === 'Ana' ? { ...r, xp: anaXp } : r)) }));
      const view = renderScreen();
      await view.findByTestId('board-panel');
      anaXp = 420;
      await act(async () => mockFocus.forEach((cb) => cb()));
      expect(await view.findByText('420 XP')).toBeTruthy();
      expect(view.queryByTestId('board-gain')).toBeNull();
      // the next timer refresh compares with the values the load stored
      anaXp = 425;
      await tick(BOARD_REFRESH_MS);
      expect(await view.findByText('+5')).toBeTruthy();
      view.unmount();
    });

    it('a second gain restarts the label with its own number, and a gain whose row left the list is dropped', async () => {
      await identity();
      fakeTimers();
      let anaXp = 412;
      let withAna = true;
      serveBoard(() => ({ ...BOARD, rows: BOARD.rows.filter((r) => withAna || r.name !== 'Ana').map((r) => (r.name === 'Ana' ? { ...r, xp: anaXp } : r)) }));
      const view = renderScreen();
      await view.findByTestId('board-panel');
      anaXp = 420;
      await tick(BOARD_REFRESH_MS);
      expect(await view.findByText('+8')).toBeTruthy();
      anaXp = 430;
      await tick(BOARD_REFRESH_MS);
      expect(await view.findByText('+10')).toBeTruthy();
      expect(view.queryByText('+8')).toBeNull();
      withAna = false;
      await tick(BOARD_REFRESH_MS);
      await waitFor(() => expect(view.queryByTestId('board-gain')).toBeNull());
      view.unmount();
    });

    it('beyond the 50-row cut the bar has no second line and the panel shows dashes; at exactly rank 50 the caller is not alone', async () => {
      await identity();
      const reals = Array.from({ length: BOARD_LIST_MAX }, (_, i) => row(i + 1, `Real${String(i).padStart(2, '0')}`, 1000 - i));
      serveBoard(() => ({ weekStart: WEEK_START, rows: reals, me: { rank: 58, xp: 5, name: 'Kálmán' } }));
      const far = renderScreen();
      await far.findByTestId('board-panel');
      expect(far.getByTestId('board-open-week').props.accessibilityLabel).toBe('Kálmán, Rank 58 · 5 XP');
      expect(far.queryByText(/XP to pass/)).toBeNull();
      expect(far.queryByText('Just you so far this week')).toBeNull();
      expect(far.getAllByText('–').length).toBeGreaterThanOrEqual(2);
      far.unmount();

      const lastRows = reals.map((r) => (r.rank === 50 ? { ...r, name: 'Kálmán', me: true } : r));
      serveBoard(() => ({ weekStart: WEEK_START, rows: lastRows, me: { rank: 50, xp: 951, name: 'Kálmán' } }));
      const edge = renderScreen();
      expect(await edge.findByText('2 XP to pass')).toBeTruthy();
      expect(edge.queryByText('Just you so far this week')).toBeNull();
      // the rank-50 caller is not known to be the last one either: the lead cell is a dash, not "none"
      expect(edge.queryByText('none')).toBeNull();
      edge.unmount();
    });

    it('with no XP this week the best day is a dash, and the last place says none for the lead', async () => {
      await identity();
      const quiet = shiftDate(WEEK_START, -40);
      serveBoard(() => ({ weekStart: quiet, rows: [row(1, 'Ana', 100), row(2, 'Kálmán', 0, true)], me: { rank: 2, xp: 0, name: 'Kálmán' } }));
      const view = renderScreen();
      await view.findByTestId('board-panel');
      expect(view.getByText('–')).toBeTruthy();
      expect(view.getByText('none')).toBeTruthy();
      expect(view.getByText('101 XP')).toBeTruthy();
      view.unmount();
    });

    it('an emoji initial is not split, the Spanish Falta/Faltan follows the number of days, and the figures stay heavy', async () => {
      setLanguage('es');
      await identity();
      const lastDay = shiftDate(localDateString(), -6);
      serveBoard(() => ({
        weekStart: lastDay,
        rows: [row(1, 'Ana', 412), row(2, 'Beto', 396), row(3, 'Cris', 305), row(4, '\u{1F32E}Taco', 241), row(5, 'Kálmán', 172, true)],
        me: { rank: 5, xp: 172, name: 'Kálmán' },
      }));
      const view = renderScreen();
      await view.findByTestId('board-panel');
      expect(view.getByText('\u{1F32E}')).toBeTruthy();
      expect(view.getByText('Falta')).toBeTruthy();
      expect(view.getByText('Falta 1 día · se reinicia el lunes')).toBeTruthy();
      // the split-flap digit of the place: monospace and heavy (the list row's "5" is a plain text)
      const styles = view.getAllByText('5').map((n) => StyleSheet.flatten(n.props.style));
      expect(styles.some((st) => st.fontFamily && st.fontWeight === '700')).toBe(true);
      view.unmount();
    });
  });

  describe('on web', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
      // the ThemeProvider reads the web test parameters from the page address (lib/webTestHooks.ts)
      Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
    });
    afterEach(() => {
      delete (globalThis as { location?: unknown }).location;
      delete (globalThis as { confirm?: unknown }).confirm;
    });

    it('a guest (no cloud session) gets no board and no request', async () => {
      const view = renderScreen();
      await waitFor(() => expect(view.queryByTestId('board-panel')).toBeNull());
      expect(view.queryByTestId('board-name')).toBeNull();
      expect(view.queryByTestId('board-loading')).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
      view.unmount();
    });

    const withSession = () => {
      const store = new Map([['kimacha.cloud.session', JSON.stringify({ name: 'Kálmán', token: 'web-tok' })]]);
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: (k: string) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} },
      });
    };
    const LEFT = { weekStart: WEEK_START, rows: BOARD.rows.map((r) => ({ ...r, me: false })), me: null, left: true };

    it('with a cloud session there is no name field: the account token goes up and the board shows', async () => {
      withSession();
      serveBoard();
      const view = renderScreen();
      expect(await view.findByTestId('board-mebar')).toBeTruthy();
      expect(view.queryByTestId('board-name')).toBeNull();
      expect(callsTo('PUT', '/api/board/xp')[0][0]).toBe('/api/board/xp');
      expect(callsTo('GET', '/api/board')[0][1].headers.Authorization).toBe('Bearer web-tok');
      view.unmount();
    });

    it('after leaving, the list stays and a join button without a name field brings the account back', async () => {
      withSession();
      let left = false;
      serve({
        'PUT /api/board/xp': () => answer(200, {}),
        'GET /api/board': () => answer(200, left ? LEFT : BOARD),
        'DELETE /api/board/me': () => {
          left = true;
          return answer(200, {});
        },
        'POST /api/board/join': () => {
          left = false;
          return answer(200, { displayName: 'Kálmán' });
        },
      });
      Object.defineProperty(globalThis, 'confirm', { configurable: true, value: jest.fn(() => true) });
      const view = renderScreen();
      fireEvent.press(await view.findByTestId('board-leave'));

      // left: podium + list are shown, nobody is marked, no panel, no bottom bar, the only control is the join button
      expect(await view.findByTestId('board-rejoin')).toBeTruthy();
      expect(callsTo('DELETE', '/api/board/me')[0][1].headers.Authorization).toBe('Bearer web-tok');
      expect(view.getByText('Ana')).toBeTruthy();
      expect(view.getByTestId('board-row-4')).toBeTruthy();
      expect(view.queryByTestId('board-row-me')).toBeNull();
      expect(view.queryByTestId('board-name')).toBeNull();
      expect(view.queryByTestId('board-panel')).toBeNull();
      expect(view.queryByTestId('board-mebar')).toBeNull();
      expect(view.queryByTestId('board-rank')).toBeNull();

      fireEvent.press(view.getByTestId('board-rejoin'));

      expect(await view.findByTestId('board-mebar')).toBeTruthy();
      const join = callsTo('POST', '/api/board/join')[0];
      expect(join[0]).toBe('/api/board/join');
      expect(join[1].headers.Authorization).toBe('Bearer web-tok');
      expect(JSON.parse(join[1].body)).toEqual({});
      expect(view.queryByTestId('board-rejoin')).toBeNull();
      view.unmount();
    });

    it('an older refresh that lands after a newer load does not overwrite it', async () => {
      withSession();
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      let left = false;
      let holdOnce = false;
      let release: (r: ReturnType<typeof answer>) => void = () => {};
      const pending = new Promise<ReturnType<typeof answer>>((r) => {
        release = r;
      });
      serve({
        'PUT /api/board/xp': () => answer(200, {}),
        'GET /api/board': () => {
          if (holdOnce) {
            holdOnce = false;
            return pending;
          }
          return answer(200, left ? LEFT : BOARD);
        },
        'DELETE /api/board/me': () => {
          left = true;
          return answer(200, {});
        },
      });
      Object.defineProperty(globalThis, 'confirm', { configurable: true, value: jest.fn(() => true) });
      const view = renderScreen();
      await view.findByTestId('board-panel');
      holdOnce = true;
      await act(async () => {
        jest.advanceTimersByTime(BOARD_REFRESH_MS);
      });
      fireEvent.press(view.getByTestId('board-leave'));
      expect(await view.findByTestId('board-rejoin')).toBeTruthy();
      await act(async () => release(answer(200, BOARD)));
      expect(view.getByTestId('board-rejoin')).toBeTruthy();
      expect(view.queryByTestId('board-mebar')).toBeNull();
      view.unmount();
    });

    it('a failed rejoin shows the error and stays on the left screen', async () => {
      withSession();
      serve({
        'PUT /api/board/xp': () => answer(200, {}),
        'GET /api/board': () => answer(200, LEFT),
        'POST /api/board/join': () => answer(429, { error: 'locked' }),
      });
      const view = renderScreen();
      fireEvent.press(await view.findByTestId('board-rejoin'));
      expect(await view.findByText('Too many people have joined from this network today. Try again tomorrow.')).toBeTruthy();
      expect(view.getByTestId('board-rejoin')).toBeTruthy();
      view.unmount();
    });
  });
});
