import { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '../../store/useThemeStore.js';

const THEMES = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark',  label: 'Dark',  icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[2];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Theme: ${current.label}`}
        className="w-8 h-8 rounded-full flex items-center justify-center text-base hover:bg-white/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Toggle theme"
      >
        {current.icon}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-bg-surface border border-border-default rounded-xl shadow-lg z-50 overflow-hidden">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTheme(t.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                theme === t.value ? 'text-accent-blue font-medium' : 'text-text-secondary'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
