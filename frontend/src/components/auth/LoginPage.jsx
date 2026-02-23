import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../../api/projects.js';
import useAppStore from '../../store/useAppStore.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAppStore((s) => s.setAuth);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', amh: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = mode === 'register'
        ? { email: form.email, name: form.name, password: form.password, amh: form.amh ? Number(form.amh) : undefined }
        : { email: form.email, password: form.password };

      const res = mode === 'register'
        ? await authApi.register(payload)
        : await authApi.login(payload);

      setAuth(res.token, res.user);
      toast.success(mode === 'register' ? 'Λογαριασμός δημιουργήθηκε!' : 'Καλωσήρθατε!');
      navigate('/projects', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-4xl font-bold tracking-tight mb-1">OpenAdeia</div>
          <div className="text-text-muted text-sm">Διαχείριση Αδειοδοτικών Φακέλων</div>
        </div>

        <div className="bg-[#151922] border border-white/10 rounded-2xl p-8">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-6">
            {[['login', 'Σύνδεση'], ['register', 'Εγγραφή']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === m ? 'bg-white/15 text-text-primary' : 'text-text-muted hover:text-text-primary'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div>
                <label className="label">Ονοματεπώνυμο *</label>
                <input
                  className="input"
                  placeholder="π.χ. Γιώργης Παπαδόπουλος"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="label">Email *</label>
              <input
                className="input"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Κωδικός *</label>
              <input
                className="input"
                type="password"
                placeholder={mode === 'register' ? 'Τουλάχιστον 8 χαρακτήρες' : '••••••••'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required
                minLength={mode === 'register' ? 8 : 1}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="label">ΑΜΗ ΤΕΕ (προαιρετικό)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="Αριθμός Μητρώου Μηχανικού"
                  value={form.amh}
                  onChange={e => set('amh', e.target.value)}
                  min="1"
                />
              </div>
            )}

            <button
              type="submit"
              className="btn-primary justify-center mt-2"
              disabled={loading}>
              {loading ? '…' : mode === 'register' ? 'Δημιουργία Λογαριασμού' : 'Σύνδεση'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          OpenAdeia — Ανοιχτό λογισμικό για ελληνικές άδειες δόμησης
        </p>
      </div>
    </div>
  );
}
