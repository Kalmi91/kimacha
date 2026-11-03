// The web gate's guest mode: a first visit plays at once, a later one meets the welcome screen, the save offer comes after
// five graded cards, and a guest who signs in keeps the cards. Mock pattern: lib/cloud/__tests__/sync.test.ts.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import CloudGate from '@/components/cloud/CloudGate';
import { GUEST_OFFER_AFTER, OFFER_DONE_KEY, VISITED_KEY, noteCardGraded, requestCloudSignIn, resetGuestStateForTests } from '@/lib/cloud/guest';
import { SESSION_KEY, loadSession } from '@/lib/cloud/session';
import { makeFlush } from '@/test-utils/flush';
import { UI_LANG_KEY, rememberedLanguage, setLanguage } from '@/lib/i18n';
import en from '@/lib/i18n/en';
import hu from '@/lib/i18n/hu';

const mockLogin = jest.fn();
const mockGetProgress = jest.fn();
const mockPutProgress = jest.fn();
jest.mock('@/lib/cloud/api', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  getProgress: (...args: unknown[]) => mockGetProgress(...args),
  putProgress: (...args: unknown[]) => mockPutProgress(...args),
}));

const mockRestore = jest.fn();
const mockSnapshotKey = jest.fn();
const mockStartSync = jest.fn();
const mockExportPayload = jest.fn();
jest.mock('@/lib/cloud/sync', () => ({
  restoreFromCloud: (...args: unknown[]) => mockRestore(...args),
  snapshotKey: () => mockSnapshotKey(),
  startSync: (...args: unknown[]) => mockStartSync(...args),
  exportCloudPayload: () => mockExportPayload(),
}));

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@/lib/screenFeedback', () => ({ __esModule: true, default: () => null }));

jest.setTimeout(30000);

const flush = makeFlush(8);

function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(entries));
  const store = {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  return store;
}

const reload = jest.fn();

// A cloud payload whose web store is the given object.
const payloadOf = (store: object) => JSON.stringify({ v: 1, store: JSON.stringify(store), resume: {} });

const gate = () =>
  render(
    <CloudGate>
      <Text testID="app">app</Text>
    </CloudGate>,
  );

async function gradeCards(n: number) {
  await act(async () => {
    for (let i = 0; i < n; i++) noteCardGraded();
  });
  await flush();
}

async function signInAs(name: string, pin: string) {
  fireEvent.changeText(screen.getByTestId('cloud-login-name'), name);
  fireEvent.changeText(screen.getByTestId('cloud-login-pin'), pin);
  await act(async () => {
    fireEvent.press(screen.getByTestId('cloud-login-submit'));
  });
  await flush();
}

beforeEach(() => {
  [mockLogin, mockGetProgress, mockPutProgress, mockRestore, mockSnapshotKey, mockStartSync, mockExportPayload, reload].forEach((m) => m.mockReset());
  mockStartSync.mockReturnValue(jest.fn());
  mockRestore.mockResolvedValue(undefined);
  mockSnapshotKey.mockResolvedValue('snap');
  mockPutProgress.mockResolvedValue({ ok: true, data: { updatedAt: 'now', rev: 8 } });
  Object.defineProperty(globalThis, 'location', { value: { reload }, configurable: true, writable: true });
});

afterEach(() => {
  delete (globalThis as any).localStorage;
  delete (globalThis as any).location;
  resetGuestStateForTests();
});

