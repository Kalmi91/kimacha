// The web funnel client: what it sends to /api/event and when. localStorage is a plain in-memory stand-in, sendEvent is mocked.
import { Platform } from 'react-native';
import * as funnel from '../funnel';
import { noteCardGraded, resetGuestStateForTests } from '../guest';

const mockSend = jest.fn<Promise<boolean>, [string, string]>();
jest.mock('../api', () => ({ sendEvent: (event: string, src: string) => mockSend(event, src) }));

let store: Map<string, string>;

const DAY1 = new Date(2026, 10, 20, 12);
const DAY2 = new Date(2026, 10, 21, 12);
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const sent = () => mockSend.mock.calls.map((c) => c[0]);

// A reload: the module state and the guest card counter start over, localStorage stays.
function reload() {
  funnel.resetFunnelForTests();
  resetGuestStateForTests();
}

beforeEach(() => {
  store = new Map();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  mockSend.mockReset();
  mockSend.mockResolvedValue(true);
  (Platform as any).OS = 'web';
  reload();
});

afterEach(() => {
  reload();
  delete (globalThis as any).localStorage;
});

describe('first touch', () => {
  it('keeps the first src and does not overwrite it with a later one', async () => {
    funnel.initFunnel('?src=grp-a', DAY1);
    await flush();
    reload();
    funnel.initFunnel('?src=grp-b', DAY1);
    expect(store.get('kimacha.funnel.src')).toBe('grp-a');
    expect(mockSend).toHaveBeenCalledWith('open', 'grp-a');
  });

  it('stores direct for an invalid or missing src', () => {
    funnel.initFunnel('?src=BAD%20one', DAY1);
    expect(store.get('kimacha.funnel.src')).toBe('direct');
    store.clear();
    reload();
    funnel.initFunnel('', DAY1);
    expect(store.get('kimacha.funnel.src')).toBe('direct');
  });

  it('stores the first local day once', () => {
    funnel.initFunnel('', DAY1);
    reload();
    funnel.initFunnel('', DAY2);
    expect(store.get('kimacha.funnel.firstDay')).toBe('2026-11-20');
  });
});

describe('open and return', () => {
  it('sends open once across two init calls and across a reload', async () => {
    funnel.initFunnel('?src=a', DAY1);
    funnel.initFunnel('?src=a', DAY1);
    await flush();
    reload();
    funnel.initFunnel('?src=a', DAY1);
    await flush();
    expect(sent()).toEqual(['open']);
    expect(store.get('kimacha.funnel.sent.open')).toBe('1');
  });

  it('retries a failed send on the next load and does not flag it', async () => {
    mockSend.mockResolvedValue(false);
    funnel.initFunnel('?src=a', DAY1);
    await flush();
    expect(store.has('kimacha.funnel.sent.open')).toBe(false);
    mockSend.mockResolvedValue(true);
    reload();
    funnel.initFunnel('?src=a', DAY1);
    await flush();
    expect(sent()).toEqual(['open', 'open']);
    expect(store.get('kimacha.funnel.sent.open')).toBe('1');
  });

  it('does not start a second send of an event while one is in flight', () => {
    let done!: (ok: boolean) => void;
    mockSend.mockReturnValue(new Promise((r) => (done = r)));
    funnel.initFunnel('', DAY1);
    funnel.noteFunnel('start');
    funnel.noteFunnel('start');
    expect(sent()).toEqual(['open', 'start']);
    done(true);
  });

  it('sends return only on a later local day, once', async () => {
    funnel.initFunnel('', DAY1);
    await flush();
    expect(sent()).toEqual(['open']);
    reload();
    funnel.initFunnel('', DAY2);
    await flush();
    expect(sent()).toEqual(['open', 'return']);
    reload();
    funnel.initFunnel('', DAY2);
    await flush();
    expect(sent()).toEqual(['open', 'return']);
  });
});

describe('cards5 and the noted events', () => {
  it('sends cards5 after 5 graded cards counted across a reload (3 + 2), once', async () => {
    funnel.initFunnel('', DAY1);
    for (let i = 0; i < 3; i++) noteCardGraded();
    await flush();
    expect(sent()).not.toContain('cards5');
    expect(store.get('kimacha.funnel.cards')).toBe('3');
    reload();
    funnel.initFunnel('', DAY1);
    noteCardGraded();
    noteCardGraded();
    await flush();
    expect(sent().filter((e) => e === 'cards5')).toHaveLength(1);
    noteCardGraded();
    await flush();
    expect(sent().filter((e) => e === 'cards5')).toHaveLength(1);
    expect(store.get('kimacha.funnel.cards')).toBe('5');
  });

  it('sends account and start once each', async () => {
    funnel.initFunnel('?src=a', DAY1);
    funnel.noteFunnel('account');
    await flush();
    funnel.noteFunnel('account');
    funnel.noteFunnel('start');
    await flush();
    funnel.noteFunnel('start');
    expect(sent().filter((e) => e === 'account')).toHaveLength(1);
    expect(sent().filter((e) => e === 'start')).toHaveLength(1);
    expect(mockSend).toHaveBeenCalledWith('account', 'a');
  });
});

describe('storage that cannot be used', () => {
  it('counts nothing when localStorage refuses writes', async () => {
    (globalThis as any).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    funnel.initFunnel('?src=a', DAY1);
    funnel.noteFunnel('start');
    funnel.noteFunnel('account');
    for (let i = 0; i < 5; i++) noteCardGraded();
    await flush();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('counts nothing when there is no localStorage', async () => {
    delete (globalThis as any).localStorage;
    funnel.initFunnel('?src=a', DAY1);
    funnel.noteFunnel('start');
    for (let i = 0; i < 5; i++) noteCardGraded();
    await flush();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('not on the web', () => {
  it('sends and stores nothing', async () => {
    (Platform as any).OS = 'android';
    funnel.initFunnel('?src=a', DAY2);
    funnel.noteFunnel('start');
    funnel.noteFunnel('account');
    noteCardGraded();
    await flush();
    expect(mockSend).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });
});
