import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import MessageConfig from './pages/MessageConfig';
import ErrorLogs from './pages/ErrorLogs';
import ConnectionSettings from './pages/ConnectionSettings';
import QueueHistory from './pages/QueueHistory';
import UserPermissions from './pages/UserPermissions';

const SidebarItem = ({ icon, label, path, isActive, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}
  >
    <span className="material-symbols-outlined">{icon}</span>
    <span>{label}</span>
  </button>
);

const Layout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: 'settings_remote', label: 'Conexões & Testes', path: '/connections' },
    { icon: 'message', label: 'Mensagens', path: '/messages' },
    { icon: 'history', label: 'Fila & Histórico', path: '/queue' },
    { icon: 'bug_report', label: 'Logs de Erro', path: '/logs' },
    { icon: 'manage_accounts', label: 'Permissões', path: '/permissions' },
  ];

  return (
    <div className="flex min-h-screen w-full bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-gray-900 text-white">
        <div className="flex h-16 items-center px-6 border-b border-gray-800">
          <span className="text-lg font-bold">Gestão de Cobranças</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              isActive={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => navigate('/login')}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <span className="text-lg font-bold text-gray-800 dark:text-white">Gestão de Cobranças</span>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 dark:text-gray-300"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="lg:hidden bg-gray-900 text-white absolute top-14 left-0 w-full z-50 pb-4 shadow-xl">
            {menuItems.map((item) => (
              <SidebarItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                path={item.path}
                isActive={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
              />
            ))}
            <button
              onClick={() => navigate('/login')}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:text-red-300"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>Sair</span>
            </button>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/connections" element={<Layout><ConnectionSettings /></Layout>} />
        <Route path="/messages" element={<Layout><MessageConfig /></Layout>} />
        <Route path="/logs" element={<Layout><ErrorLogs /></Layout>} />
        <Route path="/queue" element={<Layout><QueueHistory /></Layout>} />
        <Route path="/permissions" element={<Layout><UserPermissions /></Layout>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;