import { Navigate } from 'react-router-dom';
import useFeature from '../../hooks/useFeature.js';

/**
 * Route guard that requires a specific feature flag.
 * Redirects to /dashboard (→ /projects) if the feature is not enabled for the current user.
 *
 * Usage:
 *   <FeatureRoute feature="tee"><TeePage /></FeatureRoute>
 *
 * @param {string}      feature   - Feature key to check (e.g. 'tee', 'portal', 'nok', 'fees')
 * @param {ReactNode}   children  - Content to render if feature is enabled
 * @param {string}      [redirect='/projects'] - Where to redirect if feature is missing
 */
export default function FeatureRoute({ feature, children, redirect = '/projects' }) {
  const hasFeature = useFeature(feature);
  if (!hasFeature) return <Navigate to={redirect} replace />;
  return children;
}
