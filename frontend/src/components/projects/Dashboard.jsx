import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsApi, teeApi } from '../../api/projects.js';
import { PERMIT_TYPES, STAGES, formatDate } from '../../utils/index.js';
import ProjectForm from './ProjectForm.jsx';
import TeeSyncPanel from '../tee/TeeSyncPanel.jsx';
import ProgressRing from '../ui/ProgressRing.jsx';

const STAGE_FILTERS = [{ id: '', label: 'Όλα' }, ...STAGES];
const TYPE_FILTERS = [{ id: '', label: 'Όλοι' }, ...Object.entries(PERMIT_TYPES).map(([id, v]) => ({ id, label: v.shortLabel }))];

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', stageFilter, typeFilter, search],
    queryFn: () => projectsApi.list({ stage: stageFilter || undefined, type: typeFilter || undefined, q: search || undefined }),
  });

  // Check if TEE credentials configured (for showing sync button)
  const { data: teeStatus } = useQuery({
    queryKey: ['tee-status'],
    queryFn: teeApi.status,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (body) => projectsApi.create(body),
    onSuccess: (project) => {
      qc.invalidateQueries(['projects']);
      setShowForm(false);
      toast.success('Ο φάκελος δημιουργήθηκε!');
      navigate(`/projects/${project.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const projects = data?.data || [];
  const total = data?.total || 0;

  const stats = [
    { label: 'Ενεργοί Φάκελοι', value: total, color: '#3B82F6', icon: '📁' },
    { label: 'Σε Αναμονή', value: projects.filter(p => ['init','data_collection'].includes(p.stage)).length, color: '#F59E0B', icon: '⏳' },
    { label: 'Σε Έλεγχο ΥΔΟΜ', value: projects.filter(p => p.stage === 'review').length, color: '#8B5CF6', icon: '🏛️' },
    { label: 'Εγκεκριμένα', value: projects.filter(p => p.stage === 'approved').length, color: '#10B981', icon: '✅' },
  ];

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Πίνακας Ελέγχου</h1>
          <p className="text-text-muted text-sm mt-1">Διαχείριση Αδειοδοτικών Φακέλων</p>
        </div>
        <div className="flex gap-2">
          {/* TEE Sync button — always show, panel handles no-credentials case */}
          <button
            className="btn-secondary flex items-center gap-1.5"
            onClick={() => setShowSync(true)}
            title="Συγχρονισμός από ΤΕΕ e-Adeies">
            <span className="text-base">🔄</span>
            <span>ΤΕΕ Sync</span>
            {teeStatus?.configured && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
            )}
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Νέος Φάκελος
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {stats.map((s, i) => (
          <div key={i} className="card flex items-center gap-4">
            <span className="text-3xl">{s.icon}</span>
            <div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-text-muted font-medium mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input className="input w-52 text-sm" placeholder="Αναζήτηση…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {STAGE_FILTERS.map(f => (
            <button key={f.id}
              onClick={() => setStageFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${stageFilter === f.id ? 'bg-white/15 text-text-primary' : 'text-text-muted hover:text-text-primary'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {TYPE_FILTERS.map(f => (
            <button key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === f.id ? 'bg-white/15 text-text-primary' : 'text-text-muted hover:text-text-primary'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="text-text-muted text-sm text-center py-12">Φόρτωση…</div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-14 text-text-muted">
          <div className="text-4xl mb-3">📂</div>
          <div className="font-medium">Δεν υπάρχουν φάκελοι</div>
          <div className="flex gap-2 justify-center mt-4">
            <button className="btn-secondary" onClick={() => setShowSync(true)}>
              🔄 Εισαγωγή από ΤΕΕ
            </button>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Νέος Φάκελος
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {projects.map((p) => {
            const pt = PERMIT_TYPES[p.type] || PERMIT_TYPES.new_building;
            const stage = STAGES.find(s => s.id === p.stage);
            const fromTee = !!p.tee_permit_code;
            return (
              <div key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="card card-hover flex items-center gap-5"
                style={{ '--hover-border': pt.color + '60' }}
              >
                <ProgressRing progress={p.progress || 0} color={pt.color} size={52} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge text-xs px-2 py-0.5 rounded-md font-bold"
                      style={{ background: pt.color + '20', color: pt.color }}>
                      {pt.shortLabel}
                    </span>
                    {p.is_continuation && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 font-medium">
                        Συνέχεια
                      </span>
                    )}
                    {fromTee && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                        ΤΕΕ {p.tee_permit_code}
                      </span>
                    )}
                    <span className="font-semibold text-sm truncate">{p.title}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-text-muted">
                    <span>👤 {p.client_name || '—'}</span>
                    {p.addr && <span>📍 {p.addr}{p.city ? `, ${p.city}` : ''}</span>}
                    {p.kaek && <span className="font-mono">ΚΑΕΚ: {p.kaek}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-text-secondary mb-1">{stage?.icon} {stage?.label}</div>
                  <div className="text-xs text-text-muted">{p.code} · {formatDate(p.created_at)}</div>
                  {p.deadline && <div className="text-xs text-amber-500 mt-0.5">⏰ {formatDate(p.deadline)}</div>}
                </div>
                <span className="text-text-muted text-lg ml-1">›</span>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProjectForm onClose={() => setShowForm(false)} onSubmit={createMutation.mutate} loading={createMutation.isPending} />
      )}
      {showSync && <TeeSyncPanel onClose={() => setShowSync(false)} />}
    </div>
  );
}
