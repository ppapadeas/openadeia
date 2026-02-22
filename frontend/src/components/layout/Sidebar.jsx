import { NavLink } from 'react-router-dom';
import useAppStore from '../../store/useAppStore.js';

const NAV = [
  { to: '/projects', icon: '📁', label: 'Φάκελοι' },
  { to: '/clients',  icon: '👤', label: 'Πελάτες' },
  { to: '/nok',      icon: '📋', label: 'ΝΟΚ Κανόνες' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className="fixed top-0 left-0 h-full flex flex-col border-r border-border-subtle bg-bg-surface z-20 overflow-hidden"
      style={{ width: sidebarCollapsed ? 60 : 240, transition: 'width 0.3s ease' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border-subtle flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          OA
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight truncate">OpenAdeia</div>
            <div className="text-[10px] text-text-muted truncate">e-Adeies Manager</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors mx-2 rounded-lg mb-0.5 ${
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`
            }
            title={sidebarCollapsed ? label : undefined}
          >
            <span className="text-base flex-shrink-0">{icon}</span>
            {!sidebarCollapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t border-border-subtle text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
      >
        <span className="text-sm">{sidebarCollapsed ? '›' : '‹'}</span>
      </button>
    </aside>
  );
}
