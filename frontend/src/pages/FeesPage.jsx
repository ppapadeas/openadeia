/**
 * FeesPage — standalone Αμοιβολόγιο page at /fees
 *
 * Wraps the FeeCalculator component in a page shell with a header.
 * Standalone mode (no projectId) — saves calculations without project link.
 */

import FeeCalculator from '../components/fees/FeeCalculator.jsx';

export default function FeesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">🧮 Αμοιβολόγιο</h1>
        <p className="text-sm text-text-muted mt-1">
          Υπολογισμός αμοιβής μηχανικού βάσει ΠΔ 696/74 — λ παγωμένο per ΦΕΚ Β΄ 2422/2013
        </p>
      </div>
      <FeeCalculator />
    </div>
  );
}
