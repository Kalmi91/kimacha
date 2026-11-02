import { getProgress, login, putProgress } from '../api';

const mockFetch = jest.fn();

function answer(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  mockFetch.mockReset();
  (globalThis as any).fetch = mockFetch;
});

describe('cloud api', () => {
  it('login posts the name and PIN as JSON to the relative URL', async () => {
    const data = { token: 't', displayName: 'Kálmán', created: true, payload: null, updatedAt: null, rev: 0 };
    mockFetch.mockResolvedValue(answer(200, data));
    expect(await login('Kálmán', '1234')).toEqual({ ok: true, data });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Kálmán', pin: '1234' });
  });

  it('getProgress sends the bearer token', async () => {
    mockFetch.mockResolvedValue(answer(200, { payload: '{}', updatedAt: 'x', rev: 3 }));
    expect(await getProgress('tok')).toEqual({ ok: true, data: { payload: '{}', updatedAt: 'x', rev: 3 } });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/progress');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('putProgress wraps the payload string and keeps keepalive for small bodies only', async () => {
    mockFetch.mockResolvedValue(answer(200, { updatedAt: 'x' }));
    await putProgress('tok', '{"a":1}', true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/progress');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ payload: '{"a":1}' });
    expect(init.keepalive).toBe(true);
    await putProgress('tok', 'x'.repeat(30000), true);
    expect(mockFetch.mock.calls[1][1].keepalive).toBe(false);
    await putProgress('tok', '{}');
    expect(mockFetch.mock.calls[2][1].keepalive).toBe(false);
  });

  it('putProgress says the revision it is based on, and sends no rev field without one', async () => {
    mockFetch.mockResolvedValue(answer(200, { updatedAt: 'x', rev: 4 }));
    expect(await putProgress('tok', '{}', false, 3)).toEqual({ ok: true, data: { updatedAt: 'x', rev: 4 } });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ payload: '{}', rev: 3 });
    await putProgress('tok', '{}', false, 0);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ payload: '{}', rev: 0 });
    await putProgress('tok', '{}');
    expect(JSON.parse(mockFetch.mock.calls[2][1].body)).toEqual({ payload: '{}' });
  });

  it('answers conflict with the state the server holds now (409)', async () => {
    mockFetch.mockResolvedValue(answer(409, { error: 'conflict', payload: '{"a":1}', updatedAt: 'x', rev: 7 }));
    expect(await putProgress('tok', '{}', false, 6)).toEqual({ ok: false, error: 'conflict', current: { payload: '{"a":1}', updatedAt: 'x', rev: 7 } });
  });

  it('answers conflict without a state when the 409 body has no rev', async () => {
    mockFetch.mockResolvedValue(answer(409, { error: 'conflict' }));
    expect(await putProgress('tok', '{}', false, 6)).toEqual({ ok: false, error: 'conflict' });
  });

  it('answers network when fetch itself fails', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await login('Kálmán', '1234')).toEqual({ ok: false, error: 'network' });
  });

  it.each([
    [400, 'bad_input'],
    [401, 'bad_pin'],
    [401, 'bad_token'],
    [413, 'too_large'],
  ])('maps %s %s to the same code', async (status, code) => {
    mockFetch.mockResolvedValue(answer(status, { error: code }));
    expect(await getProgress('tok')).toEqual({ ok: false, error: code });
  });

  it('carries retryAfterSec of a locked account', async () => {
    mockFetch.mockResolvedValue(answer(429, { error: 'locked', retryAfterSec: 840 }));
    expect(await login('Kálmán', '1234')).toEqual({ ok: false, error: 'locked', retryAfterSec: 840 });
  });

  it('answers server for an unknown code, a non-JSON body, or a 200 that is not an object', async () => {
    mockFetch.mockResolvedValueOnce(answer(500, { error: 'boom' }));
    expect(await getProgress('tok')).toEqual({ ok: false, error: 'server' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) });
    expect(await getProgress('tok')).toEqual({ ok: false, error: 'server' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => Promise.reject(new Error('html')) });
    expect(await getProgress('tok')).toEqual({ ok: false, error: 'server' });
  });
});
