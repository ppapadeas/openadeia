import useAppStore from '../store/useAppStore.js';

/**
 * Plan → features mapping.
 * Backend returns user.plan in JWT; we derive features here on the frontend.
 */
export const PLAN_FEATURES = {
  free:        ['nok'],
  pro:         ['nok', 'fees', 'tee'],
  enterprise:  ['nok', 'fees', 'tee', 'portal'],
  self_hosted: ['nok', 'fees', 'tee', 'portal'],
};

/**
 * Returns the feature list for a given plan.
 * Falls back to 'free' features if plan is unknown/missing.
 */
export function getFeaturesForPlan(plan) {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.free;
}

/**
 * Hook that returns true if the current authenticated user has a given feature.
 *
 * Feature resolution order:
 *  1. user.features (explicit array on user object — future-proof for backend grants)
 *  2. derived from user.plan via PLAN_FEATURES
 *  3. false if user is not authenticated
 *
 * Usage:
 *   const hasTee = useFeature('tee');
 */
export default function useFeature(feature) {
  const user = useAppStore((s) => s.user);
  if (!user) return false;

  // Prefer explicit features array if present
  if (Array.isArray(user.features)) {
    return user.features.includes(feature);
  }

  // Derive from plan
  return getFeaturesForPlan(user.plan).includes(feature);
}