describe('CloudGate: the first visit', () => {
  it('shows the app at once, with no sign-in screen, and remembers the visit', async () => {
    const store = memoryStorage();
    gate();
    await flush();
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByTestId('cloud-login')).toBeNull();
    expect(screen.queryByTestId('cloud-welcome')).toBeNull();
    expect(store.map.has(VISITED_KEY)).toBe(true);
    // a guest: no restore, no sync
    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(mockStartSync).not.toHaveBeenCalled();
  });

  it('offers the save after five graded cards; No explains the Settings route and the offer never comes back', async () => {
    const store = memoryStorage();
    gate();
    await flush();
    await gradeCards(GUEST_OFFER_AFTER - 1);
    expect(screen.queryByText('Save your progress?')).toBeNull();

    await gradeCards(1);
    expect(screen.getByText('Save your progress?')).toBeTruthy();

    fireEvent.press(screen.getByTestId('cloud-ask-no'));
    expect(store.map.has(OFFER_DONE_KEY)).toBe(true);
    expect(screen.getByText(/Settings → Sign in/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('cloud-declined-ok'));
    expect(screen.queryByText(/Settings → Sign in/)).toBeNull();
    await gradeCards(GUEST_OFFER_AFTER);
    expect(screen.queryByText('Save your progress?')).toBeNull();
  });

  it('Yes opens the create-account form that explains name and PIN; its Back button leads to the Settings note', async () => {
    memoryStorage();
    gate();
    await flush();
    await gradeCards(GUEST_OFFER_AFTER);

    fireEvent.press(screen.getByTestId('cloud-ask-yes'));
    expect(screen.getByText('PIN (4 digits, you make it up)')).toBeTruthy();
    expect(screen.getByText(/Pick a name/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('cloud-login-back'));
    expect(screen.getByText(/Settings → Sign in/)).toBeTruthy();
  });

  it('the Settings request opens the chooser, whose third button closes it (Cancel)', async () => {
    memoryStorage();
    gate();
    await flush();
    act(() => requestCloudSignIn());
    expect(screen.getByTestId('cloud-welcome')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();

    fireEvent.press(screen.getByTestId('cloud-welcome-third'));
    expect(screen.queryByTestId('cloud-welcome')).toBeNull();
    expect(screen.getByTestId('app')).toBeTruthy();
  });
});

describe('CloudGate: a returning visitor without a saved sign-in', () => {
  it('meets the welcome screen first, with Sign in / Create account / Skip, and no app yet', async () => {
    memoryStorage({ [VISITED_KEY]: '1' });
    gate();
    await flush();
    expect(screen.getByTestId('cloud-welcome')).toBeTruthy();
    expect(screen.getByTestId('cloud-welcome-signin')).toBeTruthy();
    expect(screen.getByTestId('cloud-welcome-create')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
    expect(screen.queryByTestId('app')).toBeNull();
  });

  it('Skip goes on as a guest', async () => {
    memoryStorage({ [VISITED_KEY]: '1' });
    gate();
    await flush();
    fireEvent.press(screen.getByTestId('cloud-welcome-third'));
    await flush();
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByTestId('cloud-welcome')).toBeNull();
  });

  it('Sign in and Create account open the matching form, and Back returns to the three buttons', async () => {
    memoryStorage({ [VISITED_KEY]: '1' });
    gate();
    await flush();

    fireEvent.press(screen.getByTestId('cloud-welcome-signin'));
    expect(screen.getByText(/Enter the name and the 4-digit PIN/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('cloud-login-back'));
    expect(screen.getByTestId('cloud-welcome')).toBeTruthy();

    fireEvent.press(screen.getByTestId('cloud-welcome-create'));
    expect(screen.getByText('PIN (4 digits, you make it up)')).toBeTruthy();
  });

  it('signing in from the welcome screen takes the usual restore path', async () => {
    memoryStorage({ [VISITED_KEY]: '1' });
    mockLogin.mockResolvedValue({ ok: true, data: { token: 'tok', displayName: 'Kálmán', created: false, payload: payloadOf({}), updatedAt: 'x', rev: 4 } });
    gate();
    await flush();
    fireEvent.press(screen.getByTestId('cloud-welcome-signin'));
    await signInAs('Kálmán', '1234');
    expect(mockRestore).toHaveBeenCalledWith(payloadOf({}));
    expect(mockStartSync).toHaveBeenCalledWith('tok', 'snap', expect.any(Function), 4);
    expect(screen.getByTestId('app')).toBeTruthy();
  });
});

describe('CloudGate: a saved session', () => {
  it('restores as before: no welcome, no guest offer', async () => {
    memoryStorage({ [SESSION_KEY]: JSON.stringify({ name: 'Kálmán', token: 'tok' }) });
    mockGetProgress.mockResolvedValue({ ok: true, data: { payload: null, updatedAt: null, rev: 2 } });
    gate();
    await flush();
    expect(mockGetProgress).toHaveBeenCalledWith('tok');
    expect(mockStartSync).toHaveBeenCalledWith('tok', 'snap', expect.any(Function), 2);
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByTestId('cloud-welcome')).toBeNull();
    await gradeCards(GUEST_OFFER_AFTER);
    expect(screen.queryByText('Save your progress?')).toBeNull();
  });

  it('a dead token lands on the welcome screen', async () => {
    memoryStorage({ [SESSION_KEY]: JSON.stringify({ name: 'Kálmán', token: 'dead' }) });
    mockGetProgress.mockResolvedValue({ ok: false, error: 'bad_token' });
    gate();
    await flush();
    expect(screen.getByTestId('cloud-welcome')).toBeTruthy();
  });
});

describe('CloudGate: a guest signs in', () => {
  async function toCreateForm() {
    gate();
    await flush();
    await gradeCards(GUEST_OFFER_AFTER);
    fireEvent.press(screen.getByTestId('cloud-ask-yes'));
  }

  it('a new account takes the guest progress over: the sync starts from nothing, no reload, the app stays', async () => {
    const store = memoryStorage();
    mockLogin.mockResolvedValue({ ok: true, data: { token: 'tok', displayName: 'Kálmán', created: true, payload: null, updatedAt: null, rev: 0 } });
    await toCreateForm();
    await signInAs('Kálmán', '1234');

    expect(JSON.parse(store.map.get(SESSION_KEY)!)).toEqual({ name: 'Kálmán', token: 'tok' });
    expect(mockStartSync).toHaveBeenCalledWith('tok', null, expect.any(Function), 0);
    expect(mockPutProgress).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByTestId('cloud-login')).toBeNull();
    expect(loadSession()).toEqual({ name: 'Kálmán', token: 'tok' });
  });

  it('an old account with progress is the merge base: its own fields stay, the guest cards melt in, then the page restarts', async () => {
    memoryStorage();
    const account = payloadOf({
      level: 'account-level',
      streak: { longest_count: 9 },
      pcicCards: [['a', { lastReview: '2026-01-01' }]],
    });
    const guest = payloadOf({
      level: 'guest-default',
      streak: { longest_count: 1 },
      pcicCards: [['b', { lastReview: '2026-02-01' }]],
    });
    mockLogin.mockResolvedValue({ ok: true, data: { token: 'tok', displayName: 'Kálmán', created: false, payload: account, updatedAt: 'x', rev: 7 } });
    mockExportPayload.mockResolvedValue(guest);
    await toCreateForm();
    await signInAs('Kálmán', '1234');

    expect(mockPutProgress).toHaveBeenCalledTimes(1);
    const [token, sent, keepalive, baseRev] = mockPutProgress.mock.calls[0];
    expect([token, keepalive, baseRev]).toEqual(['tok', false, 7]);
    const merged = JSON.parse(JSON.parse(sent).store);
    expect(merged.level).toBe('account-level');
    expect(merged.streak).toEqual({ longest_count: 9 });
    expect(merged.pcicCards.map(([id]: [string]) => id).sort()).toEqual(['a', 'b']);
    expect(loadSession()).toEqual({ name: 'Kálmán', token: 'tok' });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(mockStartSync).not.toHaveBeenCalled();
  });

  it('restarts onto the account even when the merged upload fails', async () => {
    memoryStorage();
    mockLogin.mockResolvedValue({ ok: true, data: { token: 'tok', displayName: 'Kálmán', created: false, payload: payloadOf({}), updatedAt: 'x', rev: 7 } });
    mockExportPayload.mockRejectedValue(new Error('export failed'));
    await toCreateForm();
    await signInAs('Kálmán', '1234');

    expect(mockPutProgress).not.toHaveBeenCalled();
    expect(loadSession()).toEqual({ name: 'Kálmán', token: 'tok' });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('CloudGate: the remembered language', () => {
  afterEach(() => setLanguage('en'));

  it('the welcome screen speaks the language of the last visit', async () => {
    memoryStorage({ [VISITED_KEY]: '1', [UI_LANG_KEY]: 'hu' });
    gate();
    await flush();
    expect(screen.getByTestId('cloud-welcome')).toBeTruthy();
    expect(screen.getByText(hu.cloud.welcomeTitle)).toBeTruthy();
  });

  it('a stored code that is not a UI language leaves English', async () => {
    memoryStorage({ [VISITED_KEY]: '1', [UI_LANG_KEY]: 'xx' });
    gate();
    await flush();
    expect(screen.getByText(en.cloud.welcomeTitle)).toBeTruthy();
  });

  it('setLanguage remembers the code for the next visit', () => {
    const store = memoryStorage();
    setLanguage('es');
    expect(store.map.get(UI_LANG_KEY)).toBe('es');
    expect(rememberedLanguage()).toBe('es');
  });
});
