import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { portalApi } from '../../api/projects.js';

const STATUS_LABELS = {
  draft: 'Πρόχειρο',
  active: 'Ενεργό',
  completed: 'Ολοκληρωμένο',
};

const STATUS_COLORS = {
  draft: 'text-text-muted',
  active: 'text-green-400',
  completed: 'text-blue-400',
};

const STEP_STATUS_LABELS = {
  locked: '🔒 Κλειδωμένο',
  available: '🔵 Διαθέσιμο',
  submitted: '📨 Υποβλήθηκε',
  in_review: '🔍 Σε Έλεγχο',
  revision: '⚠️ Χρειάζεται Διόρθωση',
  done: '✅ Ολοκληρώθηκε',
  skipped: '⏭ Παρακάμφθηκε',
};

export default function PortalTab({ projectId }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [form, setForm] = useState({
    language: 'el',
    client_message: 'Καλωσήρθατε! Παρακαλώ συμπληρώστε τα παρακάτω βήματα για την ολοκλήρωση του φακέλου σας.',
  });
  const [stepForm, setStepForm] = useState({ type: 'form', title: '', description: '', required: true });
  const [reviewDialog, setReviewDialog] = useState(null); // { stepId, action }

  const { data: portal, isLoading, error } = useQuery({
    queryKey: ['portal', projectId],
    queryFn: () => portalApi.getByProject(projectId),
    retry: (count, err) => {
      // Don't retry 404 (no portal yet)
      if (err?.message?.includes('404') || err?.response?.status === 404) return false;
      return count < 2;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => portalApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries(['portal', projectId]);
      setShowCreate(false);
      toast.success('Portal δημιουργήθηκε!');
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => portalApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries(['portal', projectId]);
      toast.success('Portal ενημερώθηκε');
    },
    onError: (e) => toast.error(e.message),
  });

  const addStepMutation = useMutation({
    mutationFn: ({ portalId, ...data }) => portalApi.addStep(portalId, data),
    onSuccess: () => {
      qc.invalidateQueries(['portal', projectId]);
      setShowAddStep(false);
      setStepForm({ type: 'form', title: '', description: '', required: true });
      toast.success('Βήμα προστέθηκε');
    },
    onError: (e) => toast.error(e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ stepId, ...data }) => portalApi.reviewStep(stepId, data),
    onSuccess: () => {
      qc.invalidateQueries(['portal', projectId]);
      setReviewDialog(null);
      toast.success('Βήμα αξιολογήθηκε');
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-text-muted">Φόρτωση portal…</div>;

  const noPortal = !portal || error;

  const copyLink = () => {
    if (portal?.portal_url) {
      navigator.clipboard.writeText(portal.portal_url);
      toast.success('Σύνδεσμος αντιγράφηκε!');
    }
  };

  return (
    <div className="space-y-5">
      {noPortal ? (
        <div className="card text-center py-10">
          <p className="text-text-muted mb-4">Δεν υπάρχει client portal για αυτόν τον φάκελο</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Δημιουργία Portal
          </button>
        </div>
      ) : (
        <>
          {/* Portal header */}
          <div className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold mb-1">Client Portal</h3>
                <span className={`text-sm font-medium ${STATUS_COLORS[portal.status] || 'text-text-muted'}`}>
                  ● {STATUS_LABELS[portal.status] || portal.status}
                </span>
              </div>
              <div className="flex gap-2">
                {portal.status === 'draft' && (
                  <button
                    className="btn-primary bg-green-600 hover:bg-green-700 text-sm"
                    onClick={() => updateMutation.mutate({ id: portal.id, status: 'active' })}
                    disabled={updateMutation.isPending}
                  >
                    ▶ Ενεργοποίηση
                  </button>
                )}
                {portal.status === 'active' && (
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => updateMutation.mutate({ id: portal.id, status: 'completed' })}
                    disabled={updateMutation.isPending}
                  >
                    ✓ Ολοκλήρωση
                  </button>
                )}
              </div>
            </div>

            {/* Portal link */}
            {portal.portal_url && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-white/5 rounded-lg">
                <span className="text-xs text-text-muted flex-1 font-mono truncate">{portal.portal_url}</span>
                <button onClick={copyLink} className="btn-secondary text-xs px-2 py-1 flex-shrink-0">
                  📋 Αντιγραφή
                </button>
                <a
                  href={portal.portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs px-2 py-1 flex-shrink-0"
                >
                  ↗ Άνοιγμα
                </a>
              </div>
            )}

            {/* Message */}
            <div className="mt-3">
              <label className="text-xs text-text-muted block mb-1">Μήνυμα προς πελάτη</label>
              <textarea
                className="input w-full text-sm"
                rows={3}
                value={portal.client_message || ''}
                onChange={(e) => updateMutation.mutate({ id: portal.id, client_message: e.target.value })}
                onBlur={(e) => updateMutation.mutate({ id: portal.id, client_message: e.target.value })}
              />
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-text-secondary uppercase tracking-wider">
                Βήματα ({portal.steps?.length || 0})
              </h3>
              <button className="btn-secondary text-xs" onClick={() => setShowAddStep(true)}>
                + Βήμα
              </button>
            </div>

            <div className="space-y-2">
              {(portal.steps || []).map((step) => (
                <div key={step.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 font-mono uppercase">{step.type}</span>
                        <span className="font-medium text-sm">{step.title}</span>
                        {!step.required && <span className="text-xs text-text-muted">(προαιρετικό)</span>}
                      </div>
                      {step.description && <p className="text-xs text-text-muted mb-1">{step.description}</p>}
                      <div className="text-xs">{STEP_STATUS_LABELS[step.status] || step.status}</div>
                      {step.admin_comment && (
                        <div className="text-xs text-amber-400 mt-1">💬 {step.admin_comment}</div>
                      )}
                    </div>

                    {/* Review actions */}
                    {(step.status === 'submitted' || step.status === 'in_review') && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          className="btn-primary text-xs px-2 py-1 bg-green-600 hover:bg-green-700"
                          onClick={() => reviewMutation.mutate({ stepId: step.id, action: 'approve' })}
                          disabled={reviewMutation.isPending}
                        >
                          ✓ Έγκριση
                        </button>
                        <button
                          className="btn-secondary text-xs px-2 py-1 text-amber-400"
                          onClick={() => setReviewDialog({ stepId: step.id, action: 'revision' })}
                        >
                          ⚠ Διόρθωση
                        </button>
                      </div>
                    )}

                    {/* Files count */}
                    {step.files?.length > 0 && (
                      <span className="text-xs text-text-muted flex-shrink-0">
                        📎 {step.files.length} αρχεία
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {(!portal.steps || portal.steps.length === 0) && (
                <div className="text-text-muted text-sm text-center py-6">
                  Δεν υπάρχουν βήματα — προσθέστε ένα
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Portal modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h3 className="font-semibold text-lg mb-4">Δημιουργία Client Portal</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Γλώσσα</label>
                <select
                  className="input w-full"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                >
                  <option value="el">Ελληνικά</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Μήνυμα προς πελάτη</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  value={form.client_message}
                  onChange={(e) => setForm({ ...form, client_message: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Ακύρωση</button>
              <button
                className="btn-primary"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate({ project_id: projectId, ...form })}
              >
                {createMutation.isPending ? 'Δημιουργία…' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Step modal */}
      {showAddStep && portal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h3 className="font-semibold text-lg mb-4">Προσθήκη Βήματος</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Τύπος</label>
                <select
                  className="input w-full"
                  value={stepForm.type}
                  onChange={(e) => setStepForm({ ...stepForm, type: e.target.value })}
                >
                  <option value="form">Φόρμα στοιχείων</option>
                  <option value="upload">Ανέβασμα αρχείου</option>
                  <option value="sign">Υπογραφή</option>
                  <option value="pay">Πληρωμή</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Τίτλος</label>
                <input
                  className="input w-full"
                  value={stepForm.title}
                  onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                  placeholder="π.χ. Στοιχεία ιδιοκτήτη"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Περιγραφή (προαιρετικό)</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={stepForm.description}
                  onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="step-required"
                  checked={stepForm.required}
                  onChange={(e) => setStepForm({ ...stepForm, required: e.target.checked })}
                />
                <label htmlFor="step-required" className="text-sm">Υποχρεωτικό βήμα</label>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button className="btn-secondary" onClick={() => setShowAddStep(false)}>Ακύρωση</button>
              <button
                className="btn-primary"
                disabled={addStepMutation.isPending || !stepForm.title}
                onClick={() => addStepMutation.mutate({ portalId: portal.id, ...stepForm })}
              >
                {addStepMutation.isPending ? 'Αποθήκευση…' : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review with comment dialog */}
      {reviewDialog && (
        <RevisionDialog
          onClose={() => setReviewDialog(null)}
          onSubmit={(comment) => reviewMutation.mutate({ stepId: reviewDialog.stepId, action: 'revision', comment })}
          isPending={reviewMutation.isPending}
        />
      )}
    </div>
  );
}

function RevisionDialog({ onClose, onSubmit, isPending }) {
  const [comment, setComment] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card max-w-sm w-full mx-4">
        <h3 className="font-semibold mb-3">Αίτημα Διόρθωσης</h3>
        <textarea
          className="input w-full mb-4"
          rows={3}
          placeholder="Περιγράψτε τι χρειάζεται διόρθωση…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Ακύρωση</button>
          <button
            className="btn-primary bg-amber-600 hover:bg-amber-700"
            disabled={isPending || !comment}
            onClick={() => onSubmit(comment)}
          >
            {isPending ? 'Αποστολή…' : 'Αποστολή'}
          </button>
        </div>
      </div>
    </div>
  );
}
