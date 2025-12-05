import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface ErrorLog {
  id: number;
  data_hora: string;
  tipo: string;
  mensagem: string;
  detalhes: string;
}

interface DuplicateLog {
  id: number;
  item_id: string;
  client_code: string;
  client_name: string;
  due_date: string;
  installment_value: string;
  message_type: string;
  existing_queue_id: number;
  created_at: string;
}

const ErrorLogs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'system' | 'duplicates'>('system');

  // System Logs State
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);

  // Duplicate Logs State
  const [duplicateLogs, setDuplicateLogs] = useState<DuplicateLog[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<number[]>([]);

  useEffect(() => {
    fetchLogs();
    fetchDuplicateLogs();
  }, []);

  const fetchLogs = () => {
    setLoading(true);
    api.get<ErrorLog[]>('/api/logs')
      .then(data => {
        setLogs(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching logs:", err);
        setLoading(false);
      });
  };

  const fetchDuplicateLogs = () => {
    setLoadingDuplicates(true);
    api.get<DuplicateLog[]>('/api/logs/duplicates')
      .then(data => {
        setDuplicateLogs(data || []);
        setLoadingDuplicates(false);
      })
      .catch(err => {
        console.error("Error fetching duplicate logs:", err);
        setLoadingDuplicates(false);
      });
  };

  const deleteDuplicateLogs = (ids: number[], all: boolean = false) => {
    if (!confirm('Tem certeza que deseja excluir os logs selecionados?')) return;

    api.delete('/api/logs/duplicates', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, all })
    })
      .then(() => {
        fetchDuplicateLogs();
        setSelectedDuplicates([]);
        alert('Logs excluídos com sucesso!');
      })
      .catch(err => alert('Erro ao excluir logs: ' + err.message));
  };

  const toggleSelectDuplicate = (id: number) => {
    setSelectedDuplicates(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDuplicates = () => {
    if (selectedDuplicates.length === filteredDuplicateLogs.length) {
      setSelectedDuplicates([]);
    } else {
      setSelectedDuplicates(filteredDuplicateLogs.map(l => l.id));
    }
  };

  const toggleSelectLog = (id: number) => {
    setSelectedLogs(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllLogs = () => {
    if (selectedLogs.length === filteredLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(filteredLogs.map(l => l.id));
    }
  };

  const deleteSystemLogs = (ids: number[], all: boolean = false) => {
    if (!confirm('Tem certeza que deseja excluir os logs selecionados?')) return;

    api.delete('/api/logs', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, all })
    })
      .then(() => {
        fetchLogs();
        setSelectedLogs([]);
        alert('Logs excluídos com sucesso!');
      })
      .catch(err => alert('Erro ao excluir logs: ' + err.message));
  };

  const filteredLogs = logs.filter(log => {
    const matchesType = filterType ? log.tipo === filterType : true;
    const matchesSearch = searchTerm
      ? log.mensagem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.detalhes.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    let matchesDate = true;
    if (startDate || endDate) {
      // Parse data_hora que vem do banco
      const logDate = new Date(log.data_hora);

      // Extrair apenas a parte da data (YYYY-MM-DD) como string
      const logDateStr = logDate.toISOString().split('T')[0];

      if (startDate) {
        matchesDate = matchesDate && logDateStr >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && logDateStr <= endDate;
      }
    }

    return matchesType && matchesSearch && matchesDate;
  });

  const filteredDuplicateLogs = duplicateLogs.filter(log => {
    const matchesSearch = searchTerm
      ? log.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.client_code.includes(searchTerm) ||
      log.item_id.includes(searchTerm)
      : true;

    let matchesDate = true;
    if (startDate || endDate) {
      // Parse created_at que vem do banco (formato ISO: 2024-12-04T19:30:00.000Z)
      const logDate = new Date(log.created_at);

      // Extrair apenas a parte da data (YYYY-MM-DD) como string
      const logDateStr = logDate.toISOString().split('T')[0];

      if (startDate) {
        matchesDate = matchesDate && logDateStr >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && logDateStr <= endDate;
      }
    }

    return matchesSearch && matchesDate;
  });

  if (loading && activeTab === 'system') {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Logs do Sistema</h1>
        <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'system'
              ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Erros e Eventos
          </button>
          <button
            onClick={() => setActiveTab('duplicates')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'duplicates'
              ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Duplicatas
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="w-full lg:w-64">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder={activeTab === 'system' ? "Buscar na mensagem..." : "Buscar cliente ou ID..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">De</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Até</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {activeTab === 'system' && (
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="ERRO">Erro</option>
                <option value="SCHEDULER">Agendamento</option>
                <option value="INFO">Informativo</option>
              </select>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="flex items-end gap-2 ml-auto">
              <button
                onClick={() => deleteSystemLogs(selectedLogs)}
                disabled={selectedLogs.length === 0}
                className="h-10 px-4 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Excluir Selecionados ({selectedLogs.length})
              </button>
              <button
                onClick={() => deleteSystemLogs([], true)}
                className="h-10 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                Limpar Todos
              </button>
              <button
                onClick={fetchLogs}
                className="h-10 px-3 text-gray-500 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Atualizar"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          )}

          {activeTab === 'duplicates' && (
            <div className="flex items-end gap-2 ml-auto">
              <button
                onClick={() => deleteDuplicateLogs(selectedDuplicates)}
                disabled={selectedDuplicates.length === 0}
                className="h-10 px-4 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Excluir Selecionados ({selectedDuplicates.length})
              </button>
              <button
                onClick={() => deleteDuplicateLogs([], true)}
                className="h-10 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              >
                Limpar Todos
              </button>
              <button
                onClick={fetchDuplicateLogs}
                className="h-10 px-3 text-gray-500 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Atualizar"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'system' ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                <tr>
                  <th className="p-4 w-4">
                    <input
                      type="checkbox"
                      checked={selectedLogs.length > 0 && selectedLogs.length === filteredLogs.length}
                      onChange={toggleSelectAllLogs}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 w-44">Data/Hora</th>
                  <th className="px-4 py-3 w-32">Tipo</th>
                  <th className="px-4 py-3">Mensagem</th>
                  <th className="px-4 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-4 w-4">
                      <input
                        type="checkbox"
                        checked={selectedLogs.includes(log.id)}
                        onChange={() => toggleSelectLog(log.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {new Date(log.data_hora).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${log.tipo === 'ERRO' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        log.tipo === 'SCHEDULER' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          log.tipo === 'INFO' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                        {log.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {log.mensagem}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate" title={log.detalhes}>
                      {log.detalhes}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nenhum log encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                <tr>
                  <th className="p-4 w-4">
                    <input
                      type="checkbox"
                      checked={selectedDuplicates.length > 0 && selectedDuplicates.length === filteredDuplicateLogs.length}
                      onChange={toggleSelectAllDuplicates}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">ID Parcela</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDuplicateLogs.map((log) => (
                  <tr key={log.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-4 w-4">
                      <input
                        type="checkbox"
                        checked={selectedDuplicates.includes(log.id)}
                        onChange={() => toggleSelectDuplicate(log.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <div>{log.client_name}</div>
                      <div className="text-xs text-gray-500">Cód: {log.client_code}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {log.item_id}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {log.due_date}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-right font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(log.installment_value) || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${log.message_type === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {log.message_type === 'overdue' ? 'Vencido' : 'Lembrete'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      Já existe na fila (ID: {log.existing_queue_id})
                    </td>
                  </tr>
                ))}
                {filteredDuplicateLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma duplicata encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorLogs;
