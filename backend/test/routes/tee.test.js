/**
 * TEE route tests
 *
 * Key regression: POST /api/tee/sync must return 422 (not 401) when
 * TEE portal credentials are wrong. A 401 would trigger the frontend
 * auto-logout interceptor and sign the user out of OpenAdeia itself.
 */
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

// ── Mock Sentry (no-op in tests) ────────────────────────────────────
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  default: { captureException: vi.fn(), init: vi.fn() },
}));

// ── Mock the database ────────────────────────────────────────────────
// vi.hoisted ensures these are created before any module imports.
const { mockDb, mockChain } = vi.hoisted(() => {
  const mockChain = {
    where: vi.fn().mockReturnThis(),
    whereNotNull: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockReturnThis(),
    pluck: vi.fn().mockResolvedValue([]),
  };
  const mockDb = Object.assign(vi.fn(() => mockChain), {
    fn: { now: vi.fn(() => new Date().toISOString()) },
  });
  return { mockDb, mockChain };
});

vi.mock('../../src/config/database.js', () => ({ default: mockDb }));

// ── Mock the TeeClient ───────────────────────────────────────────────
const { MockTeeClient } = vi.hoisted(() => {
  class MockTeeClient {
    constructor() {
      this.loginFn = vi.fn().mockResolvedValue({ ok: true });
      this.fetchFn = vi.fn().mockResolvedValue([]);
      this.fetchDetailsFn = vi.fn().mockResolvedValue(null);
    }
    login() { return this.loginFn(); }
    fetchMyApplications() { return this.fetchFn(); }
    fetchApplicationDetails(code) { return this.fetchDetailsFn(code); }
  }
  return { MockTeeClient };
});

// We'll control the mock instance via a module-level variable
let teeClientInstance;
vi.mock('../../src/services/tee-client.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TeeClient: vi.fn().mockImplementation((...args) => {
      teeClientInstance = new MockTeeClient(...args);
      return teeClientInstance;
    }),
  };
});

// ── Import app after mocks are set up ────────────────────────────────
import { buildApp } from '../../src/app.js';
import { encryptTeePassword } from '../../src/routes/auth.js';

// ── Helper: create authenticated user + JWT ──────────────────────────
function userWithTee(app) {
  const token = app.jwt.sign({ id: 1 });
  const headers = { authorization: `Bearer ${token}` };
  // Mock a user row with TEE credentials configured
  mockChain.first.mockResolvedValueOnce({
    id: 1,
    tee_username: 'engineer@tee.gr',
    tee_password_enc: encryptTeePassword('correct-pass'),
  });
  return { token, headers };
}

// ═════════════════════════════════════════════════════════════════════
// GET /api/tee/status
// ═════════════════════════════════════════════════════════════════════

describe('GET /api/tee/status', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without JWT', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tee/status' });
    expect(res.statusCode).toBe(401);
  });

  it('returns configured:false when user has no TEE credentials', async () => {
    mockChain.first.mockResolvedValueOnce({ tee_username: null, tee_password_enc: null });
    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'GET',
      url: '/api/tee/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ configured: false });
  });

  it('returns configured:true when user has TEE credentials', async () => {
    mockChain.first.mockResolvedValueOnce({
      tee_username: 'engineer@tee.gr',
      tee_password_enc: encryptTeePassword('secret123'),
    });
    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'GET',
      url: '/api/tee/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ configured: true, tee_username: 'engineer@tee.gr' });
  });
});

