import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../../api/projects.js';
import useAppStore from '../../store/useAppStore.js';

export default function Header() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  const handleSearch = async (val) => {
    setQ(val);
    if (val.length < 2) { setResults(null); return; }
    try {
      const data = await searchApi.search(val);
      setResults(data);
    } catch {
      setResults(null);
    }
  };

  return (
    <header className="h-14 flex items-center justify-between px-7 border-b border-border-subtle bg-bg-surface/80 backdrop-blur sticky top-0 z-10">
      {/* Search */}
      <div className="relative w-72">
        <input
          className="input pl-8 text-sm"
          placeholder="Αναζήτηση φακέλου, πελάτη…"
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setResults(null), 200)}
        />
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
        {results && (results.projects.length > 0 || results.clients.length > 0) && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-bg-surface border border-border-default rounded-xl shadow-lg z-50 overflow-hidden">
            {results.projects.map((p) => (
              <button key={p.id} className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-sm border-b border-border-subtle last:border-0"
                onClick={() => { navigate(`/projects/${p.id}`); setResults(null); setQ(''); }}>
                <span className="font-medium">{p.title}</span>
                <span className="text-text-muted ml-2 text-xs">{p.code}</span>
              </button>
            ))}
            {results.clients.map((c) => (
              <button key={c.id} className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-sm"
                onClick={() => { navigate(`/clients/${c.id}`); setResults(null); setQ(''); }}>
                <span className="font-medium">{c.surname} {c.name}</span>
                <span className="text-text-muted ml-2 text-xs">{c.afm}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User */}
      <div className="flex items-center gap-3">
        {user?.amh && (
          <span className="text-xs text-text-muted font-mono">ΑΜΗ {user.amh}</span>
        )}
        <button
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold text-sm hover:bg-accent-blue/30 transition-colors"
          title={user?.name || 'Προφίλ'}
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
