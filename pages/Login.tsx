import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface User {
  id: number;
  username: string;
  role: string;
}

interface LoginResponse {
  id: number;
  username: string;
  role: string;
  permissions: string[];
  first_login: number;
}

const Login: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loggedUser, setLoggedUser] = useState<LoginResponse | null>(null);
  const navigate = useNavigate();

  // Fetch users on mount
  useEffect(() => {
    api.get<User[]>('/api/users/list')
      .then(data => {
        setUsers(data || []);
      })
      .catch(err => {
        console.error('Error fetching users:', err);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    try {
      const userData = await api.post<LoginResponse>('/api/auth/login', { username, password });

      // Check if first login
      if (userData.first_login === 1) {
        setLoggedUser(userData);
        setShowPasswordModal(true);
      } else {
        // Save user data and navigate
        localStorage.setItem('user', JSON.stringify(userData));
        navigate('/connections');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      alert(err.message || 'Erro ao fazer login');
    }
  };

  const handleResetPassword = async () => {
    if (!username) {
      alert('Por favor, selecione um usuário primeiro');
      return;
    }

    if (!confirm(`Resetar senha do usuário "${username}" para a senha padrão?`)) {
      return;
    }

    try {
      // Usar fetch direto para evitar interceptação do api.ts (erro 401 -> "Sessão expirada")
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao resetar senha');
      }

      alert(data.message || 'Usuário padrão resetado com sucesso');
      setPassword('');
    } catch (err: any) {
      console.error('Reset error:', err);
      alert(err.message || 'Erro ao resetar senha');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('As senhas não coincidem');
      return;
    }

    if (!loggedUser) return;

    try {
      await api.put(`/api/users/${loggedUser.id}/change-password`, { password: newPassword });

      // Update user data and navigate
      const updatedUser = { ...loggedUser, first_login: 0 };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      navigate('/connections');
    } catch (err: any) {
      console.error('Change password error:', err);
      alert(err.message || 'Erro ao alterar senha');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Gestão de Cobranças</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sistema de Gestão de Cobranças</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            >
              <option value="">Selecione um usuário</option>
              {users.map(user => (
                <option key={user.id} value={user.username}>
                  {user.username} ({user.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors font-medium"
            >
              Entrar
            </button>
            {users.find(u => u.username === username)?.role === 'admin' && (
              <button
                type="button"
                onClick={handleResetPassword}
                className="flex-1 bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 transition-colors font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && loggedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Primeiro Acesso - Alterar Senha</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Por segurança, você precisa alterar sua senha no primeiro acesso.
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Senha</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Senha</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Alterar Senha
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
