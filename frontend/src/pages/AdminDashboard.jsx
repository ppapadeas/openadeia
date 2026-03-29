/**
 * AdminDashboard — Platform superadmin panel
 *
 * Route: /admin
 * Access: is_superadmin only
 *
 * Phase 6 foundational implementation:
 * - Metrics overview (projects, users, documents)
 * - Tenant list table
 * - Stage/type breakdowns
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore.js';
import { adminApi } from '../api/admin.js';

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
      <div className="text-2xl font-bold text-text-primary">{value ?? '—'}</div>
      <div className="text-sm font-medium text-text-secondary mt-1">{label}</div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <h2 className="text-base font-semibold text-text-primary mb-3 mt-6">{title}</h2>
  );
}

export default function AdminDashboard() {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Guard: redirect if not superadmin
  useEffect(() => {
    if (user && !user.is_superadmin) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user?.is_superadmin) return;

    Promise.all([adminApi.getMetrics(), adminApi.listTenants()])
      .then(([metricsRes, tenantsRes]) => {
        setMetrics(metricsRes.data);
        setTenants(tenantsRes.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user?.is_superadmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <div className="text-center">
          <div className="text-2xl mb-2">⏳</div>
          <div>Loading admin panel…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="text-2xl">🛡️</div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Admin Panel</h1>
          <p className="text-sm text-text-muted">Platform superadmin dashboard</p>
        </div>
        <div className="ml-auto">
          <span className="text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20 px-3 py-1 rounded-full font-medium">
            v{metrics?.platform_version || '2.0.0'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <SectionHeader title="Platform Overview" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={metrics?.total_projects} sub={`+${metrics?.new_projects_30d} last 30d`} />
        <StatCard label="Total Users" value={metrics?.total_users} sub={`+${metrics?.new_users_30d} last 30d`} />
        <StatCard label="Total Documents" value={metrics?.total_documents} />
        <StatCard label="Active Tenants" value={metrics?.active_tenants} />
      </div>

      {/* Tenants Table */}
      <SectionHeader title="Tenants" />
      <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left px-4 py-3 text-text-muted font-medium">Tenant</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Status</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Projects</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Users</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Storage</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-border-subtle last:border-0 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
                <td className="px-4 py-3">
                  <PlanBadge plan={t.plan} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">{t.projects_count}</td>
                <td className="px-4 py-3 text-right text-text-secondary">{t.users_count}</td>
                <td className="px-4 py-3 text-right text-text-muted">
                  {t.storage_used_bytes > 0 ? formatBytes(t.storage_used_bytes) : '—'}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">No tenants found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Project Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* By Stage */}
        <div>
          <SectionHeader title="Projects by Stage" />
          <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left px-4 py-2 text-text-muted font-medium">Stage</th>
                  <th className="text-right px-4 py-2 text-text-muted font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {(metrics?.projects_by_stage || []).map((row) => (
                  <tr key={row.stage} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-2 text-text-secondary font-mono text-xs">{row.stage}</td>
                    <td className="px-4 py-2 text-right text-text-primary font-medium">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Type */}
        <div>
          <SectionHeader title="Projects by Type" />
          <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left px-4 py-2 text-text-muted font-medium">Type</th>
                  <th className="text-right px-4 py-2 text-text-muted font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {(metrics?.projects_by_type || []).map((row) => (
                  <tr key={row.type} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-2 text-text-secondary font-mono text-xs">{row.type}</td>
                    <td className="px-4 py-2 text-right text-text-primary font-medium">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <SectionHeader title="Recent Projects" />
      <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left px-4 py-3 text-text-muted font-medium">Code</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Title</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Type</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Stage</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {(metrics?.recent_projects || []).map((p) => (
              <tr key={p.id} className="border-b border-border-subtle last:border-0 hover:bg-white/5 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-accent-blue">{p.code}</td>
                <td className="px-4 py-2.5 text-text-primary truncate max-w-xs">{p.title}</td>
                <td className="px-4 py-2.5 text-text-muted text-xs">{p.type}</td>
                <td className="px-4 py-2.5 text-text-muted text-xs">{p.stage}</td>
                <td className="px-4 py-2.5 text-right text-text-muted text-xs">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('el-GR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-text-muted text-center">
        Computed at {metrics?.computed_at ? new Date(metrics.computed_at).toLocaleString('el-GR') : '—'}
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────

function PlanBadge({ plan }) {
  const colors = {
    free: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    pro: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    enterprise: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    self_hosted: 'bg-green-500/10 text-green-400 border-green-500/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[plan] || colors.free}`}>
      {plan || 'unknown'}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
    trialing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    past_due: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[status] || 'bg-gray-500/10 text-gray-400'}`}>
      {status || 'unknown'}
    </span>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
