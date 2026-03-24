import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { feesApi } from '../../api/fees.js';

// ── Constants ──────────────────────────────────────────────────────────────

const AREAS = [
  { id: 'A1',  label: 'Κύρια χρήση' },
  { id: 'A2',  label: 'Ημιυπαίθριοι' },
  { id: 'A3',  label: 'Πιλοτή' },
  { id: 'A4',  label: 'Υπόγειο' },
  { id: 'A5',  label: 'Στέγη κεκλιμένη' },
  { id: 'A6',  label: 'Εξώστες / Μπαλκόνια' },
  { id: 'A7',  label: 'Κλιμακοστάσια / Κοινόχρηστα' },
  { id: 'A8',  label: 'Μηχανοστάσια / WC' },
  { id: 'A9',  label: 'Αποθήκες' },
  { id: 'A10', label: 'Ανοικτές θέσεις στάθμευσης' },
  { id: 'A11', label: 'Κλειστές θέσεις στάθμευσης' },
];

const STUDIES = [
  { id: 'EP1',  label: 'Αρχιτεκτονική μελέτη',    ks: 15  },
  { id: 'EP2',  label: 'Στατική μελέτη',           ks: 250 },
  { id: 'EP3',  label: 'Θερμομόνωση',              ks: 70  },
  { id: 'EP4',  label: 'Η/Μ εγκαταστάσεις',        ks: 90  },
  { id: 'EP5',  label: 'Υδραυλικές εγκαταστάσεις', ks: 100 },
  { id: 'EP6',  label: 'Πυρασφάλεια',              ks: 25  },
  { id: 'EP7',  label: 'Ειδικές εγκρίσεις',        ks: 60  },
  { id: 'EP8',  label: 'Μελέτη εδάφους',           ks: 15  },
  { id: 'EP9',  label: 'Μελέτη κυκλοφορίας',       ks: 40  },
  { id: 'EP10', label: 'Τοπογραφικό',              ks: 60  },
  { id: 'EP11', label: 'Φωτοτεχνική μελέτη',       ks: 20  },
  { id: 'EP12', label: 'Ακουστική μελέτη',         ks: 10  },
  { id: 'EP13', label: 'Ενεργειακή μελέτη (ΠΕΑ)', ks: 15  },
  { id: 'EP14', label: 'Παθητική πυροπροστασία',   ks: 20  },
];

const SUPERVISION = [
  { id: 'EP16', label: 'Επίβλεψη αρχιτεκτονική',  ks: 30 },
  { id: 'EP17', label: 'Επίβλεψη στατική',         ks: 30 },
  { id: 'EP18', label: 'Επίβλεψη Η/Μ',            ks: 0  },
  { id: 'EP19', label: 'Επίβλεψη υδραυλικών',     ks: 0  },
  { id: 'EP20', label: 'Επίβλεψη πυρασφάλειας',   ks: 70 },
  { id: 'EP21', label: 'Επίβλεψη θερμομόνωσης',   ks: 80 },
];

const DIFFICULTIES = [1, 2, 3, 4, 5];

const fmt = (n) =>
  typeof n === 'number'
    ? '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

// ── Tabs ───────────────────────────────────────────────────────────────────

