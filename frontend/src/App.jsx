import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Shell from './components/layout/Shell.jsx';
import Dashboard from './components/projects/Dashboard.jsx';
import ProjectDetail from './components/projects/ProjectDetail.jsx';
import ClientList from './components/clients/ClientList.jsx';
import ClientDetail from './components/clients/ClientDetail.jsx';
import NokRulesViewer from './components/nok/RulesViewer.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<Dashboard />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="clients" element={<ClientList />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="nok" element={<NokRulesViewer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
