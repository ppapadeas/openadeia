import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { nokApi } from '../../api/projects.js';
import { PERMIT_TYPES } from '../../utils/index.js';

export default function RulesViewer() {
  const [selected, setSelected] = useState('vod');

  const { data: rules } = useQuery({
    queryKey: ['nok-rules', selected],
    queryFn: () => nokApi.rules(selected),
  });

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">ΝΟΚ Κανόνες & Απαιτήσεις</h1>
        <p className="text-text-muted text-sm mt-1">Ν.4067/2012, Ν.4495/2017, Ν.4759/2020</p>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.entries(PERMIT_TYPES).map(([id, v]) => (
          <button key={id}
            onClick={() => setSelected(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              selected === id
                ? 'text-white border-transparent'
                : 'border-border-subtle text-text-muted hover:text-text-primary hover:bg-white/5'
            }`}
            style={selected === id ? { background: v.color, borderColor: v.color } : {}}
          >
            {v.label}
          </button>
        ))}
      </div>

      {rules && (
        <div className="space-y-4">
          {/* Νομοθεσία */}
          <div className="card">
            <h3 className="font-semibold mb-2">Νομικό Πλαίσιο</h3>
            <div className="flex flex-wrap gap-2">
              {rules.nokArticles?.map((a, i) => (
                <span key={i} className="badge bg-white/5 text-text-secondary text-xs px-3 py-1.5">{a}</span>
              ))}
            </div>
          </div>

          {/* Μελέτες */}
          {rules.requiredStudies?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3">Απαιτούμενες Μελέτες ({rules.requiredStudies.length})</h3>
              <div className="space-y-2">
                {rules.requiredStudies.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                    <span className="text-sm">{s.label}</span>
                    <span className="badge bg-white/5 text-text-muted text-xs">{s.signerRole}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Δικαιολογητικά */}
          <div className="card">
            <h3 className="font-semibold mb-3">Δικαιολογητικά ({rules.requiredDocuments?.length})</h3>
            <div className="space-y-2">
              {rules.requiredDocuments?.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                  <span className="text-sm">{d.label}</span>
                  {d.signerRole && <span className="badge bg-white/5 text-text-muted text-xs">{d.signerRole}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Εγκρίσεις */}
          {rules.requiredApprovals?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3">Απαιτούμενες Εγκρίσεις</h3>
              <div className="flex flex-wrap gap-2">
                {rules.requiredApprovals.map((a, i) => (
                  <span key={i} className="badge bg-amber-500/10 text-amber-400 text-sm px-3 py-1.5">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="card">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-accent-blue">{rules.estimatedDays}</div>
                <div className="text-xs text-text-muted mt-0.5">Εκτιμώμενες Ημέρες</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent-green">{rules.requiredDocuments?.length + rules.requiredStudies?.length}</div>
                <div className="text-xs text-text-muted mt-0.5">Αρχεία Συνολικά</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent-amber">{rules.requiredApprovals?.length}</div>
                <div className="text-xs text-text-muted mt-0.5">Εγκρίσεις</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
