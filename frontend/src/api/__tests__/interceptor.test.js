/**
 * API interceptor tests
 *
 * Verifies that:
 * 1. JWT token is attached to every request
 * 2. 401 responses trigger auto-logout (clear localStorage + redirect to /login)
 * 3. Non-401 errors just reject with the error message (no logout)
 * 4. 422 from TEE route does NOT trigger logout (regression for TEE sync bug)
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';

// We import the actual axios instance from our api module
// Since the module sets up interceptors on import, we need it loaded fresh
let api;
let mockAxios;

// Stub browser globals
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, val) => { store[key] = val; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: () => store,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'window', {
  value: { location: { href: '', pathname: '/projects' } },
  writable: true,
});

// Import the axios instance and wrap with mock adapter
import axiosLib from 'axios';

const mock = new MockAdapter(axiosLib);

beforeEach(() => {
  mock.reset();
  localStorageMock.clear();
  vi.clearAllMocks();
  globalThis.window.location.href = '';
  globalThis.window.location.pathname = '/projects';
});

afterEach(() => {
  mock.reset();
});

describe('API request interceptor', () => {
  it('attaches Authorization header when token is in localStorage', async () => {
    localStorageMock.getItem.mockImplementation((key) => key === 'token' ? 'my-jwt-token' : null);
    mock.onGet('/api/projects').reply(200, { data: [] });

    // Import fresh api module
    const { default: api } = await import('../index.js');
    await api.get('/api/projects').catch(() => {});

    const request = mock.history.get[0];
    expect(request?.headers?.Authorization).toBe('Bearer my-jwt-token');
  });

  it('does not attach Authorization header when no token', async () => {
    localStorageMock.getItem.mockReturnValue(null);
    mock.onGet('/api/test').reply(200, {});

    const { default: api } = await import('../index.js');
    await api.get('/api/test').catch(() => {});

    const request = mock.history.get[0];
    expect(request?.headers?.Authorization).toBeUndefined();
  });
});

describe('API response interceptor — 401 auto-logout', () => {
  it('clears localStorage and redirects to /login on 401', async () => {
    mock.onGet('/api/protected').reply(401, { error: 'Δεν είστε συνδεδεμένος' });

    const { default: api } = await import('../index.js');
    await api.get('/api/protected').catch(() => {});

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(globalThis.window.location.href).toBe('/login');
  });

  it('does NOT redirect to /login when already on /login (avoids redirect loop)', async () => {
    globalThis.window.location.pathname = '/login';
    mock.onPost('/api/auth/login').reply(401, { error: 'Λάθος password' });

    const { default: api } = await import('../index.js');
    await api.post('/api/auth/login', {}).catch(() => {});

    expect(globalThis.window.location.href).not.toBe('/login');
  });

  it('rejects with the error message from the response body', async () => {
    mock.onGet('/api/test').reply(401, { error: 'Custom error message' });

    const { default: api } = await import('../index.js');
    const error = await api.get('/api/test').catch((e) => e);

    expect(error.message).toBe('Custom error message');
  });
});

describe('API response interceptor — 422 does NOT logout', () => {
  it('422 from TEE sync does not trigger auto-logout', async () => {
    // This is the regression test: TEE portal login failure returns 422.
    // Before the fix in tee.js, it returned 401, causing logout.
    mock.onPost('/api/tee/sync').reply(422, {
      error: 'Αδυναμία σύνδεσης στο ΤΕΕ e-Adeies. Ελέγξτε το username/password.',
    });

    const { default: api } = await import('../index.js');
    const error = await api.post('/api/tee/sync').catch((e) => e);

    expect(error.message).toContain('ΤΕΕ');
    // Should NOT have cleared localStorage
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('token');
    // Should NOT have redirected to /login
    expect(globalThis.window.location.href).not.toBe('/login');
  });

  it('500 server error does not logout', async () => {
    mock.onGet('/api/projects').reply(500, { error: 'Internal Server Error' });

    const { default: api } = await import('../index.js');
    await api.get('/api/projects').catch(() => {});

    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('token');
  });
});
