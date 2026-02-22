import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { nokApi, clientsApi } from '../../api/projects.js';
import { PERMIT_TYPES } from '../../utils/index.js';

export default function ProjectForm({ onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    type: 'vod', title: '', client_id: '', yd_id: '', dimos_aa: '',
    aitisi_descr: '', deadline: '', notes: '',
  });

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list({}) });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      yd_id: form.yd_id ? Number(form.yd_id) : undefined,
      dimos_aa: form.dimos_aa ? Number(form.dimos_aa) : undefined,
      client_id: form.client_id || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151922] border border-white/10 rounded-2xl p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-6">Νέος Φάκελος</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label">Τύπος Πράξης *</label>
            <select className="select" value={form.type} onChange={e => set('type', e.target.value)} required>
              {Object.entries(PERMIT_TYPES).map(([id, v]) => (
                <option key={id} value={id}>{v.label}</option>
              ))}
            </select>
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
