// ── Permit type taxonomy (correct TEE e-Adeies categories) ─────────
// Top-level distinction: νέα πράξη (is_continuation=false) vs σε συνέχεια (is_continuation=true)
export const PERMIT_TYPES = {
  // ── Νέα Πράξη ────────────────────────────────────────────────────
  new_building: { label: 'Νέα Οικοδομική Άδεια',           shortLabel: 'Νέα Άδεια',    color: '#EF4444', is_continuation: false },
  minor_cat1:   { label: 'Έγκριση Εργασιών Δόμησης Κατ.1', shortLabel: 'Κατ.1',        color: '#10B981', is_continuation: false },
  minor_cat2:   { label: 'Έγκριση Εργασιών Δόμησης Κατ.2', shortLabel: 'Κατ.2',        color: '#8B5CF6', is_continuation: false },
  vod:          { label: 'Βεβαίωση Όρων Δόμησης',           shortLabel: 'ΒΟΔ',          color: '#3B82F6', is_continuation: false },
  preapproval:  { label: 'Προέγκριση Οικοδομικής Άδειας',  shortLabel: 'Προέγκριση',   color: '#F59E0B', is_continuation: false },
  // ── Σε Συνέχεια ──────────────────────────────────────────────────
  revision:     { label: 'Αναθεώρηση Οικοδομικής Άδειας',  shortLabel: 'Αναθεώρηση',   color: '#F97316', is_continuation: true  },
  revision_ext: { label: 'Αναθεώρηση με Επέκταση',          shortLabel: 'Αναθ.+Επέκτ.', color: '#EC4899', is_continuation: true  },
  file_update:  { label: 'Ενημέρωση Φακέλου',               shortLabel: 'Ενημέρωση',    color: '#6B7280', is_continuation: true  },
};

export const NEW_ACT_TYPES = Object.entries(PERMIT_TYPES).filter(([, v]) => !v.is_continuation).map(([id]) => id);
export const CONTINUATION_TYPES = Object.entries(PERMIT_TYPES).filter(([, v]) => v.is_continuation).map(([id]) => id);

export const STAGES = [
  { id: 'init',            label: 'Καταχώρηση',      icon: '📋' },
  { id: 'data_collection', label: 'Συλλογή Στοιχείων', icon: '📄' },
  { id: 'studies',         label: 'Μελέτες',          icon: '📐' },
  { id: 'signatures',      label: 'Υπογραφές',        icon: '✍️' },
  { id: 'submission',      label: 'Υποβολή',          icon: '📤' },
  { id: 'review',          label: 'Έλεγχος ΥΔΟΜ',    icon: '🏛️' },
  { id: 'approved',        label: 'Έγκριση',          icon: '✅' },
];

export const DOC_STATUS = {
  pending:     { label: 'Εκκρεμεί',       color: '#D97706', bg: 'rgba(245,158,11,0.12)' },
  uploaded:    { label: 'Ανέβηκε',        color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  signed:      { label: 'Υπεγράφη',       color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  rejected:    { label: 'Απορρίφθηκε',    color: '#DC2626', bg: 'rgba(239,68,68,0.12)'  },
  in_progress: { label: 'Σε εξέλιξη',    color: '#2563EB', bg: 'rgba(59,130,246,0.12)'  },
  not_started: { label: 'Δεν ξεκίνησε',  color: '#6B7280', bg: 'rgba(107,114,128,0.1)'  },
  na:          { label: 'Δεν απαιτείται', color: '#9CA3AF', bg: 'rgba(107,114,128,0.06)' },
  completed:   { label: 'Ολοκληρώθηκε',  color: '#059669', bg: 'rgba(16,185,129,0.12)' },
};

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function stageProgress(type, stage) {
  const stageOrders = {
    new_building:  ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
    minor_cat1:    ['init', 'data_collection', 'studies', 'submission', 'review', 'approved'],
    minor_cat2:    ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
    vod:           ['init', 'data_collection', 'submission', 'review', 'approved'],
    preapproval:   ['init', 'data_collection', 'studies', 'submission', 'review', 'approved'],
    revision:      ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
    revision_ext:  ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
    file_update:   ['init', 'data_collection', 'submission', 'review', 'approved'],
  };
  const stages = stageOrders[type] || stageOrders.new_building;
  const idx = stages.indexOf(stage);
  if (idx === -1) return 0;
  return Math.round((idx / (stages.length - 1)) * 100);
}
