import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { portalApi } from '../api/projects.js';

const STEP_TYPE_ICONS = {
  form: '📝',
  upload: '📎',
  sign: '✍️',
  pay: '💳',
};

const STEP_STATUS_STYLES = {
  locked: { label: 'Κλειδωμένο', color: 'text-text-muted', bg: 'bg-white/5' },
  available: { label: 'Εκκρεμεί', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  submitted: { label: 'Υποβλήθηκε', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  in_review: { label: 'Σε Έλεγχο', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  revision: { label: 'Χρειάζεται Διόρθωση', color: 'text-red-400', bg: 'bg-red-400/10' },
  done: { label: 'Ολοκληρώθηκε', color: 'text-green-400', bg: 'bg-green-400/10' },
  skipped: { label: 'Παρακάμφθηκε', color: 'text-text-muted', bg: 'bg-white/5' },
};

export default function ClientPortal() {
  const { token } = useParams();
  const qc = useQueryClient();
  const [activeStep, setActiveStep] = useState(null);

  const { data: portal, isLoading, error } = useQuery({
    queryKey: ['public-portal', token],
    queryFn: () => portalApi.getPublic(token),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-text-muted">Φόρτωση…</div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold mb-2">Portal δεν βρέθηκε</h1>
          <p className="text-text-muted text-sm">
            Ο σύνδεσμος που χρησιμοποιήσατε δεν είναι έγκυρος ή έχει λήξει.
            Παρακαλώ επικοινωνήστε με τον μηχανικό σας.
          </p>
        </div>
      </div>
    );
  }

  const steps = portal.steps || [];
  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="bg-[#151922] border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-blue/20 flex items-center justify-center text-xl">🏛</div>
            <div>
              <h1 className="font-bold text-lg">{portal.project_title || 'Φάκελος Αδειοδότησης'}</h1>
              <p className="text-text-muted text-xs">Forma Architecture — Client Portal</p>
            </div>
          </div>

          {/* Progress bar */}
          {steps.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-text-muted mb-1.5">
                <span>{doneCount} / {steps.length} βήματα ολοκληρώθηκαν</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-blue rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Welcome message */}
        {portal.client_message && (
          <div className="bg-[#151922] border border-white/10 rounded-xl p-4 text-sm text-text-secondary">
            {portal.client_message}
          </div>
        )}

        {/* Completed banner */}
        {portal.status === 'completed' && (
          <div className="bg-green-400/10 border border-green-400/30 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">🎉</div>
            <div className="font-semibold text-green-400">Ο φάκελός σας ολοκληρώθηκε!</div>
            <div className="text-text-muted text-sm mt-1">Ευχαριστούμε για τη συνεργασία.</div>
          </div>
        )}

        {/* Steps list */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const style = STEP_STATUS_STYLES[step.status] || STEP_STATUS_STYLES.available;
            const isLocked = step.status === 'locked';
            const isDone = step.status === 'done' || step.status === 'skipped';
            const isOpen = activeStep === step.id;
            const canInteract = ['available', 'revision'].includes(step.status);

            return (
              <div
                key={step.id}
                className={`bg-[#151922] border rounded-xl overflow-hidden transition-all ${
                  isLocked ? 'border-white/5 opacity-60' : 'border-white/10'
                } ${isDone ? 'border-green-400/20' : ''}`}
              >
                {/* Step header */}
                <button
                  className="w-full text-left p-4 flex items-center gap-3"
                  onClick={() => !isLocked && setActiveStep(isOpen ? null : step.id)}
                  disabled={isLocked}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    isDone ? 'bg-green-400/20 text-green-400' :
                    isLocked ? 'bg-white/5 text-text-muted' :
                    'bg-accent-blue/20 text-accent-blue'
                  }`}>
                    {isDone ? '✓' : isLocked ? '🔒' : idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm">{STEP_TYPE_ICONS[step.type]}</span>
                      <span className="font-medium text-sm">{step.title}</span>
                      {!step.required && (
                        <span className="text-xs text-text-muted">(προαιρετικό)</span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">{step.description}</p>
                    )}
                  </div>

                  <div className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${style.color}`}>
                    {style.label}
                  </div>
                </button>

                {/* Step content (expanded) */}
                {isOpen && !isLocked && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-4">
                    {step.admin_comment && (
                      <div className="mb-3 p-3 bg-amber-400/10 border border-amber-400/20 rounded-lg text-sm text-amber-400">
                        <span className="font-medium">Σχόλιο μηχανικού:</span> {step.admin_comment}
                      </div>
                    )}

                    {step.type === 'form' && canInteract && (
                      <FormStep
                        step={step}
                        token={token}
                        onSuccess={() => {
                          qc.invalidateQueries(['public-portal', token]);
                          setActiveStep(null);
                        }}
                      />
                    )}

                    {step.type === 'upload' && canInteract && (
                      <UploadStep
                        step={step}
                        token={token}
                        onSuccess={() => {
                          qc.invalidateQueries(['public-portal', token]);
                          setActiveStep(null);
                        }}
                      />
                    )}

                    {(step.type === 'sign' || step.type === 'pay') && canInteract && (
                      <div className="text-text-muted text-sm text-center py-4">
                        Αυτό το βήμα θα είναι διαθέσιμο σύντομα.<br />
                        Επικοινωνήστε με τον μηχανικό σας για οδηγίες.
                      </div>
                    )}

                    {isDone && (
                      <div className="text-green-400 text-sm text-center py-2">
                        ✓ Ολοκληρώθηκε
                        {step.completed_at && (
                          <span className="text-text-muted text-xs ml-2">
                            {new Date(step.completed_at).toLocaleDateString('el-GR')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Uploaded files */}
                    {step.files?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-text-muted mb-2">Ανεβασμένα αρχεία:</div>
                        <div className="space-y-1">
                          {step.files.map((f) => (
                            <div key={f.id} className="flex items-center gap-2 text-xs text-text-secondary">
                              <span>📄</span>
                              <span className="truncate">{f.original_name}</span>
                              <span className="text-text-muted flex-shrink-0">
                                {f.size_bytes ? `${Math.round(f.size_bytes / 1024)} KB` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {steps.length === 0 && (
            <div className="text-center py-10 text-text-muted text-sm">
              Δεν υπάρχουν βήματα ακόμα. Επικοινωνήστε με τον μηχανικό σας.
            </div>
          )}
        </div>

        <div className="text-center text-xs text-text-muted pt-4 pb-8">
          Powered by <span className="font-medium">OpenAdeia</span> · Forma Architecture
        </div>
      </div>
    </div>
  );
}

// ── Form Step Component ──────────────────────────────────────────────────────

function FormStep({ step, token, onSuccess }) {
  const fields = step.config?.fields || defaultFields(step.config?.preset);
  const [values, setValues] = useState(() => {
    const init = {};
    for (const f of fields) {
      init[f.name] = step.form_data?.[f.name] || '';
    }
    return init;
  });

  const mutation = useMutation({
    mutationFn: () => portalApi.submitForm(token, step.id, values),
    onSuccess,
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="text-xs text-text-muted block mb-1">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              className="input w-full text-sm"
              rows={3}
              value={values[field.name] || ''}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              placeholder={field.placeholder || ''}
            />
          ) : (
            <input
              className="input w-full text-sm"
              type={field.type || 'text'}
              value={values[field.name] || ''}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              placeholder={field.placeholder || ''}
            />
          )}
        </div>
      ))}

      <button
        className="btn-primary w-full mt-2"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Αποθήκευση…' : 'Υποβολή'}
      </button>
    </div>
  );
}

function defaultFields(preset) {
  const PRESETS = {
    client_personal: [
      { name: 'surname', label: 'Επώνυμο', required: true },
      { name: 'name', label: 'Όνομα', required: true },
      { name: 'father_name', label: 'Πατρώνυμο' },
      { name: 'afm', label: 'ΑΦΜ', required: true },
      { name: 'adt', label: 'Αριθμός Ταυτότητας' },
      { name: 'phone', label: 'Τηλέφωνο', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'address', label: 'Διεύθυνση' },
    ],
    property_info: [
      { name: 'kaek', label: 'ΚΑΕΚ' },
      { name: 'address', label: 'Διεύθυνση ακινήτου', required: true },
      { name: 'city', label: 'Πόλη / Περιοχή' },
      { name: 'area_sqm', label: 'Εμβαδόν (τ.μ.)', type: 'number' },
    ],
  };
  return PRESETS[preset] || [
    { name: 'notes', label: 'Σχόλια / Παρατηρήσεις', type: 'textarea' },
  ];
}

// ── Upload Step Component ────────────────────────────────────────────────────

function UploadStep({ step, token, onSuccess }) {
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file);
      return portalApi.uploadFile(token, step.id, fd);
    },
    onSuccess,
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-accent-blue/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <div className="text-3xl mb-2">📁</div>
        <div className="text-sm text-text-secondary mb-1">Κάντε κλικ για επιλογή αρχείου</div>
        <div className="text-xs text-text-muted">PDF, JPG, PNG έως 100MB</div>
        {file && (
          <div className="mt-3 text-sm text-accent-blue font-medium">✓ {file.name}</div>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      {file && (
        <button
          className="btn-primary w-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Ανέβασμα…' : `Ανέβασμα: ${file.name}`}
        </button>
      )}
    </div>
  );
}
