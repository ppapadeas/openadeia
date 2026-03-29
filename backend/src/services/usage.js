/**
 * Usage Tracking Service
 *
 * Phase 4: Metering & Limits
 *
 * In Phase 4 (single-tenant / pre-tenants-table), we track usage by:
 *   - projects_count: live COUNT from DB (authoritative, no drift)
 *   - storage_used_bytes: tracked in a synthetic tenant record (key-value in settings table,
 *     or computed from documents table as fallback)
 *
 * The tenant plan comes from TENANT_PLAN env var (default: self_hosted).
 *
 * When the full multi-tenancy phase adds a `tenants` table with usage JSONB,
 * this service can be updated to read/write from that table.
 */

import db from '../config/database.js';
import { getLimitsForPlan } from '../config/plans.js';
import { LimitExceededError } from '../errors/LimitExceededError.js';

/** Get current tenant plan from env */
function getCurrentPlan() {
  return process.env.TENANT_PLAN || 'self_hosted';
}

/** Get current tenant ID (single-tenant Phase 4) */
export function getCurrentTenantId() {
  return 'default';
}

/**
 * Get the current project count from DB.
 * Always computed live — prevents count drift.
 */
async function getProjectCount() {
  const [{ count }] = await db('projects')
    .where({ deleted: false })
    .count('id as count');
  return Number(count);
}

/**
 * Get storage used (bytes).
 * Computed as SUM of file_size from documents table.
 */
async function getStorageUsedBytes() {
  const [{ total }] = await db('documents')
    .sum('file_size as total');
  return Number(total) || 0;
}

// ── Counter helpers ────────────────────────────────────────────────────

/**
 * Increment project count.
 * Phase 4: count is live from DB, so this is a no-op (count is computed).
 * Exists for API completeness and future tenants-table update.
 */
export async function incrementProjectCount(_tenantId) {
  // No-op in Phase 4: count derived from DB
}

/**
 * Decrement project count.
 * Phase 4: count is live from DB, so this is a no-op.
 */
export async function decrementProjectCount(_tenantId) {
  // No-op in Phase 4: count derived from DB
}

/**
 * Increment storage used.
 * Phase 4: storage is computed as SUM from documents.file_size — no-op.
 * Future: update tenants.usage->storage_used_bytes
 */
export async function incrementStorageUsed(_tenantId, _bytes) {
  // No-op in Phase 4: storage derived from SUM(documents.file_size)
}

// ── Limit checks ───────────────────────────────────────────────────────

/**
 * Check whether the tenant can create another project.
 * Throws LimitExceededError if the plan limit is reached.
 */
export async function checkProjectLimit(_tenantId) {
  const plan = getCurrentPlan();
  const limits = getLimitsForPlan(plan);
  if (limits.projects_max === -1) return; // unlimited

  const current = await getProjectCount();
  if (current >= limits.projects_max) {
    throw new LimitExceededError('projects', current, limits.projects_max);
  }
}

/**
 * Check whether the tenant can upload `newBytes` more data.
 * Throws LimitExceededError if adding newBytes would exceed the storage limit.
 */
export async function checkStorageLimit(_tenantId, newBytes) {
  const plan = getCurrentPlan();
  const limits = getLimitsForPlan(plan);
  if (limits.storage_max_bytes === -1) return; // unlimited

  const current = await getStorageUsedBytes();
  if (current + newBytes > limits.storage_max_bytes) {
    throw new LimitExceededError('storage', current + newBytes, limits.storage_max_bytes);
  }
}

// ── Stats ──────────────────────────────────────────────────────────────

/**
 * Returns current usage versus plan limits.
 *
 * @returns {{
 *   plan: string,
 *   projects: { current: number, max: number, unlimited: boolean },
 *   storage: { current_bytes: number, max_bytes: number, unlimited: boolean },
 *   team: { max: number, unlimited: boolean },
 * }}
 */
export async function getUsageStats(_tenantId) {
  const plan = getCurrentPlan();
  const limits = getLimitsForPlan(plan);

  const [projectCount, storageUsed] = await Promise.all([
    getProjectCount(),
    getStorageUsedBytes(),
  ]);

  return {
    plan,
    projects: {
      current: projectCount,
      max: limits.projects_max,
      unlimited: limits.projects_max === -1,
    },
    storage: {
      current_bytes: storageUsed,
      max_bytes: limits.storage_max_bytes,
      unlimited: limits.storage_max_bytes === -1,
    },
    team: {
      max: limits.team_max,
      unlimited: limits.team_max === -1,
    },
  };
}
