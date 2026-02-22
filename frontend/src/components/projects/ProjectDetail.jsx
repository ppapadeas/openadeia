import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsApi } from '../../api/projects.js';
import { PERMIT_TYPES, STAGES, formatDate } from '../../utils/index.js';
import StageIndicator from '../workflow/StageIndicator.jsx';
import DocList from '../documents/DocList.jsx';
import Checklist from '../nok/Checklist.jsx';
import ComposeDialog from '../email/ComposeDialog.jsx';
import ProgressRing from '../ui/ProgressRing.jsx';

const TABS = [
  { id: 'overview',   label: 'Επισκόπηση' },
  { id: 'documents',  label: 'Έγγραφα' },
  { id: 'studies',    label: 'Μελέτες' },
  { id: 'checklist',  label: 'Checklist' },
  { id: 'timeline',   label: 'Ιστορικό' },
  { id: 'email',      label: 'Email' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [showCompose, setShowCompose] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
  });

  const advanceMutation = useMutation({
    mutationFn: () => projectsApi.advance(id),
    onSuccess: (r) => {
      qc.invalidateQueries(['project', id]);
      qc.invalidateQueries(['projects']);
      toast.success(`Μετάβαση: ${r.fromStage} → ${r.toStage}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', id],
    queryFn: () => projectsApi.timeline(id),
    enabled: tab === 'timeline',
  });

  const { data: emails = [] } = useQuery({
    queryKey: ['emails', id],
    queryFn: () => projectsApi.listEmails(id),
    enabled: tab === 'email',
  });

  if (isLoading) return <div className="p-7 text-text-muted">Φόρτωση…</div>;
  if (!project) return <div className="p-7 text-red-400">Φάκελος δεν βρέθηκε</div>;

  const pt = PERMIT_TYPES[project.type] || PERMIT_TYPES.vod;
  const currentStageObj = STAGES.find(s => s.id === project.stage);
  const isLastStage = project.stage === 'approved';

  return (
    <div className="p-7 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/projects')} className="text-text-muted text-sm hover:text-text-primary mb-5 flex items-center gap-1">
        ← Πίσω στους φακέλους
      </button>

      {/* Project header */}
      <div className="card mb-5">
        <div className="flex items-start gap-5">
          <ProgressRing progress={project.progress || 0} color={pt.color} size={64} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="badge text-xs px-2.5 py-1 font-bold" style={{ background: pt.color + '20', color: pt.color }}>{pt.shortLabel}</span>
              <h1 className="text-xl font-bold truncate">{project.title}</h1>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-text-muted">
              <span>📋 {project.code}</span>
              {project.client && <span>👤 {project.client.surname} {project.client.name}</span>}
              {project.property && <span>📍 {project.property.addr}, {project.property.city}</span>}
              {project.property?.kaek && <span className="font-mono">ΚΑΕΚ: {project.property.kaek}</span>}
              <span>📅 {formatDate(project.created_at)}</span>
              {project.deadline && <span className="text-amber-400">⏰ {formatDate(project.deadline)}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {!isLastStage && (
              <button className="btn-primary" onClick={() => advanceMutation.mutate()} disabled={advanceMutation.isPending}>
                {advanceMutation.isPending ? 'Ενημέρωση…' : `▶ Επόμενο Στάδιο`}
              </button>
            )}
            <button className="btn-secondary" onClick={() => setShowCompose(true)}>✉ Email</button>
          </div>
        </div>

        {/* Stage indicator */}
        <div className="mt-5 pt-5 border-t border-border-subtle">
          <StageIndicator type={project.type} currentStage={project.stage} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border-subtle mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'documents' && <DocList projectId={id} type={project.type} />}
      {tab === 'studies' && <DocList projectId={id} type={project.type} studiesOnly />}
      {tab === 'checklist' && <Checklist type={project.type} project={project} />}
      {tab === 'timeline' && <TimelineTab logs={timeline} />}
      {tab === 'email' && <EmailTab emails={emails} onCompose={() => setShowCompose(true)} />}

      {showCompose && project.client && (
        <ComposeDialog
          projectId={id}
          defaultTo={project.client.email || ''}
          projectCode={project.code}
          onClose={() => setShowCompose(false)}
          onSent={() => { qc.invalidateQueries(['emails', id]); setShowCompose(false); setTab('email'); }}
        />
      )}
    </div>
  );
}

function OverviewTab({ project }) {
  const prop = project.property || {};
  const ek = project.ekdosi || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Client */}
      {project.client && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-3 text-text-secondary">Ιδιοκτήτης</h3>
          <div className="space-y-1 text-sm">
            <div><span className="text-text-muted">Ονοματεπώνυμο:</span> {project.client.surname} {project.client.name}</div>
            {project.client.father_name && <div><span className="text-text-muted">Πατρώνυμο:</span> {project.client.father_name}</div>}
            {project.client.afm && <div><span className="text-text-muted">ΑΦΜ:</span> <span className="font-mono">{project.client.afm}</span></div>}
            {project.client.adt && <div><span className="text-text-muted">ΑΔΤ:</span> <span className="font-mono">{project.client.adt}</span></div>}
            {project.client.phone && <div><span className="text-text-muted">Τηλ:</span> {project.client.phone}</div>}
            {project.client.email && <div><span className="text-text-muted">Email:</span> {project.client.email}</div>}
          </div>
        </div>
      )}
      {/* Property */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3 text-text-secondary">Ακίνητο</h3>
        <div className="space-y-1 text-sm">
          {prop.kaek && <div><span className="text-text-muted">ΚΑΕΚ:</span> <span className="font-mono">{prop.kaek}</span></div>}
          {prop.addr && <div><span className="text-text-muted">Διεύθυνση:</span> {prop.addr} {prop.addr_num_from}</div>}
          {prop.city && <div><span className="text-text-muted">Πόλη:</span> {prop.city} {prop.zip_code}</div>}
          {prop.ot && <div><span className="text-text-muted">ΟΤ:</span> {prop.ot}</div>}
          {prop.zoning_info && (
            <div>
              <span className="text-text-muted">Δόμηση:</span>
              <pre className="text-xs font-mono bg-white/5 rounded p-2 mt-1 overflow-x-auto">
                {JSON.stringify(prop.zoning_info, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
      {/* Building data */}
      {ek && ek.total_plot_area > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-3 text-text-secondary">Στοιχεία Κτιρίου (EKDOSI)</h3>
          <div className="space-y-1 text-sm">
            <div><span className="text-text-muted">Εμβαδό Οικοπέδου:</span> {ek.total_plot_area} m²</div>
            <div><span className="text-text-muted">Ολικός Όγκος:</span> {ek.total_build_volume} m³</div>
            <div><span className="text-text-muted">Αριθμός Ορόφων:</span> {ek.num_of_floors}</div>
            <div><span className="text-text-muted">Ιδιοκτησίες:</span> {ek.num_of_ownerships}</div>
            <div><span className="text-text-muted">Θέσεις Στάθμευσης:</span> {ek.num_of_parkings}</div>
          </div>
        </div>
      )}
      {/* TEE codes */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3 text-text-secondary">Στοιχεία e-Άδειες</h3>
        <div className="space-y-1 text-sm">
          <div><span className="text-text-muted">Κωδικός Αίτησης ΤΕΕ:</span> {project.aitisi_type_code || '—'}</div>
          <div><span className="text-text-muted">YD_ID:</span> {project.yd_id || '—'}</div>
          <div><span className="text-text-muted">DIMOS_AA:</span> {project.dimos_aa || '—'}</div>
          <div><span className="text-text-muted">Κωδικός Πράξης:</span> {project.tee_permit_code || '—'}</div>
          <div><span className="text-text-muted">Ημ. Υποβολής:</span> {formatDate(project.tee_submission_date)}</div>
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ logs }) {
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-4 items-start">
          <div className="w-2 h-2 rounded-full bg-accent-blue mt-2 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium">{log.action}</div>
            <div className="text-xs text-text-muted mt-0.5">
              {log.user_name || 'Σύστημα'} · {formatDate(log.created_at)}
              {log.from_stage && <span> · {log.from_stage} → {log.to_stage}</span>}
            </div>
          </div>
        </div>
      ))}
      {logs.length === 0 && <div className="text-text-muted text-sm">Δεν υπάρχει ιστορικό</div>}
    </div>
  );
}

function EmailTab({ emails, onCompose }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-sm text-text-secondary">Αλληλογραφία</h3>
        <button className="btn-primary" onClick={onCompose}>+ Νέο Email</button>
      </div>
      <div className="space-y-2">
        {emails.map((e) => (
          <div key={e.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{e.subject}</div>
                <div className="text-xs text-text-muted mt-1">
                  {e.direction === 'sent' ? '→' : '←'} {e.direction === 'sent' ? e.to_address : e.from_address}
                  · {formatDate(e.sent_at)}
                </div>
              </div>
              <span className="badge text-xs" style={{ background: e.direction === 'sent' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', color: e.direction === 'sent' ? '#3B82F6' : '#10B981' }}>
                {e.direction === 'sent' ? 'Απεστάλη' : 'Ελήφθη'}
              </span>
            </div>
          </div>
        ))}
        {emails.length === 0 && <div className="text-text-muted text-sm">Δεν υπάρχει αλληλογραφία</div>}
      </div>
    </div>
  );
}
