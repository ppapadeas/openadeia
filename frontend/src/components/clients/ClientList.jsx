import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientsApi } from '../../api/projects.js';
import ClientForm from './ClientForm.jsx';

export default function ClientList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list({ q: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => clientsApi.create(data),
    onSuccess: (c) => { qc.invalidateQueries(['clients']); setShowForm(false); toast.success('Πελάτης καταχωρήθηκε'); navigate(`/clients/${c.id}`); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-7">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Πελάτες</h1>
          <p className="text-text-muted text-sm mt-1">Ιδιοκτήτες & Ανάδοχοι</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Νέος Πελάτης</button>
      </div>

      <input className="input w-64 mb-5" placeholder="Αναζήτηση ονόματος, ΑΦΜ…" value={search} onChange={e => setSearch(e.target.value)} />

      {isLoading ? (
        <div className="text-text-muted text-sm">Φόρτωση…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {clients.map(c => (
            <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
              className="card card-hover flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-accent-blue/20 flex items-center justify-center font-bold text-accent-blue text-sm flex-shrink-0">
                {c.surname[0]}{c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{c.surname} {c.name}</div>
                <div className="text-xs text-text-muted flex gap-3 mt-0.5">
                  {c.afm && <span>ΑΦΜ: {c.afm}</span>}
                  {c.phone && <span>📞 {c.phone}</span>}
                  {c.email && <span>✉ {c.email}</span>}
                </div>
              </div>
              <span className="text-text-muted text-lg">›</span>
            </div>
          ))}
          {clients.length === 0 && <div className="text-text-muted text-sm">Δεν βρέθηκαν πελάτες</div>}
        </div>
      )}

      {showForm && <ClientForm onClose={() => setShowForm(false)} onSubmit={createMutation.mutate} loading={createMutation.isPending} />}
    </div>
  );
}
