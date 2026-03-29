import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/index.js';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      await api.post('/api/auth/reset-password', {
        token,
        password: form.password,
      });
      setDone(true);
      toast.success('Ο κωδικός ενημερώθηκε επιτυχώς!');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      toast.error(err.message || 'Ο σύνδεσμος έχει λήξει ή δεν είναι έγκυρος.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/favicon.svg" alt="OpenAdeia" className="w-14 h-14 mx-auto mb-4" />
          <div className="text-3xl font-bold tracking-tight mb-1">OpenAdeia</div>
        </div>

        <div className="bg-[#151922] border border-white/10 rounded-2xl p-8">
          <h2 className="text-lg font-semibold mb-2">Νέος Κωδικός</h2>

          {done ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-sm text-green-300">
              ✅ Ο κωδικός σας ενημερώθηκε επιτυχώς. Ανακατεύθυνση στη σύνδεση…
            </div>
          ) : (
            <>
              <p className="text-text-muted text-sm mb-6">
                Εισάγετε τον νέο κωδικό σας.
              </p>

              {!token && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 mb-4">
                  ⚠️ Μη έγκυρος σύνδεσμος επαναφοράς.
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="label">Νέος Κωδικός *</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Τουλάχιστον 8 χαρακτήρες"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="label">Επιβεβαίωση Κωδικού *</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Επαναλάβετε τον κωδικό"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary justify-center"
                  disabled={loading || !token}>
                  {loading ? 'Αποθήκευση…' : 'Αποθήκευση Κωδικού'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-text-muted mt-4">
            <Link to="/login" className="text-indigo-400 hover:underline">
              ← Πίσω στη σύνδεση
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
