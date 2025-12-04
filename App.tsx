import React, { useState, useEffect } from 'react';
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

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const menuItems = [
    { icon: 'settings_remote', label: 'Conexões & Testes', path: '/connections', perm: 'connections' },
    { icon: 'message', label: 'Mensagens', path: '/messages', perm: 'messages' },
    { icon: 'history', label: 'Fila & Histórico', path: '/queue', perm: 'queue' },
    { icon: 'bug_report', label: 'Logs', path: '/logs', perm: 'logs' },
    { icon: 'manage_accounts', label: 'Permissões', path: '/permissions', perm: 'permissions' },
  ];

  const filteredItems = menuItems.filter(item =>
    user?.role === 'admin' || user?.permissions?.includes(item.perm)
  );

  return (
    <div className="flex min-h-screen w-full bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-48 flex-col bg-gray-900 text-white">
        <div className="flex h-16 items-center px-6 border-b border-gray-800">
          <span className="text-xl font-bold">Gestão de Cobranças</span>
        </div>
        {user && (
          <div className="px-6 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="material-symbols-outlined text-lg">account_circle</span>
              <span>{user.username}</span>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-4">
          {filteredItems.map((item) => (
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
          <span className="text-xl font-bold text-gray-800 dark:text-white">Gestão de Cobranças</span>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 dark:text-gray-300"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="lg:hidden bg-gray-900 text-white absolute top-14 left-0 w-full z-50 pb-4 shadow-xl">
            {filteredItems.map((item) => (
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

const ProtectedRoute = ({ children, requiredPermission }: { children: React.ReactNode; requiredPermission?: string }) => {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userStr);

  if (requiredPermission && user.role !== 'admin' && !user.permissions.includes(requiredPermission)) {
    // Redirect to first available page or login if none
    if (user.permissions.length > 0) {
      // Map permission to path
      const permToPath: Record<string, string> = {
        'connections': '/connections',
        'messages': '/messages',
        'queue': '/queue',
        'logs': '/logs',
        'permissions': '/permissions'
      };
      const firstPerm = user.permissions[0];
      return <Navigate to={permToPath[firstPerm] || '/login'} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/connections" element={<ProtectedRoute requiredPermission="connections"><Layout><ConnectionSettings /></Layout></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute requiredPermission="messages"><Layout><MessageConfig /></Layout></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute requiredPermission="logs"><Layout><ErrorLogs /></Layout></ProtectedRoute>} />
        <Route path="/queue" element={<ProtectedRoute requiredPermission="queue"><Layout><QueueHistory /></Layout></ProtectedRoute>} />
        <Route path="/permissions" element={<ProtectedRoute requiredPermission="permissions"><Layout><UserPermissions /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;