/**
 * TeeSyncPage — standalone ΤΕΕ e-Adeies sync page at /tee
 */
import { useNavigate } from 'react-router-dom';
import TeeSyncPanel from '../components/tee/TeeSyncPanel.jsx';

export default function TeeSyncPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">🏛️ ΤΕΕ e-Άδειες</h1>
        <p className="text-sm text-text-muted mt-1">
          Συγχρονισμός αδειών από την πύλη e-Άδειες του ΤΕΕ
        </p>
      </div>
      <TeeSyncPanel onClose={() => navigate('/projects')} />
    </div>
  );
}
