import { useQuery } from '@tanstack/react-query';
import { nokApi, projectsApi } from '../../api/projects.js';
import StatusBadge from '../ui/StatusBadge.jsx';

export default function Checklist({ type, project }) {
  const { data: checklist } = useQuery({
    queryKey: ['checklist', type],
    queryFn: () => nokApi.checklist(type),
  });

  const { data: docs = [] } = useQuery({
    queryKey: ['documents', project.id],
    queryFn: () => projectsApi.listDocs(project.id),
  });

  if (!checklist) return <div className="text-text-muted text-sm">Φόρτωση…</div>;

  const docMap = Object.fromEntries(docs.map(d => [d.doc_type, d.status]));

  const allItems = [
    ...checklist.documents.map(d => ({ ...d, category: 'document' })),
    ...checklist.studies.map(s => ({ ...s, category: 'study' })),
  ];

  const total = allItems.length;
  const done = allItems.filter(i => ['uploaded','signed','completed'].includes(docMap[i.id])).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      {/* Summary */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Συνολική Πρόοδος</span>
          <span className="text-sm font-bold text-accent-blue">{done}/{total} ({pct}%)</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-accent-blue rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Νομοθεσία */}
      <div className="card mb-4">
        <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Νομικό Πλαίσιο</h3>
        <div className="flex flex-wrap gap-2">
          {checklist.nokArticles?.map((a, i) => (
            <span key={i} className="badge bg-white/5 text-text-secondary text-xs px-2.5 py-1">{a}</span>
          ))}
        </div>
      </div>

      {/* Documents */}
      {checklist.documents.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Δικαιολογητικά</h3>
          <div className="space-y-1.5">
            {checklist.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 card py-2.5">
                <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs ${
                  ['uploaded','signed'].includes(docMap[d.id]) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-text-muted'
                }`}>
                  {['uploaded','signed'].includes(docMap[d.id]) ? '✓' : '○'}
                </span>
                <span className="text-sm flex-1">{d.label}</span>
                {d.signerRole && <span className="text-xs text-text-muted">{d.signerRole}</span>}
                <StatusBadge status={docMap[d.id] || 'pending'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Studies */}
      {checklist.studies.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Μελέτες</h3>
          <div className="space-y-1.5">
            {checklist.studies.map((s) => (
              <div key={s.id} className="flex items-center gap-3 card py-2.5">
                <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs ${
                  ['uploaded','signed','completed'].includes(docMap[s.id]) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-text-muted'
                }`}>
                  {['uploaded','signed','completed'].includes(docMap[s.id]) ? '✓' : '○'}
                </span>
                <span className="text-sm flex-1">{s.label}</span>
                <span className="text-xs text-text-muted">{s.signerRole}</span>
                <StatusBadge status={docMap[s.id] || 'not_started'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approvals */}
      {checklist.approvals?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Απαιτούμενες Εγκρίσεις</h3>
          <div className="flex flex-wrap gap-2">
            {checklist.approvals.map((a, i) => (
              <span key={i} className="badge bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1">{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Fees */}
      <div className="card">
        <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Τέλη</h3>
        <div className="flex gap-2">
          {checklist.fees?.tee && <span className="badge bg-blue-500/10 text-blue-400 text-xs">ΤΕΕ</span>}
          {checklist.fees?.municipality && <span className="badge bg-purple-500/10 text-purple-400 text-xs">Δήμος</span>}
          {checklist.fees?.efka && <span className="badge bg-orange-500/10 text-orange-400 text-xs">ΕΦΚΑ</span>}
        </div>
        <div className="text-xs text-text-muted mt-2">Εκτιμώμενος χρόνος: ~{checklist.estimatedDays} ημέρες</div>
      </div>
    </div>
  );
}
