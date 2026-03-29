/**
 * AuditLog — Admin audit log viewer
 *
 * Displays a paginated, filterable table of all state-changing operations.
 * Used inside the AdminDashboard / settings area.
 *
 * Features:
 * - Paginated table (100 entries per page)
 * - Filter by action type
 * - Color-coded action badges
 * - Expandable metadata rows (with chevron hint)
 * - CSV export button
 */

import { useEffect, useState, useCallback } from 'react';
import api from '../../api/index.js';

// ── Action color coding ─────────────────────────────────────────────

const ACTION_COLORS = {
  'resource.created':  'bg-green-500/10 text-green-400 border-green-500/20',
  'resource.updated':  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'resource.deleted':  'bg-red-500/10 text-red-400 border-red-500/20',
  'resource.action':   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'resource.write':    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'tenant.data_export':'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'tenant.deleted':    'bg-red-600/20 text-red-300 border-red-600/30',
};

function ActionBadge({ action }) {
  const colorClass = ACTION_COLORS[action] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${colorClass}`}>
      {action}
    </span>
  );
}

function ActorBadge({ type }) {
  const colors = {
    user: 'text-accent-blue',
    portal_client: 'text-purple-400',
    system: 'text-text-muted',
    api: 'text-yellow-400',
  };
  return (
    <span className={`text-xs font-medium ${colors[type] || 'text-text-muted'}`}>
      {type}
    </span>
  );
}

// ── Chevron icon for expandable rows ────────────────────────────────

function Chevron({ expanded }) {
  return (
    <span
      className={`inline-block text-text-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      ›
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState({ total: 0, limit: 100, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');

  const LIMIT = 100;

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: LIMIT,
        offset: page * LIMIT,
      });
      if (filterAction) params.set('action', filterAction);
      if (filterResource) params.set('resource_type', filterResource);

      const res = await api.get(`/api/tenant/audit?${params}`);
      setEntries(res.data.data || []);
      setMeta(res.data.meta || { total: 0, limit: LIMIT, offset: page * LIMIT });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterResource]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [filterAction, filterResource]);

  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('el-GR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const totalPages = Math.ceil(meta.total / LIMIT);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Αρχείο Ενεργειών</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {meta.total.toLocaleString()} εγγραφές συνολικά
          </p>
        </div>
        <a
          href="/api/tenant/export"
          className="text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20 px-3 py-1.5 rounded-lg font-medium hover:bg-accent-blue/20 transition-colors"
          download
        >
          ↓ Εξαγωγή GDPR
        </a>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Φίλτρο κατά ενέργεια…"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-sm bg-bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/50 w-48"
        />
        <input
          type="text"
          placeholder="Φίλτρο κατά πόρο…"
          value={filterResource}
          onChange={(e) => setFilterResource(e.target.value)}
          className="text-sm bg-bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/50 w-48"
        />
        {(filterAction || filterResource) && (
          <button
            onClick={() => { setFilterAction(''); setFilterResource(''); }}
            className="text-xs text-text-muted hover:text-text-primary transition-colors px-2"
          >
            Εκκαθάριση
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left px-4 py-3 text-text-muted font-medium whitespace-nowrap w-4"></th>
                <th className="text-left px-4 py-3 text-text-muted font-medium whitespace-nowrap">Ημερομηνία</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Χρήστης</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Ενέργεια</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Πόρος</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Φόρτωση…
                  </td>
                </tr>
              )}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Δεν βρέθηκαν εγγραφές
                  </td>
                </tr>
              )}
              {!loading && entries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => toggleExpand(entry.id)}
                    className="border-b border-border-subtle last:border-0 hover:bg-white/5 transition-colors cursor-pointer"
                    title="Κλικ για λεπτομέρειες"
                  >
                    <td className="pl-4 py-2.5 text-base text-text-muted">
                      <Chevron expanded={expandedId === entry.id} />
                    </td>
                    <td className="px-4 py-2.5 text-text-muted text-xs whitespace-nowrap font-mono">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <ActorBadge type={entry.actor_type} />
                        <span className="text-xs text-text-secondary truncate max-w-[140px]">
                          {entry.user_name || entry.actor_id || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.resource_type ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-text-primary">
                            {entry.resource_type}
                          </span>
                          {entry.resource_id && (
                            <span className="text-xs text-text-muted font-mono truncate max-w-[120px]">
                              {entry.resource_id.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted font-mono">
                      {entry.ip_address || '—'}
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr key={`${entry.id}-expand`} className="border-b border-border-subtle bg-white/3">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {entry.user_email && (
                            <div>
                              <div className="text-text-muted mb-0.5">Email Χρήστη</div>
                              <div className="text-text-primary font-mono">{entry.user_email}</div>
                            </div>
                          )}
                          {entry.resource_id && (
                            <div>
                              <div className="text-text-muted mb-0.5">ID Πόρου</div>
                              <div className="text-text-primary font-mono">{entry.resource_id}</div>
                            </div>
                          )}
                          {entry.user_agent && (
                            <div className="md:col-span-2">
                              <div className="text-text-muted mb-0.5">User Agent</div>
                              <div className="text-text-primary truncate">{entry.user_agent}</div>
                            </div>
                          )}
                          {entry.metadata && (
                            <div className="md:col-span-3">
                              <div className="text-text-muted mb-0.5">Μεταδεδομένα</div>
                              <pre className="text-text-primary font-mono bg-bg-base rounded p-2 overflow-x-auto text-xs">
                                {JSON.stringify(entry.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-text-muted">
            Σελίδα {page + 1} από {totalPages} · {meta.total.toLocaleString()} εγγραφές
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-xs px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Προηγούμενη
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="text-xs px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Επόμενη →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
