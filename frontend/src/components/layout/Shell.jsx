import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import useAppStore from '../../store/useAppStore.js';

export default function Shell() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex min-h-screen bg-bg-base text-text-primary">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0" style={{ marginLeft: collapsed ? 60 : 240, transition: 'margin-left 0.3s ease' }}>
        <Header />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
