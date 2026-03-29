/**
 * Plan Limits Configuration
 *
 * -1 means unlimited.
 * Used by the usage service to enforce per-tenant limits.
 */

export const PLAN_LIMITS = {
  free: {
    projects_max: 5,
    storage_max_bytes: 500 * 1024 * 1024,  // 500 MB
    team_max: 1,
  },
  pro: {
    projects_max: -1,                        // unlimited
    storage_max_bytes: 10 * 1024 * 1024 * 1024,  // 10 GB
    team_max: 3,
  },
  enterprise: {
    projects_max: -1,
    storage_max_bytes: -1,
    team_max: -1,
  },
  self_hosted: {
    projects_max: -1,
    storage_max_bytes: -1,
    team_max: -1,
  },
};

/**
 * Returns the plan limits for a given plan name.
 * Falls back to self_hosted (unlimited) for unknown plans.
 */
export function getLimitsForPlan(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.self_hosted;
}
