import { formatDate } from '../../../utils/index.js';

export default function EmailTab({ emails, onCompose }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-sm text-text-secondary">Αλληλογραφία</h3>
        <button className="btn-primary" onClick={onCompose}>+ Νέο Email</button>
      </div>
      <div className="space-y-2">
        {emails.map((e) => (
          <div key={e.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{e.subject}</div>
                <div className="text-xs text-text-muted mt-1">
                  {e.direction === 'sent' ? '→' : '←'} {e.direction === 'sent' ? e.to_address : e.from_address}
                  · {formatDate(e.sent_at)}
                </div>
              </div>
              <span className="badge text-xs" style={{ background: e.direction === 'sent' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', color: e.direction === 'sent' ? '#3B82F6' : '#10B981' }}>
                {e.direction === 'sent' ? 'Απεστάλη' : 'Ελήφθη'}
              </span>
            </div>
          </div>
        ))}
        {emails.length === 0 && <div className="text-text-muted text-sm">Δεν υπάρχει αλληλογραφία</div>}
      </div>
    </div>
  );
}
