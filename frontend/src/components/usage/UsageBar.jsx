/**
 * UsageBar — shows plan usage for the current tenant.
 *
 * Displays:
 *  - Storage used / limit (with a progress bar)
 *  - Project count / limit
 *  - Plan badge
 *
 * Used in Sidebar (collapsed: icon-only, expanded: full bar).
 */

import { useEffect, useState } from 'react';
import api from '../../api/index.js';

/** Format bytes to human-readable string (e.g. 1.2 GB) */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Plan display names */
const PLAN_LABELS = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
  self_hosted: 'Self-Hosted',
};

/** Plan badge colors */
const PLAN_COLORS = {
  free: 'text-yellow-400 bg-yellow-400/10',
  pro: 'text-accent-blue bg-accent-blue/10',
  enterprise: 'text-purple-400 bg-purple-400/10',
  self_hosted: 'text-green-400 bg-green-400/10',
};

export default function UsageBar({ collapsed = false }) {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/tenant/usage')
      .then((data) => setUsage(data?.data ?? data))
      .catch(() => setError(true));
  }, []);

  if (error || !usage) return null;

  const { plan, projects, storage } = usage;

  // Storage bar percentage
  const storagePercent = storage.unlimited
    ? 0
    : Math.min(100, Math.round((storage.current_bytes / storage.max_bytes) * 100));

  const storageLabel = storage.unlimited
    ? formatBytes(storage.current_bytes)
    : `${formatBytes(storage.current_bytes)} / ${formatBytes(storage.max_bytes)}`;

  // Project count label
  const projectsLabel = projects.unlimited
    ? `${projects.current} φάκελοι`
    : `${projects.current} / ${projects.max} φάκελοι`;

  // Warning colors for storage bar
  const barColor =
    storagePercent >= 90 ? 'bg-red-500' :
    storagePercent >= 70 ? 'bg-yellow-500' :
    'bg-accent-blue';

  // Collapsed view: just an emoji hint
  if (collapsed) {
    const isNearLimit = !storage.unlimited && storagePercent >= 80;
    return (
      <div
        className="flex items-center justify-center py-2"
        title={`${PLAN_LABELS[plan] ?? plan} — ${storageLabel} — ${projectsLabel}`}
      >
        <span className="text-base">{isNearLimit ? '⚠️' : '📊'}</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2.5 border-t border-border-subtle">
      {/* Plan badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Πλάνο
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PLAN_COLORS[plan] ?? 'text-text-muted bg-white/5'}`}>
          {PLAN_LABELS[plan] ?? plan}
        </span>
      </div>

      {/* Storage */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-text-muted">Αποθηκευτικός χώρος</span>
          <span className="text-[10px] text-text-muted font-mono">{storageLabel}</span>
        </div>
        {!storage.unlimited && (
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        )}
        {storage.unlimited && (
          <div className="text-[10px] text-green-400">∞ Απεριόριστος</div>
        )}
      </div>

      {/* Projects */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted">📁 Φάκελοι</span>
        <span className={`text-[10px] font-mono ${
          !projects.unlimited && projects.current >= projects.max
            ? 'text-red-400 font-bold'
            : 'text-text-muted'
        }`}>
          {projectsLabel}
        </span>
      </div>
    </div>
  );
}
