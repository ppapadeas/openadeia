import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/index.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(err.message || 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.');
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
          <h2 className="text-lg font-semibold mb-2">Ξεχάσατε τον κωδικό;</h2>
          <p className="text-text-muted text-sm mb-6">
            Εισάγετε το email σας και θα σας στείλουμε οδηγίες επαναφοράς.
          </p>

          {sent ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-sm text-green-300">
              ✅ Αν το email υπάρχει στο σύστημα, θα λάβετε οδηγίες επαναφοράς σύντομα.
              <p className="mt-2 text-text-muted">Ελέγξτε και τον φάκελο spam.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="label">Email *</label>
                <input
                  className="input"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn-primary justify-center"
                disabled={loading}>
                {loading ? 'Αποστολή…' : 'Αποστολή Οδηγιών'}
              </button>
            </form>
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
