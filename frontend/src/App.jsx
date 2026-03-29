import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from './store/useAppStore.js';
import { useThemeStore } from './store/useThemeStore.js';
import Shell from './components/layout/Shell.jsx';
import PageLoader from './components/common/PageLoader.jsx';

// Eagerly loaded — small auth entry points
import LoginPage from './components/auth/LoginPage.jsx';
import SignupPage from './components/auth/SignupPage.jsx';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './components/auth/ResetPasswordPage.jsx';

// Lazy loaded — heavy page components
const Dashboard = lazy(() => import('./components/projects/Dashboard.jsx'));
const ProjectDetail = lazy(() => import('./components/projects/ProjectDetail.jsx'));
const ClientList = lazy(() => import('./components/clients/ClientList.jsx'));
const ClientDetail = lazy(() => import('./components/clients/ClientDetail.jsx'));
const NokRulesViewer = lazy(() => import('./components/nok/RulesViewer.jsx'));
const ProfilePage = lazy(() => import('./components/auth/ProfilePage.jsx'));
const ClientPortal = lazy(() => import('./pages/ClientPortal.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));

// Redirect to /login if not authenticated
function RequireAuth({ children }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// Redirect to / if not superadmin
function RequireSuperadmin({ children }) {
  const user = useAppStore((s) => s.user);
  if (!user?.is_superadmin) return <Navigate to="/" replace />;
  return children;
}

function ThemeProvider() {
  const { theme, getEffectiveTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      const effective = getEffectiveTheme();
      if (effective === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system preference changes (only relevant when theme === 'system')
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, getEffectiveTheme]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes — no auth required */}
          <Route path="/portal/:token" element={<ClientPortal />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

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
            <Route path="admin" element={
              <RequireSuperadmin><AdminDashboard /></RequireSuperadmin>
            } />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
