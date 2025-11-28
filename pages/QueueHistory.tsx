import React, { useState, useEffect } from 'react';

interface QueueItem {
  id: number;
  cliente: string;
  tipo: 'lembrete' | 'atraso';
  status: 'pendente' | 'enviado' | 'erro';
  data_envio: string;
}

interface BlockedClient {
  id: number;
  cliente: string;
  motivo: string;
  data_bloqueio: string;
}

const QueueHistory: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [blocked, setBlocked] = useState<BlockedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Blocked Client Form
  const [newBlockedName, setNewBlockedName] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:3001/api/queue').then(res => res.json()),
      fetch('http://localhost:3001/api/blocked').then(res => res.json())
    ])
      .then(([queueData, blockedData]) => {
        setQueue(queueData || []);
        setBlocked(blockedData || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setLoading(false);
      });
  };

  const handleBlockClient = (e: React.FormEvent) => {
    e.preventDefault();
    fetch('http://localhost:3001/api/blocked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: newBlockedName,
        motivo: newBlockedReason
      })
    })
      .then(() => {
        setNewBlockedName('');
        setNewBlockedReason('');
        fetchData();
      })
      .catch(err => alert('Erro ao bloquear: ' + err));
  };

  const handleUnblock = (id: number) => {
    if (confirm('Desbloquear este cliente?')) {
      fetch(`http://localhost:3001/api/blocked/${id}`, {
        method: 'DELETE'
      })
        .then(() => fetchData())
        .catch(err => alert('Erro ao desbloquear: ' + err));
    }
  };

  const filteredQueue = queue.filter(item => {
    const matchesStatus = filterStatus === 'todos' ? true : item.status === filterStatus;

    let matchesDate = true;
    if (startDate || endDate) {
      const itemDate = new Date(item.data_envio);
      if (startDate) {
        matchesDate = matchesDate && itemDate >= new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && itemDate <= end;
      }
    }

    return matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Fila & Histórico</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Fila de Envios</h2>

              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    title="Data Inicial"
                  />
                  <input
                    type="date"
                    className="px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    title="Data Final"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterStatus('todos')}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${filterStatus === 'todos' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterStatus('pendente')}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${filterStatus === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                  >
                    Pendentes
                  </button>
                  <button
                    onClick={() => setFilterStatus('erro')}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${filterStatus === 'erro' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                  >
                    Erros
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredQueue.map((item) => (
                    <tr key={item.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.cliente}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${item.tipo === 'lembrete' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                          {item.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${item.status === 'enviado' ? 'bg-green-100 text-green-800' :
                          item.status === 'erro' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(item.data_envio).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredQueue.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhum item encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Blocked List */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Bloquear Cliente</h2>
            <form onSubmit={handleBlockClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={newBlockedName}
                  onChange={(e) => setNewBlockedName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={newBlockedReason}
                  onChange={(e) => setNewBlockedReason(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
              >
                Bloquear
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Clientes Bloqueados</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {blocked.map((item) => (
                <div key={item.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.cliente}</p>
                    <p className="text-xs text-gray-500">{item.motivo}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(item.data_bloqueio).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleUnblock(item.id)}
                    className="text-gray-400 hover:text-green-600"
                    title="Desbloquear"
                  >
                    <span className="material-symbols-outlined">lock_open</span>
                  </button>
                </div>
              ))}
              {blocked.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum cliente bloqueado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueHistory;
