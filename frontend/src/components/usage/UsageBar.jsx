/**
 * UsageBar — shows plan usage for the current tenant.
 *
 * Displays:
 *  - Storage used / limit (with a progress bar)
 *  - Project count / limit
 *  - Plan badge
 *
 * Used in Sidebar (collapsed: icon-only with progress ring, expanded: full bar).
 * On mobile (sm breakpoint), always shows collapsed mode.
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

/** Plan display names (Greek) */
const PLAN_LABELS = {
  free: 'Δωρεάν',
  pro: 'Pro',
  enterprise: 'Εταιρικό',
  self_hosted: 'Self-Hosted',
};

/** Plan badge colors */
const PLAN_COLORS = {
  free: 'text-yellow-400 bg-yellow-400/10',
  pro: 'text-accent-blue bg-accent-blue/10',
  enterprise: 'text-purple-400 bg-purple-400/10',
  self_hosted: 'text-green-400 bg-green-400/10',
};

/** Circular progress ring for collapsed mode */
function ProgressRing({ percentage, color }) {
  // strokeDasharray is percentage out of 100 on a circumference-normalised path
  return (
    <svg className="w-8 h-8" viewBox="0 0 36 36" aria-hidden="true">
      {/* Background track */}
      <path
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="3"
      />
      {/* Filled arc */}
      <path
        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${percentage}, 100`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}

export default function UsageBar({ collapsed = false }) {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get('/api/tenant/usage')
      .then((data) => setUsage(data?.data ?? data))
      .catch(() => setError(true));
  }, []);

  // Show fallback UI on error (instead of silently disappearing)
  if (error) {
    if (collapsed) {
      return (
        <div
          className="flex items-center justify-center py-2"
          title="Αδυναμία φόρτωσης στοιχείων χρήσης"
        >
          <span className="text-base">⚠️</span>
        </div>
      );
    }
    return (
      <div className="px-4 py-3 border-t border-border-subtle">
        <div className="text-[10px] text-red-400 text-center">
          ⚠️ Σφάλμα φόρτωσης χρήσης
        </div>
      </div>
    );
  }

  if (!usage) return null;

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

  // Warning colors for storage bar & ring
  const barColor =
    storagePercent >= 90 ? 'bg-red-500' :
    storagePercent >= 70 ? 'bg-yellow-500' :
    'bg-accent-blue';

  // Ring stroke color based on usage level
  const ringColor =
    storagePercent >= 80 ? '#ef4444' :   // red
    storagePercent >= 50 ? '#eab308' :   // yellow
    '#22c55e';                            // green

  // Tooltip text for collapsed mode
  const tooltipText = [
    `Αποθηκευτικός χώρος: ${storageLabel}`,
    `Φάκελοι: ${projectsLabel}`,
    `Πλάνο: ${PLAN_LABELS[plan] ?? plan}`,
  ].join('\n');

  // In collapsed sidebar OR on mobile (sm:hidden logic handled via CSS)
  // collapsed prop = sidebar is collapsed; expanded = user tapped on mobile to open
  const isCollapsed = collapsed && !expanded;

  // Collapsed / mobile icon-only view
  const collapsedView = (
    <div
      className="flex items-center justify-center py-2 cursor-pointer select-none"
      title={tooltipText}
      onClick={() => collapsed && setExpanded((v) => !v)}
      role={collapsed ? 'button' : undefined}
      aria-label="Στοιχεία χρήσης"
    >
      <ProgressRing percentage={storage.unlimited ? 0 : storagePercent} color={ringColor} />
    </div>
  );

  // Expanded / desktop view
  const expandedView = (
    <div
      className={[
        'px-4 py-3 space-y-2.5 border-t border-border-subtle',
        'transition-all duration-300 ease-in-out',
        'overflow-hidden',
      ].join(' ')}
    >
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

      {/* Collapse button (mobile only, when sidebar is collapsed but user tapped open) */}
      {collapsed && expanded && (
        <button
          className="w-full text-[10px] text-text-muted hover:text-text py-0.5 transition-colors"
          onClick={() => setExpanded(false)}
          aria-label="Σύμπτυξη"
        >
          ▲ Σύμπτυξη
        </button>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <div className="border-t border-border-subtle">
        {collapsedView}
        {/* Expanded panel slides in when user taps the ring on mobile */}
        <div
          className={[
            'overflow-hidden transition-all duration-300 ease-in-out',
            expanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0',
          ].join(' ')}
          aria-hidden={!expanded}
        >
          {expandedView}
        </div>
      </div>
    );
  }

  // Full sidebar expanded: show full bar
  // On small screens (md:hidden), render collapsed ring with tap-to-expand
  return (
    <>
      {/* Mobile: collapsed ring with tap-to-expand */}
      <div className="md:hidden border-t border-border-subtle">
        <div
          className="flex items-center justify-center py-2 cursor-pointer select-none"
          title={tooltipText}
          onClick={() => setExpanded((v) => !v)}
          role="button"
          aria-label="Στοιχεία χρήσης"
          aria-expanded={expanded}
        >
          <ProgressRing percentage={storage.unlimited ? 0 : storagePercent} color={ringColor} />
        </div>
        <div
          className={[
            'overflow-hidden transition-all duration-300 ease-in-out',
            expanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0',
          ].join(' ')}
          aria-hidden={!expanded}
        >
          {expandedView}
        </div>
      </div>

      {/* Desktop: always show full bar */}
      <div className="hidden md:block">
        {expandedView}
      </div>
    </>
  );
}