// ═════════════════════════════════════════════════════════════════════
// POST /api/tee/sync
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/tee/sync', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without JWT (own auth, expected)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tee/sync' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 422 when user has no TEE credentials configured', async () => {
    mockChain.first.mockResolvedValueOnce({ tee_username: null, tee_password_enc: null });
    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/sync',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
  });

  it('returns 422 (NOT 401) when TEE portal login fails', async () => {
    // This is the critical regression test.
    // fetchMyApplications() throws with err.credentialError = true when OAM
    // rejects credentials. The route must return 422, never 401
    // (a 401 would trigger the frontend auto-logout interceptor).
    mockChain.first.mockResolvedValueOnce({
      id: 1,
      tee_username: 'engineer@tee.gr',
      tee_password_enc: encryptTeePassword('wrong-password'),
    });

    const credErr = new Error('Αδυναμία σύνδεσης στο ΤΕΕ e-Adeies. Ελέγξτε username και κωδικό.');
    credErr.credentialError = true;

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      fetchMyApplications: vi.fn().mockRejectedValue(credErr),
    }));

    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/sync',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    expect(res.statusCode).not.toBe(401); // Must NEVER return 401 for TEE failures
  });

  it('returns 502 for non-credential TEE errors', async () => {
    mockChain.first.mockResolvedValueOnce({
      id: 1,
      tee_username: 'engineer@tee.gr',
      tee_password_enc: encryptTeePassword('correct-pass'),
    });

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      fetchMyApplications: vi.fn().mockRejectedValue(
        new Error('Αδυναμία εκκίνησης headless browser'),
      ),
    }));

    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/sync',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain('headless browser');
  });

  it('returns application list on success', async () => {
    mockChain.first.mockResolvedValueOnce({
      id: 1,
      tee_username: 'engineer@tee.gr',
      tee_password_enc: encryptTeePassword('correct-pass'),
    });
    mockChain.pluck.mockResolvedValueOnce([]);

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      login: vi.fn().mockResolvedValue({ ok: true }),
      fetchMyApplications: vi.fn().mockResolvedValue([
        {
          tee_permit_code: 'TEE-2024-001',
          title: 'Νέα Οικοδομική Άδεια',
          aitisi_type_code: 1,
          is_continuation: false,
          address: 'Οδός Δοκιμής 1',
          city: 'Αθήνα',
        },
      ]),
    }));

    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/sync',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(1);
    expect(body.applications[0].tee_permit_code).toBe('TEE-2024-001');
    expect(body.applications[0].already_imported).toBe(false);
  });

  it('marks already-imported applications', async () => {
    mockChain.first.mockResolvedValueOnce({
      id: 1,
      tee_username: 'engineer@tee.gr',
      tee_password_enc: encryptTeePassword('correct-pass'),
    });
    // Simulate one already-imported permit
    mockChain.pluck.mockResolvedValueOnce(['2024/001']);

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      fetchMyApplications: vi.fn().mockResolvedValue([
        { tee_permit_code: '2024/001', title: 'Existing' },
        { tee_permit_code: '2024/002', title: 'New' },
      ]),
    }));

    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/sync',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const { applications } = res.json();
    expect(applications).toHaveLength(2);
    expect(applications.find(a => a.tee_permit_code === '2024/001').already_imported).toBe(true);
    expect(applications.find(a => a.tee_permit_code === '2024/002').already_imported).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// POST /api/tee/import
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/tee/import', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      payload: { applications: [] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when applications array is empty', async () => {
    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      headers: { authorization: `Bearer ${token}` },
      payload: { applications: [] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('αιτήσεις');
  });

  it('returns 400 when applications is not an array', async () => {
    const token = app.jwt.sign({ id: 1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      headers: { authorization: `Bearer ${token}` },
      payload: { applications: 'not-an-array' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('imports a new TEE application as project', async () => {
    const token = app.jwt.sign({ id: 1 });

    // Mock: db('projects').count
    mockChain.count.mockReturnValueOnce([{ count: 0 }]);

    // For the duplicate check: db('projects').where({ tee_permit_code: ... }).first()
    // Returns null (not imported yet)
    mockChain.first.mockResolvedValueOnce(null);

    // For db('projects').insert(...).returning('*')
    mockChain.returning.mockResolvedValueOnce([{
      id: 42,
      code: 'PRJ-2026-001',
      title: 'Νέα Οικοδομική Άδεια',
      type: 'new_building',
      stage: 'data_collection',
      tee_permit_code: '2024/12345',
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        applications: [{
          tee_permit_code: '2024/12345',
          title: 'Νέα Οικοδομική Άδεια',
          aitisi_type_code: 1,
          is_continuation: false,
          tee_status: '',
          tee_status_code: '',
          address: 'Σταδίου 1',
          city: 'Αθήνα',
          kaek: '050102030040',
        }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.imported).toBe(1);
    expect(body.results[0].action).toBe('imported');
    expect(body.results[0].tee_permit_code).toBe('2024/12345');

    // Verify project insert was called
    expect(mockDb).toHaveBeenCalledWith('projects');
    // Verify property was inserted (since address + kaek are present)
    expect(mockDb).toHaveBeenCalledWith('properties');
    // Verify workflow log was created
    expect(mockDb).toHaveBeenCalledWith('workflow_logs');
  });

  it('skips already-imported applications', async () => {
    const token = app.jwt.sign({ id: 1 });

    // Mock: db('projects').count
    mockChain.count.mockReturnValueOnce([{ count: 5 }]);

    // The duplicate check returns an existing project
    mockChain.first.mockResolvedValueOnce({
      id: 99,
      tee_permit_code: '2024/12345',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        applications: [{
          tee_permit_code: '2024/12345',
          title: 'Already imported',
        }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.imported).toBe(0);
    expect(body.results[0].action).toBe('skipped');
    expect(body.results[0].id).toBe(99);
  });

  it('imports application without address (no property created)', async () => {
    const token = app.jwt.sign({ id: 1 });

    mockChain.count.mockReturnValueOnce([{ count: 0 }]);
    mockChain.first.mockResolvedValueOnce(null);
    mockChain.returning.mockResolvedValueOnce([{
      id: 43,
      code: 'PRJ-2026-001',
      tee_permit_code: '2024/99999',
    }]);

    // Track calls to insert
    const insertCalls = [];
    mockDb.mockImplementation((table) => {
      insertCalls.push(table);
      return mockChain;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        applications: [{
          tee_permit_code: '2024/99999',
          title: 'Χωρίς διεύθυνση',
          address: '',
          kaek: '',
        }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().imported).toBe(1);
    // properties table should NOT be called when no address/kaek
    expect(insertCalls).not.toContain('properties');
  });

  it('maps TEE status to correct stage during import', async () => {
    const token = app.jwt.sign({ id: 1 });

    mockChain.count.mockReturnValueOnce([{ count: 0 }]);
    mockChain.first.mockResolvedValueOnce(null);

    let insertedProject;
    mockChain.insert.mockImplementation((data) => {
      if (data.tee_permit_code) insertedProject = data;
      return mockChain;
    });
    mockChain.returning.mockResolvedValueOnce([{
      id: 50,
      code: 'PRJ-2026-001',
      tee_permit_code: '2024/55555',
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        applications: [{
          tee_permit_code: '2024/55555',
          title: 'Εγκεκριμένη Άδεια',
          aitisi_type_code: 1,
          tee_status: 'εγκρίθηκε',
          tee_status_code: '5',
          is_continuation: false,
        }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(insertedProject).toBeDefined();
    expect(insertedProject.stage).toBe('approved');
    expect(insertedProject.type).toBe('new_building');
  });

  it('maps continuation type codes correctly', async () => {
    const token = app.jwt.sign({ id: 1 });

    mockChain.count.mockReturnValueOnce([{ count: 0 }]);
    mockChain.first.mockResolvedValueOnce(null);

    let insertedProject;
    mockChain.insert.mockImplementation((data) => {
      if (data.tee_permit_code) insertedProject = data;
      return mockChain;
    });
    mockChain.returning.mockResolvedValueOnce([{
      id: 51,
      code: 'PRJ-2026-001',
      tee_permit_code: '2024/66666',
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/import',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        applications: [{
          tee_permit_code: '2024/66666',
          title: 'Αναθεώρηση Επέκτασης',
          aitisi_type_code: 4,
          is_continuation: true,
          tee_status: 'μελέτες',
        }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(insertedProject.type).toBe('revision_ext');
    expect(insertedProject.is_continuation).toBe(true);
    expect(insertedProject.stage).toBe('studies');
  });
});

// ═════════════════════════════════════════════════════════════════════
// POST /api/tee/refresh/:id
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/tee/refresh/:id', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => { await app?.close(); });

  it('returns 401 without JWT', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tee/refresh/1' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when project does not exist', async () => {
    const token = app.jwt.sign({ id: 1 });
    // first() returns null for project lookup
    mockChain.first.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/refresh/999',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when project has no tee_permit_code', async () => {
    const token = app.jwt.sign({ id: 1 });
    mockChain.first.mockResolvedValueOnce({ id: 1, tee_permit_code: null });

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/refresh/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 422 when user has no TEE credentials', async () => {
    const token = app.jwt.sign({ id: 1 });
    // First call: project lookup
    mockChain.first
      .mockResolvedValueOnce({ id: 1, tee_permit_code: '2024/001', stage: 'studies' })
      // Second call: user lookup
      .mockResolvedValueOnce({ id: 1, tee_username: null, tee_password_enc: null });

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/refresh/1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
  });

  it('returns updated:false when stage has not changed', async () => {
    const token = app.jwt.sign({ id: 1 });
    // Project lookup
    mockChain.first
      .mockResolvedValueOnce({
        id: 1,
        tee_permit_code: '2024/001',
        stage: 'review',
      })
      // User lookup
      .mockResolvedValueOnce({
        id: 1,
        tee_username: 'engineer@tee.gr',
        tee_password_enc: encryptTeePassword('pass123'),
      });

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      login: vi.fn().mockResolvedValue(undefined),
      fetchApplicationDetails: vi.fn().mockResolvedValue({
        tee_status: 'ελέγχεται',
        tee_status_code: '4',
      }),
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/refresh/1',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      updated: false,
      stage: 'review',
    });
  });

  it('updates stage and logs when TEE status changed', async () => {
    const token = app.jwt.sign({ id: 1 });
    mockChain.first
      .mockResolvedValueOnce({
        id: 1,
        tee_permit_code: '2024/001',
        stage: 'review', // was in review
      })
      .mockResolvedValueOnce({
        id: 1,
        tee_username: 'engineer@tee.gr',
        tee_password_enc: encryptTeePassword('pass123'),
      });

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      login: vi.fn().mockResolvedValue(undefined),
      fetchApplicationDetails: vi.fn().mockResolvedValue({
        tee_status: 'εγκρίθηκε', // now approved
        tee_status_code: '5',
      }),
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/refresh/1',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      updated: true,
      stage: 'approved',
      tee_status: 'εγκρίθηκε',
    });

    // Verify that project update and workflow log insert were called
    expect(mockDb).toHaveBeenCalledWith('projects');
    expect(mockDb).toHaveBeenCalledWith('workflow_logs');
  });

  it('returns 404 when TEE does not find the permit', async () => {
    const token = app.jwt.sign({ id: 1 });
    mockChain.first
      .mockResolvedValueOnce({
        id: 1,
        tee_permit_code: '2024/001',
        stage: 'studies',
      })
      .mockResolvedValueOnce({
        id: 1,
        tee_username: 'engineer@tee.gr',
        tee_password_enc: encryptTeePassword('pass123'),
      });

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      login: vi.fn().mockResolvedValue(undefined),
      fetchApplicationDetails: vi.fn().mockResolvedValue(null),
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/refresh/1',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('ΤΕΕ');
  });

  it('returns 502 when TEE client throws', async () => {
    const token = app.jwt.sign({ id: 1 });
    mockChain.first
      .mockResolvedValueOnce({
        id: 1,
        tee_permit_code: '2024/001',
        stage: 'studies',
      })
      .mockResolvedValueOnce({
        id: 1,
        tee_username: 'engineer@tee.gr',
        tee_password_enc: encryptTeePassword('pass123'),
      });

    const { TeeClient } = await import('../../src/services/tee-client.js');
    TeeClient.mockImplementationOnce(() => ({
      login: vi.fn().mockRejectedValue(new Error('TEE portal unreachable')),
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/tee/refresh/1',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain('TEE portal unreachable');
  });
});
