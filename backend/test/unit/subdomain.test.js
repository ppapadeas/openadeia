import { describe, it, expect } from 'vitest';
import { extractTenantSlug } from '../../src/middleware/subdomain.js';

/**
 * Helper: build a minimal Fastify-like request object with given host and optional headers.
 */
function makeReq(host, extraHeaders = {}) {
  return {
    headers: {
      host,
      ...extraHeaders,
    },
  };
}

// ── FQDN subdomain extraction ───────────────────────────────────────────────

describe('extractTenantSlug — FQDN', () => {
  it('forma.openadeia.gr → "forma"', () => {
    expect(extractTenantSlug(makeReq('forma.openadeia.gr'))).toBe('forma');
  });

  it('myoffice.openadeia.gr → "myoffice"', () => {
    expect(extractTenantSlug(makeReq('myoffice.openadeia.gr'))).toBe('myoffice');
  });

  it('a-b-c.openadeia.gr → "a-b-c"', () => {
    expect(extractTenantSlug(makeReq('a-b-c.openadeia.gr'))).toBe('a-b-c');
  });
});

// ── Reserved subdomains → null ──────────────────────────────────────────────

describe('extractTenantSlug — reserved subdomains', () => {
  it('www.openadeia.gr → null', () => {
    expect(extractTenantSlug(makeReq('www.openadeia.gr'))).toBeNull();
  });

  it('app.openadeia.gr → null', () => {
    expect(extractTenantSlug(makeReq('app.openadeia.gr'))).toBeNull();
  });

  it('api.openadeia.gr → null', () => {
    expect(extractTenantSlug(makeReq('api.openadeia.gr'))).toBeNull();
  });
});

// ── No subdomain ────────────────────────────────────────────────────────────

describe('extractTenantSlug — no subdomain', () => {
  it('openadeia.gr (apex) → null', () => {
    expect(extractTenantSlug(makeReq('openadeia.gr'))).toBeNull();
  });

  it('example.com (apex) → null', () => {
    expect(extractTenantSlug(makeReq('example.com'))).toBeNull();
  });
});

// ── Localhost / IP → header fallback ───────────────────────────────────────

describe('extractTenantSlug — localhost', () => {
  it('localhost (no header) → null', () => {
    expect(extractTenantSlug(makeReq('localhost'))).toBeNull();
  });

  it('localhost:3000 (no header) → null', () => {
    expect(extractTenantSlug(makeReq('localhost:3000'))).toBeNull();
  });

  it('localhost with X-Tenant-Slug header → slug from header', () => {
    expect(
      extractTenantSlug(makeReq('localhost', { 'x-tenant-slug': 'forma' }))
    ).toBe('forma');
  });

  it('localhost:3000 with X-Tenant-Slug header → slug from header', () => {
    expect(
      extractTenantSlug(makeReq('localhost:3000', { 'x-tenant-slug': 'testco' }))
    ).toBe('testco');
  });

  it('127.0.0.1 with X-Tenant-Slug header → slug from header', () => {
    expect(
      extractTenantSlug(makeReq('127.0.0.1', { 'x-tenant-slug': 'acme' }))
    ).toBe('acme');
  });

  it('192.168.1.10 (private IP, no header) → null', () => {
    expect(extractTenantSlug(makeReq('192.168.1.10'))).toBeNull();
  });

  it('192.168.1.10:8080 with header → slug from header', () => {
    expect(
      extractTenantSlug(makeReq('192.168.1.10:8080', { 'x-tenant-slug': 'dev-tenant' }))
    ).toBe('dev-tenant');
  });
});

// ── Port stripping on FQDN ──────────────────────────────────────────────────

describe('extractTenantSlug — port stripping', () => {
  it('forma.openadeia.gr:443 → "forma"', () => {
    expect(extractTenantSlug(makeReq('forma.openadeia.gr:443'))).toBe('forma');
  });

  it('app.openadeia.gr:8443 → null (reserved)', () => {
    expect(extractTenantSlug(makeReq('app.openadeia.gr:8443'))).toBeNull();
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('extractTenantSlug — edge cases', () => {
  it('empty host → null', () => {
    expect(extractTenantSlug(makeReq(''))).toBeNull();
  });

  it('missing headers object → null', () => {
    expect(extractTenantSlug({})).toBeNull();
  });

  it('null headers → null', () => {
    expect(extractTenantSlug({ headers: null })).toBeNull();
  });
});
