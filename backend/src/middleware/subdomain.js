/**
 * Subdomain Middleware — Tenant Slug Extraction
 *
 * Extracts tenant slug from the request's Host header subdomain.
 *
 * Examples:
 *   forma.openadeia.gr → 'forma'
 *   app.openadeia.gr   → null  (reserved subdomain)
 *   www.openadeia.gr   → null  (reserved subdomain)
 *   api.openadeia.gr   → null  (reserved subdomain)
 *   openadeia.gr       → null  (no subdomain)
 *   localhost:3000     → req.headers['x-tenant-slug'] or null
 *   192.168.1.1        → req.headers['x-tenant-slug'] or null
 */

/**
 * Reserved subdomains that do not map to a tenant.
 */
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api']);

/**
 * Extracts the tenant slug from the request Host header.
 * Falls back to the X-Tenant-Slug header for localhost/IP environments.
 *
 * @param {import('fastify').FastifyRequest} request
 * @returns {string|null} tenant slug or null
 */
export function extractTenantSlug(request) {
  const host = request.headers?.host || '';

  // Strip port if present (e.g. localhost:3000 → localhost, forma.openadeia.gr:443 → forma.openadeia.gr)
  const hostname = host.split(':')[0];

  // For localhost or bare IP addresses, fall back to header
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  ) {
    return request.headers['x-tenant-slug'] || null;
  }

  // Extract subdomain from FQDN: forma.openadeia.gr → parts = ['forma', 'openadeia', 'gr']
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];

    // Skip reserved subdomains
    if (RESERVED_SUBDOMAINS.has(subdomain)) {
      return null;
    }

    return subdomain;
  }

  // No subdomain (e.g. openadeia.gr with only 2 parts)
  return null;
}
