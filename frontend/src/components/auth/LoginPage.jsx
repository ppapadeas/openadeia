import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../../api/projects.js';
import useAppStore from '../../store/useAppStore.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAppStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ email: form.email, password: form.password });
      setAuth(res.token, res.user);
      toast.success('Καλωσήρθατε!');
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
          <img src="/favicon.svg" alt="OpenAdeia" className="w-14 h-14 mx-auto mb-4" />
          <div className="text-3xl font-bold tracking-tight mb-1">OpenAdeia</div>
          <div className="text-text-muted text-sm">Διαχείριση Αδειοδοτικών Φακέλων</div>
        </div>

        <div className="bg-[#151922] border border-white/10 rounded-2xl p-8">
          <h2 className="text-lg font-semibold mb-6">Σύνδεση</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="label">Email *</label>
              <input
                id="login-email"
                className="input"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="label">Κωδικός *</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Ξεχάσατε τον κωδικό;
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors text-xs"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary justify-center mt-2"
              disabled={loading}>
              {loading ? '…' : 'Σύνδεση'}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted mt-4">
            Δεν έχετε λογαριασμό;{' '}
            <Link to="/signup" className="text-indigo-400 hover:underline">
              Εγγραφή
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          OpenAdeia — Ανοιχτό λογισμικό για ελληνικές άδειες δόμησης
        </p>
      </div>
    </div>
  );
}