const CALC_TABS = [
  { id: 'areas',    label: 'Στοιχεία' },
  { id: 'studies',  label: 'Μελέτες' },
  { id: 'results',  label: 'Αποτελέσματα' },
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function FeeCalculator({ projectId }) {
  const qc = useQueryClient();
  const [calcTab, setCalcTab] = useState('areas');
  const [showAllAreas, setShowAllAreas] = useState(false);

  // Form state
  const [areas, setAreas] = useState({ A1: '' });
  const [difficulty, setDifficulty] = useState({});
  const [selectedStudies, setSelectedStudies] = useState({
    EP1: true, EP2: true, EP3: true, EP16: true, EP17: true,
  });
  const [fpa, setFpa] = useState(24);
  const [isDemolition, setIsDemolition] = useState(false);
  const [result, setResult] = useState(null);

  // Lambda
  const { data: lambda } = useQuery({
    queryKey: ['fee-lambda-current'],
    queryFn: feesApi.lambdaCurrent,
  });

  // Previous calculations for this project
  const { data: prevCalcs = [] } = useQuery({
    queryKey: ['fee-calculations', projectId],
    queryFn: () => feesApi.listCalculations(projectId),
    enabled: calcTab === 'results',
  });

  // Calculate mutation
  const calcMutation = useMutation({
    mutationFn: () => {
      const areasClean = Object.fromEntries(
        Object.entries(areas).filter(([, v]) => v && parseFloat(v) > 0).map(([k, v]) => [k, parseFloat(v)])
      );
      const diffClean = Object.fromEntries(
        Object.entries(difficulty).map(([k, v]) => [k, parseInt(v)])
      );
      return feesApi.calculate({
        areas: areasClean,
        difficulty: diffClean,
        studies: selectedStudies,
        lambdaValue: lambda?.lambda ? parseFloat(lambda.lambda) : 0.23368,
        fpa,
        isDemolition,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setCalcTab('results');
    },
    onError: (e) => toast.error(e.message || 'Σφάλμα υπολογισμού'),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: ({ makeOfficial }) => {
      const areasClean = Object.fromEntries(
        Object.entries(areas).filter(([, v]) => v && parseFloat(v) > 0).map(([k, v]) => [k, parseFloat(v)])
      );
      return feesApi.saveCalculation(projectId, {
        areas: areasClean,
        difficulty: Object.fromEntries(Object.entries(difficulty).map(([k, v]) => [k, parseInt(v)])),
        studies: selectedStudies,
        lambdaValue: lambda?.lambda ? parseFloat(lambda.lambda) : 0.23368,
        fpa,
        isDemolition,
        makeOfficial,
      });
    },
    onSuccess: (_, { makeOfficial }) => {
      qc.invalidateQueries(['fee-calculations', projectId]);
      toast.success(makeOfficial ? 'Ορίστηκε ως επίσημη αμοιβή!' : 'Αμοιβή αποθηκεύτηκε!');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const setArea = (id, val) => setAreas(prev => ({ ...prev, [id]: val }));
  const setDiff = (id, val) => setDifficulty(prev => ({ ...prev, [id]: val }));
  const toggleStudy = (id) => setSelectedStudies(prev => ({ ...prev, [id]: !prev[id] }));
  const selectAll = (list) => setSelectedStudies(prev => ({
    ...prev, ...Object.fromEntries(list.map(e => [e.id, true]))
  }));
  const clearAll = (list) => setSelectedStudies(prev => ({
    ...prev, ...Object.fromEntries(list.map(e => [e.id, false]))
  }));

  const visibleAreas = showAllAreas ? AREAS : AREAS.filter(a => areas[a.id]);
  const hasResult = !!result;

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex border-b border-border mb-5">
        {CALC_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setCalcTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              calcTab === t.id
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}>
            {t.label}
            {t.id === 'results' && hasResult && (
              <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Στοιχεία ──────────────────────────────── */}
      {calcTab === 'areas' && (
        <div className="space-y-5">
          {/* Lambda info */}
          <div className="card bg-surface-2 text-sm text-text-muted">
            <span className="font-mono text-text-primary">λ = {lambda?.lambda ?? '0.23368'}</span>
            {' '}— {lambda?.description ?? '2012 Α΄ Τρίμηνο'} (παγωμένο per ΦΕΚ Β΄ 2422/2013)
          </div>

          {/* Areas table */}
          <div className="card">
            <h3 className="font-semibold mb-4">Επιφάνειες κτιρίου</h3>
            <div className="space-y-2">
              {visibleAreas.map(area => (
                <div key={area.id} className="grid grid-cols-[1fr_120px_100px] gap-3 items-center">
                  <label className="text-sm">{area.id} — {area.label}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0"
                      value={areas[area.id] ?? ''}
                      onChange={e => setArea(area.id, e.target.value)}
                      className="input w-full pr-8 text-right"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">m²</span>
                  </div>
                  <select
                    value={difficulty['S' + area.id.slice(1)] ?? 2}
                    onChange={e => setDiff('S' + area.id.slice(1), e.target.value)}
                    className="input">
                    {DIFFICULTIES.map(d => (
                      <option key={d} value={d}>Κατ. {d}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAllAreas(!showAllAreas)}
              className="mt-3 text-xs text-accent-blue hover:underline">
              {showAllAreas
                ? '▲ Απόκρυψη κενών επιφανειών'
                : `▼ Εμφάνιση όλων (${AREAS.length - visibleAreas.length} ακόμα)`}
            </button>
          </div>

          {/* Options */}
          <div className="card">
            <h3 className="font-semibold mb-4">Παράμετροι</h3>
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="text-sm text-text-muted block mb-1.5">ΦΠΑ</label>
                <div className="flex gap-2">
                  {[0, 24].map(rate => (
                    <button
                      key={rate}
                      onClick={() => setFpa(rate)}
                      className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                        fpa === rate
                          ? 'bg-accent-blue text-white border-accent-blue'
                          : 'border-border text-text-muted hover:border-accent-blue'
                      }`}>
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDemolition}
                  onChange={e => setIsDemolition(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Κατεδάφιση
              </label>
            </div>
          </div>

          <button
            className="btn-primary w-full"
            onClick={() => setCalcTab('studies')}>
            Επόμενο: Μελέτες →
          </button>
        </div>
      )}

      {/* ── Tab 2: Μελέτες ───────────────────────────────── */}
      {calcTab === 'studies' && (
        <div className="space-y-5">
          {/* Studies */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Σύνταξη Μελετών</h3>
              <div className="flex gap-2">
                <button onClick={() => selectAll(STUDIES)} className="text-xs text-accent-blue hover:underline">Επιλογή όλων</button>
                <span className="text-text-muted">·</span>
                <button onClick={() => clearAll(STUDIES)} className="text-xs text-text-muted hover:underline">Καθαρισμός</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {STUDIES.map(ep => (
                <label key={ep.id} className="flex items-center gap-2.5 p-2 rounded hover:bg-surface-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={!!selectedStudies[ep.id]}
                    onChange={() => toggleStudy(ep.id)}
                    className="w-4 h-4 rounded flex-shrink-0"
                  />
                  <span className="flex-1">{ep.label}</span>
                  <span className="text-xs text-text-muted font-mono">{ep.ks}‰</span>
                </label>
              ))}
            </div>
          </div>

          {/* Supervision */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Επιβλέψεις</h3>
              <div className="flex gap-2">
                <button onClick={() => selectAll(SUPERVISION)} className="text-xs text-accent-blue hover:underline">Επιλογή όλων</button>
                <span className="text-text-muted">·</span>
                <button onClick={() => clearAll(SUPERVISION)} className="text-xs text-text-muted hover:underline">Καθαρισμός</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SUPERVISION.map(ep => (
                <label key={ep.id} className="flex items-center gap-2.5 p-2 rounded hover:bg-surface-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={!!selectedStudies[ep.id]}
                    onChange={() => toggleStudy(ep.id)}
                    className="w-4 h-4 rounded flex-shrink-0"
                  />
                  <span className="flex-1">{ep.label}</span>
                  <span className="text-xs text-text-muted font-mono">{ep.ks}‰</span>
                </label>
              ))}
            </div>
          </div>

          <button
            className="btn-primary w-full"
            disabled={calcMutation.isPending}
            onClick={() => calcMutation.mutate()}>
            {calcMutation.isPending ? 'Υπολογισμός…' : '🧮 Υπολογισμός Αμοιβής'}
          </button>
        </div>
      )}

      {/* ── Tab 3: Αποτελέσματα ──────────────────────────── */}
      {calcTab === 'results' && (
        <div className="space-y-5">
          {!result ? (
            <div className="card text-center text-text-muted py-12">
              <div className="text-4xl mb-3">🧮</div>
              <p>Δεν έχει γίνει υπολογισμός ακόμα.</p>
              <button
                className="btn-secondary mt-4"
                onClick={() => setCalcTab('areas')}>
                Συμπλήρωση στοιχείων
              </button>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Τυπική Αμοιβή (ΤΑ)', value: result.P, sub: 'λ × Σ(Ai × ΣΒνi × Si)' },
                  { label: 'Αμοιβή Μελετών', value: result.SA },
                  { label: 'Αμοιβή Επίβλεψης', value: result.SE },
                  { label: 'Σύνολο (χωρίς ΦΠΑ)', value: result.SUM },
                  { label: `ΦΠΑ ${fpa}%`, value: result.PA1 },
                ].map(card => (
                  <div key={card.label} className="card bg-surface-2">
                    <div className="text-xs text-text-muted mb-1">{card.label}</div>
                    <div className="text-lg font-semibold">{fmt(card.value)}</div>
                    {card.sub && <div className="text-xs text-text-muted mt-0.5">{card.sub}</div>}
                  </div>
                ))}
                {/* P1 — prominent */}
                <div className="card bg-accent-blue/10 border border-accent-blue/30 col-span-2 sm:col-span-1">
                  <div className="text-xs text-accent-blue font-medium mb-1">Ολική Αμοιβή (με ΦΠΑ)</div>
                  <div className="text-2xl font-bold text-accent-blue">{fmt(result.P1)}</div>
                </div>
              </div>

              {/* Breakdown table */}
              {(Object.keys(result.breakdown?.studies ?? {}).length > 0 ||
                Object.keys(result.breakdown?.supervision ?? {}).length > 0) && (
                <div className="card overflow-hidden">
                  <h3 className="font-semibold mb-3">Ανάλυση ανά μελέτη</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-text-muted font-normal">Μελέτη</th>
                        <th className="text-right py-2 text-text-muted font-normal">KS ‰</th>
                        <th className="text-right py-2 text-text-muted font-normal">Αμοιβή</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...Object.values(result.breakdown?.studies ?? {}),
                        ...Object.values(result.breakdown?.supervision ?? {}),
                      ].filter(r => r.fee > 0).map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2">{row.label}</td>
                          <td className="py-2 text-right text-text-muted font-mono">{row.ksValue}</td>
                          <td className="py-2 text-right font-medium">{fmt(row.fee)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Save buttons */}
              <div className="flex gap-3">
                <button
                  className="btn-secondary flex-1"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ makeOfficial: false })}>
                  💾 Αποθήκευση
                </button>
                <button
                  className="btn-primary flex-1"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ makeOfficial: true })}>
                  ✅ Ορισμός Επίσημης Αμοιβής
                </button>
              </div>
            </>
          )}

          {/* Previous calculations */}
          {prevCalcs.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3 text-sm text-text-muted">Προηγούμενοι υπολογισμοί</h3>
              <div className="space-y-2">
                {prevCalcs.slice(0, 3).map(calc => (
                  <div key={calc.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {calc.is_official && <span className="text-xs bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">Επίσημη</span>}
                      <span className="text-text-muted">{formatDate(calc.created_at)}</span>
                    </div>
                    <span className="font-semibold">{fmt(parseFloat(calc.result_p1))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
