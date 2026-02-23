import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '../../api/projects.js';
import useAppStore from '../../store/useAppStore.js';

export default function ProfilePage() {
  const qc = useQueryClient();
  const updateUser = useAppStore((s) => s.updateUser);
  const storeUser = useAppStore((s) => s.user);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    initialData: storeUser,
  });

  const [profile, setProfile] = useState({ name: me?.name || '', amh: me?.amh || '' });
  const [tee, setTee] = useState({ username: me?.tee_username || '', password: '' });
  const [pwd, setPwd] = useState({ current: '', new_pwd: '', confirm: '' });
  const [showTeePassword, setShowTeePassword] = useState(false);

  const profileMutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      updateUser(updated);
      qc.invalidateQueries(['me']);
      toast.success('Το προφίλ ενημερώθηκε');
    },
    onError: (e) => toast.error(e.message),
  });

  const teeMutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      updateUser(updated);
      qc.invalidateQueries(['me']);
      setTee(t => ({ ...t, password: '' }));
      toast.success('Τα στοιχεία ΤΕΕ αποθηκεύτηκαν');
    },
    onError: (e) => toast.error(e.message),
  });

  const pwdMutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: () => {
      setPwd({ current: '', new_pwd: '', confirm: '' });
      toast.success('Ο κωδικός άλλαξε');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleProfile = (e) => {
    e.preventDefault();
    profileMutation.mutate({
      name: profile.name,
      amh: profile.amh ? Number(profile.amh) : null,
    });
  };

  const handleTee = (e) => {
    e.preventDefault();
    teeMutation.mutate({
      tee_username: tee.username || null,
      tee_password: tee.password || null,
    });
  };

  const handlePassword = (e) => {
    e.preventDefault();
    if (pwd.new_pwd !== pwd.confirm) {
      toast.error('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    pwdMutation.mutate({ current_password: pwd.current, new_password: pwd.new_pwd });
  };

  return (
    <div className="p-7 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Προφίλ & Ρυθμίσεις</h1>
      <p className="text-text-muted text-sm mb-7">Διαχείριση λογαριασμού και στοιχείων ΤΕΕ</p>

      {/* Profile info */}
      <form onSubmit={handleProfile} className="card mb-6">
        <h2 className="font-semibold mb-4">Στοιχεία Μηχανικού</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Email</label>
            <input className="input opacity-60" value={me?.email || ''} disabled />
          </div>
          <div>
            <label className="label">Ονοματεπώνυμο</label>
            <input className="input" value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">ΑΜΗ ΤΕΕ</label>
            <input className="input" type="number" placeholder="Αριθμός Μητρώου Μηχανικού"
              value={profile.amh}
              onChange={e => setProfile(p => ({ ...p, amh: e.target.value }))} min="1" />
          </div>
          <button className="btn-primary self-start" type="submit" disabled={profileMutation.isPending}>
            {profileMutation.isPending ? 'Αποθήκευση…' : 'Αποθήκευση Προφίλ'}
          </button>
        </div>
      </form>

      {/* TEE Portal credentials */}
      <form onSubmit={handleTee} className="card mb-6">
        <h2 className="font-semibold mb-1">Στοιχεία Πρόσβασης ΤΕΕ e-Άδειες</h2>
        <p className="text-xs text-text-muted mb-4">
          Τα στοιχεία αυτά χρησιμοποιούνται για αυτοματοποιημένες υποβολές στο portal του ΤΕΕ.
          Αποθηκεύονται κρυπτογραφημένα στον διακομιστή.
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Username ΤΕΕ</label>
            <input className="input" placeholder="το username σας στο eadeies.gr"
              value={tee.username}
              onChange={e => setTee(t => ({ ...t, username: e.target.value }))} />
          </div>
          <div>
            <label className="label">
              Κωδικός ΤΕΕ
              {me?.tee_username && (
                <span className="ml-2 text-xs text-emerald-400">✓ Αποθηκευμένος</span>
              )}
            </label>
            <div className="relative">
              <input className="input pr-10"
                type={showTeePassword ? 'text' : 'password'}
                placeholder={me?.tee_username ? '••••••• (αφήστε κενό για να μη αλλάξει)' : 'κωδικός ΤΕΕ'}
                value={tee.password}
                onChange={e => setTee(t => ({ ...t, password: e.target.value }))}
              />
              <button type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                onClick={() => setShowTeePassword(v => !v)}>
                {showTeePassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button className="btn-primary self-start" type="submit" disabled={teeMutation.isPending}>
            {teeMutation.isPending ? 'Αποθήκευση…' : 'Αποθήκευση Στοιχείων ΤΕΕ'}
          </button>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={handlePassword} className="card">
        <h2 className="font-semibold mb-4">Αλλαγή Κωδικού</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Τρέχων Κωδικός</label>
            <input className="input" type="password" value={pwd.current}
              onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Νέος Κωδικός</label>
            <input className="input" type="password" placeholder="Τουλάχιστον 8 χαρακτήρες"
              value={pwd.new_pwd}
              onChange={e => setPwd(p => ({ ...p, new_pwd: e.target.value }))}
              required minLength={8} />
          </div>
          <div>
            <label className="label">Επιβεβαίωση Νέου Κωδικού</label>
            <input className="input" type="password"
              value={pwd.confirm}
              onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
              required minLength={8} />
          </div>
          <button className="btn-primary self-start" type="submit" disabled={pwdMutation.isPending}>
            {pwdMutation.isPending ? 'Αλλαγή…' : 'Αλλαγή Κωδικού'}
          </button>
        </div>
      </form>
    </div>
  );
}
