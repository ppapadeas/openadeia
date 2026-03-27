import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from './store/useAppStore.js';
import Shell from './components/layout/Shell.jsx';
import Dashboard from './components/projects/Dashboard.jsx';
import ProjectDetail from './components/projects/ProjectDetail.jsx';
import ClientList from './components/clients/ClientList.jsx';
import ClientDetail from './components/clients/ClientDetail.jsx';
import NokRulesViewer from './components/nok/RulesViewer.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import ProfilePage from './components/auth/ProfilePage.jsx';
import ClientPortal from './pages/ClientPortal.jsx';

// Redirect to /login if not authenticated
function RequireAuth({ children }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no auth required */}
        <Route path="/portal/:token" element={<ClientPortal />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated shell */}
        <Route path="/" element={
          <RequireAuth><Shell /></RequireAuth>
        }>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<Dashboard />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="clients" element={<ClientList />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="nok" element={<NokRulesViewer />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
