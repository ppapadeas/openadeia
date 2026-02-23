import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { teeApi } from '../../api/projects.js';
import { PERMIT_TYPES } from '../../utils/index.js';

export default function TeeSyncPanel({ onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncResult, setSyncResult] = useState(null);
  const [selected, setSelected] = useState(new Set());

  // Check if credentials are configured
  const { data: status } = useQuery({
    queryKey: ['tee-status'],
    queryFn: teeApi.status,
  });

  // Sync mutation — calls TEE portal
  const syncMutation = useMutation({
    mutationFn: teeApi.sync,
    onSuccess: (data) => {
      setSyncResult(data);
      // Auto-select non-imported ones
      const newSel = new Set(
        data.applications
          .filter(a => !a.already_imported && a.tee_permit_code)
          .map(a => a.tee_permit_code)
      );
      setSelected(newSel);
      toast.success(`Βρέθηκαν ${data.count} αιτήσεις από το ΤΕΕ`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (apps) => teeApi.import(apps),
    onSuccess: (data) => {
      toast.success(`Εισήχθησαν ${data.imported} αιτήσεις`);
      qc.invalidateQueries(['projects']);
      if (data.imported > 0) onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleSelect = (code) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleImport = () => {
    const apps = syncResult.applications.filter(
      a => selected.has(a.tee_permit_code) && !a.already_imported
    );
    if (apps.length === 0) { toast.error('Δεν επιλέξατε αιτήσεις'); return; }
    importMutation.mutate(apps);
  };

  const notConfigured = status && !status.configured;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151922] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="font-bold text-base">Συγχρονισμός από ΤΕΕ e-Adeies</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {status?.tee_username
                ? `Σύνδεση ως: ${status.tee_username}`
                : 'Ανάκτηση αιτήσεων από το portal του ΤΕΕ'
              }
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {notConfigured ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🔑</div>
              <p className="font-medium mb-1">Δεν έχετε ορίσει στοιχεία ΤΕΕ</p>
              <p className="text-sm text-text-muted mb-4">
                Μεταβείτε στο Προφίλ σας για να εισάγετε το username και τον κωδικό σας στο ΤΕΕ e-Adeies.
              </p>
              <button className="btn-primary mx-auto" onClick={() => { onClose(); navigate('/profile'); }}>
                Ρυθμίσεις Προφίλ
              </button>
            </div>
          ) : !syncResult ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-4">🔄</div>
              <p className="text-sm text-text-muted mb-6">
                Θα συνδεθούμε στο ΤΕΕ e-Adeies με τα αποθηκευμένα στοιχεία σας
                και θα ανακτήσουμε τις αιτήσεις σας.
              </p>
              <button
                className="btn-primary mx-auto"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}>
                {syncMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⟳</span> Σύνδεση στο ΤΕΕ…
                  </span>
                ) : 'Ανάκτηση Αιτήσεων από ΤΕΕ'}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-muted">
                  {syncResult.count} αιτήσεις βρέθηκαν · {selected.size} επιλεγμένες
                </span>
                <button
                  className="text-xs text-accent-blue hover:underline"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}>
                  ⟳ Ανανέωση
                </button>
              </div>

              {syncResult.applications.length === 0 ? (
                <p className="text-center text-text-muted py-8">Δεν βρέθηκαν αιτήσεις στο ΤΕΕ.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {syncResult.applications.map((app) => {
                    const pt = PERMIT_TYPES[
                      app.is_continuation ? 'revision' : 'new_building'
                    ] || PERMIT_TYPES.new_building;
                    const isSelected = selected.has(app.tee_permit_code);
                    const imported = app.already_imported;

                    return (
                      <label
                        key={app.tee_permit_code}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          imported
                            ? 'border-white/5 opacity-50 cursor-default'
                            : isSelected
                            ? 'border-accent-blue/50 bg-accent-blue/5'
                            : 'border-white/10 hover:border-white/20'
                        }`}>
                        <input
                          type="checkbox"
                          checked={isSelected && !imported}
                          disabled={imported}
                          onChange={() => !imported && toggleSelect(app.tee_permit_code)}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-mono font-bold" style={{ color: pt.color }}>
                              {app.tee_permit_code}
                            </span>
                            {app.is_continuation && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300">
                                Συνέχεια
                              </span>
                            )}
                            {imported && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                                ✓ Υπάρχει ήδη
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium truncate">{app.title}</div>
                          <div className="flex gap-3 text-xs text-text-muted mt-0.5">
                            {app.address && <span>📍 {app.address}{app.city ? `, ${app.city}` : ''}</span>}
                            {app.kaek && <span className="font-mono">ΚΑΕΚ: {app.kaek}</span>}
                            {app.tee_status && <span>Κατάσταση: {app.tee_status}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {syncResult && syncResult.applications.length > 0 && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
            <button className="btn-secondary flex-1" onClick={onClose}>Κλείσιμο</button>
            <button
              className="btn-primary flex-1 justify-center"
              onClick={handleImport}
              disabled={importMutation.isPending || selected.size === 0}>
              {importMutation.isPending
                ? 'Εισαγωγή…'
                : `Εισαγωγή ${selected.size} Αιτήσεων`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
