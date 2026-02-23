import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '../../api/projects.js';
import { PERMIT_TYPES, NEW_ACT_TYPES, CONTINUATION_TYPES } from '../../utils/index.js';

export default function ProjectForm({ onClose, onSubmit, loading }) {
  // Step 1: new act vs continuation
  const [isContinuation, setIsContinuation] = useState(false);

  const defaultType = isContinuation ? 'revision' : 'new_building';
  const [form, setForm] = useState({
    type: defaultType, title: '', client_id: '', yd_id: '', dimos_aa: '',
    aitisi_descr: '', deadline: '', notes: '',
  });

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list({}) });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleContinuationToggle = (value) => {
    setIsContinuation(value);
    // Set default type for the selected category
    setForm(f => ({
      ...f,
      type: value ? CONTINUATION_TYPES[0] : NEW_ACT_TYPES[0],
    }));
  };

  const typeOptions = isContinuation ? CONTINUATION_TYPES : NEW_ACT_TYPES;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      is_continuation: isContinuation,
      yd_id: form.yd_id ? Number(form.yd_id) : undefined,
      dimos_aa: form.dimos_aa ? Number(form.dimos_aa) : undefined,
      client_id: form.client_id || undefined,
    });
  };

  const pt = PERMIT_TYPES[form.type];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151922] border border-white/10 rounded-2xl p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-6">Νέος Φάκελος</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Step 1: Νέα Πράξη vs Σε Συνέχεια */}
          <div>
            <label className="label">Κατηγορία Αίτησης *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleContinuationToggle(false)}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  !isContinuation
                    ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                    : 'border-white/10 text-text-muted hover:border-white/20'
                }`}>
                Νέα Πράξη
              </button>
              <button
                type="button"
                onClick={() => handleContinuationToggle(true)}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  isContinuation
                    ? 'border-orange-500 bg-orange-500/15 text-orange-300'
                    : 'border-white/10 text-text-muted hover:border-white/20'
                }`}>
                Σε Συνέχεια Προηγούμενης
              </button>
            </div>
          </div>

          {/* Step 2: Specific permit type */}
          <div>
            <label className="label">Τύπος Πράξης *</label>
            <select className="select" value={form.type}
              onChange={e => set('type', e.target.value)} required>
              {typeOptions.map(id => (
                <option key={id} value={id}>{PERMIT_TYPES[id].label}</option>
              ))}
            </select>
            {pt && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: pt.color }} />
                {pt.shortLabel}
              </div>
            )}
          </div>

          <div>
            <label className="label">Τίτλος Έργου *</label>
            <input className="input" placeholder="π.χ. Νέα Κατοικία — Καλαμάτα" value={form.title}
              onChange={e => set('title', e.target.value)} required />
          </div>

          <div>
            <label className="label">Ιδιοκτήτης / Πελάτης</label>
            <select className="select" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— Επιλογή —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.surname} {c.name} {c.afm ? `(ΑΦΜ: ${c.afm})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ID Υπηρεσίας Δόμησης</label>
              <input className="input" placeholder="YD_ID (ΤΕΕ)" value={form.yd_id}
                onChange={e => set('yd_id', e.target.value)} type="number" min="1" />
            </div>
            <div>
              <label className="label">Κωδικός Δήμου</label>
              <input className="input" placeholder="DIMOS_AA (ΤΕΕ)" value={form.dimos_aa}
                onChange={e => set('dimos_aa', e.target.value)} type="number" min="1" />
            </div>
          </div>

          <div>
            <label className="label">Περιγραφή Αίτησης (XML)</label>
            <textarea className="input h-20 resize-none" placeholder="AITISI_DESCR — max 1024 χαρ." value={form.aitisi_descr}
              onChange={e => set('aitisi_descr', e.target.value)} maxLength={1024} />
          </div>

          <div>
            <label className="label">Προθεσμία</label>
            <input className="input" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
          </div>

          <div>
            <label className="label">Σημειώσεις</label>
            <textarea className="input h-16 resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Ακύρωση</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Δημιουργία…' : 'Δημιουργία Φακέλου'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
