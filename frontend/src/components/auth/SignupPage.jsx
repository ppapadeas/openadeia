import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/index.js';
import useAppStore from '../../store/useAppStore.js';

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAppStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    orgName: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/signup-org', {
        orgName: form.orgName,
        name: form.name,
        email: form.email,
        password: form.password,
      });

      setAuth(res.token, res.user);
      toast.success(`Καλωσήρθατε στο OpenAdeia, ${res.user.name.split(' ')[0]}! 🎉`);
      navigate('/projects', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία δημιουργίας λογαριασμού');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <img src="/favicon.svg" alt="OpenAdeia" className="w-14 h-14 mx-auto mb-4" />
          <div className="text-3xl font-bold tracking-tight mb-1">OpenAdeia</div>
          <div className="text-text-muted text-sm">Δημιουργία λογαριασμού για τη μελέτη σας</div>
        </div>

        <div className="bg-[#151922] border border-white/10 rounded-2xl p-8">
          <h2 className="text-lg font-semibold mb-6">Νέος Λογαριασμός</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Org Name */}
            <div>
              <label htmlFor="signup-org" className="label">Επωνυμία Μελέτης / Εταιρεία *</label>
              <input
                id="signup-org"
                className="input"
                placeholder="π.χ. Μελετητικό Γραφείο Παπαδόπουλος"
                value={form.orgName}
                onChange={(e) => set('orgName', e.target.value)}
                autoComplete="organization"
                required
                minLength={2}
              />
              <p className="text-text-muted text-xs mt-1">
                Αυτό θα χρησιμοποιηθεί ως όνομα του χώρου εργασίας σας.
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" className="label">Ονοματεπώνυμο *</label>
              <input
                id="signup-name"
                className="input"
                placeholder="π.χ. Γιώργης Παπαδόπουλος"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                autoComplete="name"
                required
                minLength={2}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="label">Email *</label>
              <input
                id="signup-email"
                className="input"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="label">Κωδικός *</label>
              <div className="relative">
                <input
                  id="signup-password"
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Τουλάχιστον 8 χαρακτήρες"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
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

            {/* Confirm Password */}
            <div>
              <label htmlFor="signup-confirm" className="label">Επιβεβαίωση Κωδικού *</label>
              <div className="relative">
                <input
                  id="signup-confirm"
                  className="input pr-10"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Επαναλάβετε τον κωδικό"
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors text-xs"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Trial info */}
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-sm text-indigo-300">
              🎁 <strong>14 ημέρες δωρεάν δοκιμή</strong> — Δεν απαιτείται κάρτα πληρωμής.
            </div>

            <button
              type="submit"
              className="btn-primary justify-center mt-2"
              disabled={loading}>
              {loading ? 'Δημιουργία λογαριασμού…' : 'Δημιουργία Λογαριασμού'}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted mt-4">
            Έχετε ήδη λογαριασμό;{' '}
            <Link to="/login" className="text-indigo-400 hover:underline">
              Σύνδεση
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
