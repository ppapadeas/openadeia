import { useState } from 'react';

export default function ClientForm({ onClose, onSubmit, loading, initial = {} }) {
  const [form, setForm] = useState({
    surname: '', name: '', father_name: '', mother_name: '',
    owner_type: 1, email: '', phone: '', mobile: '',
    afm: '', afm_ex: '', adt: '', address: '', city: '', zip_code: '',
    ...initial,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, owner_type: Number(form.owner_type) });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151922] border border-white/10 rounded-2xl p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-6">Νέος Πελάτης / Ιδιοκτήτης</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Επώνυμο *</label>
              <input className="input" value={form.surname} onChange={e => set('surname', e.target.value)} required maxLength={40} />
            </div>
            <div>
              <label className="label">Όνομα *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required maxLength={20} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Πατρώνυμο</label>
              <input className="input" value={form.father_name} onChange={e => set('father_name', e.target.value)} maxLength={20} />
            </div>
            <div>
              <label className="label">Μητρώνυμο</label>
              <input className="input" value={form.mother_name} onChange={e => set('mother_name', e.target.value)} maxLength={20} />
            </div>
          </div>
          <div>
            <label className="label">Τύπος Ιδιοκτήτη</label>
            <select className="select" value={form.owner_type} onChange={e => set('owner_type', e.target.value)}>
              <option value={1}>Φυσικό Πρόσωπο</option>
              <option value={2}>Νομικό Πρόσωπο</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ΑΦΜ</label>
              <input className="input font-mono" value={form.afm} onChange={e => set('afm', e.target.value)} maxLength={10} placeholder="Ελληνικό ΑΦΜ" />
            </div>
            <div>
              <label className="label">ΑΔΤ</label>
              <input className="input font-mono" value={form.adt} onChange={e => set('adt', e.target.value)} maxLength={8} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Τηλέφωνο *</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={16} placeholder="+30..." required />
            </div>
            <div>
              <label className="label">Κινητό</label>
              <input className="input" value={form.mobile} onChange={e => set('mobile', e.target.value)} maxLength={16} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} maxLength={64} />
          </div>
          <div>
            <label className="label">Διεύθυνση</label>
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} maxLength={64} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Πόλη</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} maxLength={32} />
            </div>
            <div>
              <label className="label">ΤΚ</label>
              <input className="input font-mono" value={form.zip_code} onChange={e => set('zip_code', e.target.value)} maxLength={5} placeholder="12345" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Ακύρωση</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
