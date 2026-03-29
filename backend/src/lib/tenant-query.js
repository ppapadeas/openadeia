/**
 * Tenant Query Helper
 *
 * Provides scoped Knex query builders that automatically include tenant_id.
 * Use these helpers instead of raw db(table) calls to ensure tenant isolation.
 *
 * Usage:
 *   import { tenantQuery, requireTenant } from '../lib/tenant-query.js';
 *
 *   // Scoped query (automatically adds WHERE tenant_id = tenantId)
 *   const projects = await tenantQuery(db, 'projects', req.tenantId)
 *     .where('deleted', false)
 *     .orderBy('updated_at', 'desc');
 *
 *   // Assert tenant is present (throws if not)
 *   const tid = requireTenant(req);
 */

import db from '../config/database.js';

/**
 * Returns a Knex query builder scoped to the given tenant.
 * Always adds .where({ tenant_id: tenantId }) as the first condition.
 *
 * @param {import('knex').Knex} knexInstance - The Knex instance (or db)
 * @param {string} table - Table name
 * @param {string} tenantId - Tenant UUID
 * @returns {import('knex').Knex.QueryBuilder}
 */
export function tenantQuery(knexInstance, table, tenantId) {
  if (!tenantId) {
    throw new Error(`tenantQuery: tenantId is required for table "${table}"`);
  }
  return knexInstance(table).where({ tenant_id: tenantId });
}

/**
 * Shorthand using the default db instance.
 * Use when you don't have a custom Knex instance.
 *
 * @param {string} table - Table name
 * @param {string} tenantId - Tenant UUID
 * @returns {import('knex').Knex.QueryBuilder}
 */
export function tq(table, tenantId) {
  return tenantQuery(db, table, tenantId);
}

/**
 * Asserts that req.tenantId is set and returns it.
 * Throws a 401 error if not present.
 *
 * @param {import('fastify').FastifyRequest} req
 * @returns {string} tenantId UUID
 */
export function requireTenant(req) {
  if (!req.tenantId) {
    const err = new Error('Tenant not resolved on request');
    err.statusCode = 401;
    throw err;
  }
  return req.tenantId;
}

/**
 * Builds a scoped query using req.tenantId directly.
 * Convenience wrapper for use inside route handlers.
 *
 * @param {import('fastify').FastifyRequest} req
 * @param {string} table - Table name
 * @returns {import('knex').Knex.QueryBuilder}
 */
export function scopedQuery(req, table) {
  const tenantId = requireTenant(req);
  return db(table).where({ tenant_id: tenantId });
}

/**
 * Wraps an insert operation to automatically add tenant_id.
 *
 * @param {string} table - Table name
 * @param {string} tenantId - Tenant UUID
 * @param {object|object[]} data - Row(s) to insert
 * @returns {import('knex').Knex.QueryBuilder}
 */
export function tenantInsert(table, tenantId, data) {
  if (!tenantId) {
    throw new Error(`tenantInsert: tenantId is required for table "${table}"`);
  }
  const rows = Array.isArray(data)
    ? data.map(row => ({ ...row, tenant_id: tenantId }))
    : { ...data, tenant_id: tenantId };
  return db(table).insert(rows);
}
