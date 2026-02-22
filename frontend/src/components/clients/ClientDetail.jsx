import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientsApi } from '../../api/projects.js';
import { PERMIT_TYPES, STAGES } from '../../utils/index.js';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsApi.get(id),
  });

  if (isLoading) return <div className="p-7 text-text-muted">Φόρτωση…</div>;
  if (!client) return <div className="p-7 text-red-400">Πελάτης δεν βρέθηκε</div>;

  return (
    <div className="p-7 max-w-3xl">
      <button onClick={() => navigate('/clients')} className="text-text-muted text-sm hover:text-text-primary mb-5 flex items-center gap-1">
        ← Πίσω στους πελάτες
      </button>

      <div className="card mb-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-accent-blue/20 flex items-center justify-center font-bold text-accent-blue text-xl">
            {client.surname[0]}{client.name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold">{client.surname} {client.name}</h1>
            {client.father_name && <p className="text-text-muted text-sm">του {client.father_name}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {client.afm && <div><span className="text-text-muted">ΑΦΜ:</span> <span className="font-mono">{client.afm}</span></div>}
          {client.adt && <div><span className="text-text-muted">ΑΔΤ:</span> <span className="font-mono">{client.adt}</span></div>}
          {client.phone && <div><span className="text-text-muted">Τηλ:</span> {client.phone}</div>}
          {client.mobile && <div><span className="text-text-muted">Κινητό:</span> {client.mobile}</div>}
          {client.email && <div><span className="text-text-muted">Email:</span> {client.email}</div>}
          {client.address && <div className="col-span-2"><span className="text-text-muted">Διεύθυνση:</span> {client.address}, {client.city} {client.zip_code}</div>}
        </div>
      </div>

      <h2 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Φάκελοι</h2>
      <div className="flex flex-col gap-2">
        {(client.projects || []).map(p => {
          const pt = PERMIT_TYPES[p.type] || PERMIT_TYPES.vod;
          const stage = STAGES.find(s => s.id === p.stage);
          return (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
              className="card card-hover flex items-center gap-4">
              <span className="badge text-xs px-2 py-0.5 font-bold" style={{ background: pt.color + '20', color: pt.color }}>{pt.shortLabel}</span>
              <span className="text-sm font-medium flex-1">{p.title}</span>
              <span className="text-xs text-text-muted">{stage?.icon} {stage?.label}</span>
              <span className="text-text-muted">›</span>
            </div>
          );
        })}
        {(!client.projects || client.projects.length === 0) && (
          <div className="text-text-muted text-sm">Δεν υπάρχουν φάκελοι</div>
        )}
      </div>
    </div>
  );
}
