export const PERMIT_TYPES = {
  vod:  { label: 'Βεβαίωση Όρων Δόμησης', shortLabel: 'ΒΟΔ',    color: '#3B82F6' },
  cat1: { label: 'Κατ. 1 — Μικρής Κλίμακας',   shortLabel: 'Κατ.1',  color: '#F59E0B' },
  cat2: { label: 'Κατ. 2 — Οικοδομική Άδεια',  shortLabel: 'Κατ.2',  color: '#EF4444' },
  cat3: { label: 'Κατ. 3 — Μεγάλης Κλίμακας',  shortLabel: 'Κατ.3',  color: '#7C3AED' },
};

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
    vod:  ['init', 'data_collection', 'submission', 'review', 'approved'],
    cat1: ['init', 'data_collection', 'studies', 'submission', 'review', 'approved'],
    cat2: ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
    cat3: ['init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved'],
  };
  const stages = stageOrders[type] || stageOrders.cat2;
  const idx = stages.indexOf(stage);
  if (idx === -1) return 0;
  return Math.round((idx / (stages.length - 1)) * 100);
}
