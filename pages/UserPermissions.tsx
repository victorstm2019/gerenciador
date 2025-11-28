import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  permissions: string[];
}

interface NewUserForm {
  username: string;
  password: string;
  role: 'admin' | 'user';
  permissions: string[];
}

const allPermissions = [
  { key: 'connections', label: 'Conexões', icon: 'settings_remote' },
  { key: 'messages', label: 'Mensagens', icon: 'message' },
  { key: 'queue', label: 'Fila', icon: 'history' },
  { key: 'logs', label: 'Logs', icon: 'bug_report' },
  { key: 'permissions', label: 'Permissões', icon: 'manage_accounts' },
];

const UserPermissions: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    username: '',
    password: '',
    role: 'user',
    permissions: [],
  });

  // Fetch users
  useEffect(() => {
    fetch('http://localhost:3001/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching users:', err);
        setLoading(false);
      });
  }, []);

  const handlePermissionChange = (userId: number, permission: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newPermissions = user.permissions.includes(permission)
      ? user.permissions.filter(p => p !== permission)
      : [...user.permissions, permission];
    // Optimistic UI update
    setUsers(users.map(u => (u.id === userId ? { ...u, permissions: newPermissions } : u)));
    fetch(`http://localhost:3001/api/users/${userId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: newPermissions }),
    }).catch(err => {
      console.error('Error updating permissions:', err);
      // Revert on error
      setUsers(users);
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    await fetch(`http://localhost:3001/api/users/${selectedUser.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    setIsModalOpen(false);
    setNewPassword('');
    setSelectedUser(null);
  };

  const toggleNewPermission = (permKey: string) => {
    setNewUserForm(prev => {
      const exists = prev.permissions.includes(permKey);
      const newPerms = exists ? prev.permissions.filter(p => p !== permKey) : [...prev.permissions, permKey];
      return { ...prev, permissions: newPerms };
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username || !newUserForm.password) {
      alert('Preencha usuário e senha');
      return;
    }
    const resp = await fetch('http://localhost:3001/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserForm),
    });
    if (resp.ok) {
      const refreshed = await fetch('http://localhost:3001/api/users').then(r => r.json());
      setUsers(refreshed || []);
      setIsCreateModalOpen(false);
      setNewUserForm({ username: '', password: '', role: 'user', permissions: [] });
    } else {
      alert('Erro ao criar usuário');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Permissões de Usuários</h1>
      {/* Button to open create user modal */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
      >
        Criar Usuário
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-6 py-3">Usuário</th>
              <th className="px-6 py-3">Função</th>
              <th className="px-6 py-3">Permissões</th>
              <th className="px-6 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map(user => (
              <tr key={user.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{user.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {allPermissions.map(perm => (
                      <label key={perm.key} className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={user.permissions.includes(perm.key)}
                          onChange={() => handlePermissionChange(user.id, perm.key)}
                          disabled={user.role === 'admin'}
                        />
                        <div
                          className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${user.permissions.includes(perm.key) || user.role === 'admin'
                            ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                            }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">{perm.icon}</span>
                          {perm.label}
                        </div>
                      </label>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setIsModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium"
                  >
                    Alterar Senha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Change Password Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Alterar Senha: {selectedUser.username}</h2>
            <form onSubmit={handleChangePassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Senha</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setNewPassword('');
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Criar Novo Usuário</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome de Usuário</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={newUserForm.username}
                  onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={newUserForm.role}
                  onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value as 'admin' | 'user' })}
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Permissões</label>
                <div className="flex flex-wrap gap-2">
                  {allPermissions.map(perm => (
                    <label key={perm.key} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserForm.permissions.includes(perm.key)}
                        onChange={() => toggleNewPermission(perm.key)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="material-symbols-outlined text-sm text-gray-600 dark:text-gray-400">{perm.icon}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setNewUserForm({ username: '', password: '', role: 'user', permissions: [] });
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div >
      )}
    </div >
  );
};

export default UserPermissions;
