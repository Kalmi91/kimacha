// The Stats tab's weekly leaderboard card (components/stats/WeeklyBoardCard.tsx, lib/cloud/board.ts): the join form on
// native, the name-taken message, the opened list with the own row marked, leaving, and no card for a guest on web.
// The network is a mocked fetch; the database is the in-memory one, so joining really stores the identity.

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import WeeklyBoardCard from '../stats/WeeklyBoardCard';

jest.setTimeout(30000);

const mockFetch = jest.fn();
const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const BOARD = {
  weekStart: '2026-11-02',
  rows: [
    { rank: 1, name: 'Ana', xp: 80, me: false },
    { rank: 2, name: 'Luis', xp: 55, me: false },
    { rank: 3, name: 'Kálmán', xp: 42, me: true },
  ],
  me: { rank: 3, xp: 42, name: 'Kálmán' },
};

const NATIVE_URL = 'https://kimacha.kichata.workers.dev';

// Answers the way the server does, by method + path.
function serve(routes: Record<string, () => ReturnType<typeof answer>>) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace(NATIVE_URL, '').split('?')[0]}`;
    return routes[key]?.() ?? answer(404, { error: 'server' });
  });
}

const renderCard = () =>
  render(
    <ThemeProvider>
      <WeeklyBoardCard />
    </ThemeProvider>,
  );

const callsTo = (method: string, path: string) =>
  mockFetch.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === method && String(url).includes(path));

describe('WeeklyBoardCard', () => {
  beforeEach(async () => {
    setLanguage('en');
    mockFetch.mockReset();
    (globalThis as any).fetch = mockFetch;
    await getDb().setGrammarPalette('classic');
    await getDb().setBoardIdentity(null);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    setLanguage('en');
  });

  it('native without a name: the form warns that others see the name; joining stores the identity and shows the rank', async () => {
    serve({
      'POST /api/board/join': () => answer(200, { token: 'dev-tok', displayName: 'Kálmán' }),
      'PUT /api/board/xp': () => answer(200, {}),
      'GET /api/board': () => answer(200, BOARD),
    });
    const view = renderCard();
    expect(await view.findByText('Other learners can see your name and your weekly XP.')).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.changeText(view.getByTestId('board-name'), 'Kálmán');
    fireEvent.press(view.getByTestId('board-join'));

    expect(await view.findByText('Rank 3 · 42 XP')).toBeTruthy();
    expect(view.getByText('Resets on Monday')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    expect(callsTo('POST', '/api/board/join')[0][0]).toBe(`${NATIVE_URL}/api/board/join`);
    expect(JSON.parse(callsTo('POST', '/api/board/join')[0][1].body)).toEqual({ name: 'Kálmán' });
    expect(callsTo('PUT', '/api/board/xp')[0][1].headers.Authorization).toBe('Bearer dev-tok');
    expect(callsTo('GET', '/api/board')[0][0]).toBe(`${NATIVE_URL}/api/board?today=${localDateString()}`);
    view.unmount();
  });

  it('a name that is taken shows the message and stores nothing', async () => {
    serve({ 'POST /api/board/join': () => answer(409, { error: 'name_taken' }) });
    const view = renderCard();
    fireEvent.changeText(await view.findByTestId('board-name'), 'Ana');
    fireEvent.press(view.getByTestId('board-join'));
    expect(await view.findByText('That name is taken, pick another one.')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).toBeNull();
    expect(callsTo('PUT', '/api/board/xp')).toHaveLength(0);
    view.unmount();
  });

  it('too many joins from one network show their own message, not the offline line', async () => {
    serve({ 'POST /api/board/join': () => answer(429, { error: 'locked', retryAfterSec: 3600 }) });
    const view = renderCard();
    fireEvent.changeText(await view.findByTestId('board-name'), 'Ana');
    fireEvent.press(view.getByTestId('board-join'));
    expect(await view.findByText('Too many people have joined from this network today. Try again tomorrow.')).toBeTruthy();
    expect(view.queryByText('The leaderboard is not available right now.')).toBeNull();
    expect(await getDb().getBoardIdentity()).toBeNull();
    view.unmount();
  });

  it('joined: the rank line is there, a tap opens the list and only the own row is marked', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serve({ 'PUT /api/board/xp': () => answer(200, {}), 'GET /api/board': () => answer(200, BOARD) });
    const view = renderCard();
    expect(await view.findByText('Rank 3 · 42 XP')).toBeTruthy();
    expect(view.queryByTestId('board-row-me')).toBeNull();

    fireEvent.press(view.getByTestId('board-toggle'));

    expect(view.getByText('Ana')).toBeTruthy();
    expect(view.getByText('80 XP')).toBeTruthy();
    expect(view.getByTestId('board-row-me').props.accessibilityState).toEqual({ selected: true });
    expect(view.getByTestId('board-row-1').props.accessibilityState).toEqual({ selected: false });
    expect(view.getByText('Leave the leaderboard')).toBeTruthy();
    view.unmount();
  });

  it('speaks Hungarian in the Hungarian UI', async () => {
    setLanguage('hu');
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    serve({ 'PUT /api/board/xp': () => answer(200, {}), 'GET /api/board': () => answer(200, BOARD) });
    const view = renderCard();
    expect(await view.findByText('3. hely · 42 XP')).toBeTruthy();
    expect(view.getByText('Heti rangsor')).toBeTruthy();
    expect(view.getByText('Hétfőn nullázódik')).toBeTruthy();
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
    const view = renderCard();
    fireEvent.press(await view.findByTestId('board-toggle'));
    fireEvent.press(view.getByTestId('board-leave'));

    expect(callsTo('DELETE', '/api/board/me')).toHaveLength(0);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][1]).toBe('Leave? Your name and your weekly XP will be deleted from the leaderboard.');
    const buttons = alert.mock.calls[0][2]!;
    buttons.find((b) => b.style === 'destructive')!.onPress!();

    expect(await view.findByTestId('board-join')).toBeTruthy();
    expect(callsTo('DELETE', '/api/board/me')[0][1].headers.Authorization).toBe('Bearer dev-tok');
    expect(await getDb().getBoardIdentity()).toBeNull();
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
    const view = renderCard();
    fireEvent.press(await view.findByTestId('board-toggle'));
    fireEvent.press(view.getByTestId('board-leave'));

    expect(await view.findByText('The leaderboard is not available right now.')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).toEqual({ token: 'dev-tok', name: 'Kálmán' });
    view.unmount();
  });

  it('a token the server does not know sends the card back to the join form and drops the identity', async () => {
    await getDb().setBoardIdentity({ token: 'dead', name: 'Kálmán' });
    serve({ 'PUT /api/board/xp': () => answer(401, { error: 'bad_token' }), 'GET /api/board': () => answer(401, { error: 'bad_token' }) });
    const view = renderCard();
    expect(await view.findByTestId('board-join')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).toBeNull();
    view.unmount();
  });

  it('an unreachable server shows the offline line, not an error screen', async () => {
    await getDb().setBoardIdentity({ token: 'dev-tok', name: 'Kálmán' });
    mockFetch.mockRejectedValue(new Error('offline'));
    const view = renderCard();
    expect(await view.findByText('The leaderboard is not available right now.')).toBeTruthy();
    expect(await getDb().getBoardIdentity()).not.toBeNull();
    view.unmount();
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

    it('a guest (no cloud session) gets no card and no request', async () => {
      const view = renderCard();
      await waitFor(() => expect(view.queryByTestId('weekly-board')).toBeNull());
      expect(view.queryByTestId('board-name')).toBeNull();
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
    const LEFT = { weekStart: '2026-11-02', rows: BOARD.rows.map((r) => ({ ...r, me: false })), me: null, left: true };

    it('with a cloud session there is no name field: the account token goes up and the rank shows', async () => {
      withSession();
      serve({ 'PUT /api/board/xp': () => answer(200, {}), 'GET /api/board': () => answer(200, BOARD) });
      const view = renderCard();
      expect(await view.findByText('Rank 3 · 42 XP')).toBeTruthy();
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
      const view = renderCard();
      fireEvent.press(await view.findByTestId('board-toggle'));
      fireEvent.press(view.getByTestId('board-leave'));

      // left: the list is shown, nobody is marked, the only control is the join button (no name input)
      expect(await view.findByTestId('board-rejoin')).toBeTruthy();
      expect(callsTo('DELETE', '/api/board/me')[0][1].headers.Authorization).toBe('Bearer web-tok');
      expect(view.getByText('Ana')).toBeTruthy();
      expect(view.queryByTestId('board-row-me')).toBeNull();
      expect(view.queryByTestId('board-name')).toBeNull();
      expect(view.queryByTestId('board-rank')).toBeNull();

      fireEvent.press(view.getByTestId('board-rejoin'));

      expect(await view.findByText('Rank 3 · 42 XP')).toBeTruthy();
      const join = callsTo('POST', '/api/board/join')[0];
      expect(join[0]).toBe('/api/board/join');
      expect(join[1].headers.Authorization).toBe('Bearer web-tok');
      expect(JSON.parse(join[1].body)).toEqual({});
      expect(view.queryByTestId('board-rejoin')).toBeNull();
      view.unmount();
    });
  });
});
