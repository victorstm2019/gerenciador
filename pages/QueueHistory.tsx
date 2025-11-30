import React, { useState, useEffect } from 'react';

interface QueueItem {
  id: string;
  code: string;
  clientName: string;
  cpf: string;
  installmentValue: string;
  dueDate: string;
  scheduledDate?: string;
  sentDate?: string;
  errorDate?: string;
  status: 'PENDING' | 'SENT' | 'ERROR' | 'PREVIEW';
  messageContent?: string;
  messageType?: string;
}

interface BlockedClient {
  id: number;
  identifier: string;
  client_name: string;
  reason: string;
  created_at: string;
  block_type?: string;
  client_code?: string;
}

const QueueHistory: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [blocked, setBlocked] = useState<BlockedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<QueueItem[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<QueueItem | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [blockingItem, setBlockingItem] = useState<{ item: QueueItem, type: 'installment' | 'client' } | null>(null);
  const [blockReason, setBlockReason] = useState('');

  // New manual generation states
  const [sendMode, setSendMode] = useState<'queue' | 'manual'>('queue'); // padrão: fila
  const [showManualWarning, setShowManualWarning] = useState(false);
  const [selectedBatchTypes, setSelectedBatchTypes] = useState<('reminder' | 'overdue')[]>([]);

  // Sorting and filtering states
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'dueDate' | 'value' | 'status'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [emissionDateStart, setEmissionDateStart] = useState('');
  const [emissionDateEnd, setEmissionDateEnd] = useState('');
  const [dueDateStart, setDueDateStart] = useState('');
  const [dueDateEnd, setDueDateEnd] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:3002/api/queue/today').then(res => res.json()), // Changed to fetch today's queue by default
      fetch('http://localhost:3002/api/blocked').then(res => res.json())
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

  const generateReminders = () => {
    if (sendMode === 'manual') {
      // In manual mode, we just preview
      generateTest('reminder');
    } else {
      // In queue mode, we might want to confirm or just add to queue
      // For now, let's use the same test generation but maybe with a different flag if needed
      // Or simply warn that this is manual generation
      generateTest('reminder');
    }
  };

  const generateOverdue = () => {
    if (sendMode === 'manual') {
      generateTest('overdue');
    } else {
      generateTest('overdue');
    }
  };

  const openManualBatchModal = () => {
    setShowManualWarning(true);
    setSelectedBatchTypes([]);
  };

  const handleManualBatchConfirm = () => {
    if (selectedBatchTypes.length === 0) {
      alert('Selecione pelo menos um tipo de mensagem.');
      return;
    }

    setLoading(true);
    fetch('http://localhost:3002/api/queue/generate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ types: selectedBatchTypes })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (Array.isArray(data)) {
          setPreviewMessages(data);
          setShowManualWarning(false);
          setShowPreview(true);
        } else {
          console.error("API returned non-array:", data);
          const errorMessage = (data && data.error) ? data.error : 'Resposta inválida da API';
          alert('Erro ao gerar lote: ' + errorMessage);
        }
      })
      .catch(err => {
        setLoading(false);
        alert('Erro ao gerar lote: ' + err);
      });
  };

  const generateTest = (messageType: 'reminder' | 'overdue') => {
    setLoading(true);
    fetch('http://localhost:3002/api/queue/generate-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType, limit: 20 })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (Array.isArray(data)) {
          setPreviewMessages(data);
          setShowPreview(true);
        } else {
          console.error("API returned non-array:", data);
          alert('Erro ao gerar teste: Resposta inválida da API');
        }
      })
      .catch(err => {
        setLoading(false);
        alert('Erro ao gerar teste: ' + err);
      });
  };

  const handleBlockInstallment = (item: QueueItem) => {
    if (!blockReason.trim()) {
      alert('Por favor, informe o motivo do bloqueio');
      return;
    }

    fetch('http://localhost:3002/api/blocked/by-installment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_code: item.code,
        installment_id: item.id,
        client_name: item.clientName,
        reason: blockReason
      })
    })
      .then(res => res.json())
      .then(() => {
        setBlockingItem(null);
        setBlockReason('');
        fetchData();
        alert('Parcela bloqueada com sucesso!');
      })
      .catch(err => alert('Erro ao bloquear: ' + err));
  };

  const handleBlockClient = (item: QueueItem) => {
    if (!blockReason.trim()) {
      alert('Por favor, informe o motivo do bloqueio');
      return;
    }

    fetch('http://localhost:3002/api/blocked/by-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_code: item.code,
        client_name: item.clientName,
        reason: blockReason
      })
    })
      .then(res => res.json())
      .then(() => {
        setBlockingItem(null);
        setBlockReason('');
        fetchData();
        alert('Cliente bloqueado com sucesso - todas as mensagens!');
      })
      .catch(err => alert('Erro ao bloquear: ' + err));
  };

  const handleUnblock = (id: number) => {
    if (confirm('Desbloquear este item?')) {
      fetch(`http://localhost:3002/api/blocked/${id}`, {
        method: 'DELETE'
      })
        .then(() => fetchData())
        .catch(err => alert('Erro ao desbloquear: ' + err));
    }
  };

  const filteredQueue = queue.filter(item => {
    const matchesStatus = filterStatus === 'todos' ? true :
      (filterStatus === 'pendente' && item.status === 'PENDING') ||
      (filterStatus === 'enviado' && item.status === 'SENT') ||
      (filterStatus === 'erro' && item.status === 'ERROR');

    const matchesSearch = searchTerm === '' ? true :
      item.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cpf?.toLowerCase().includes(searchTerm.toLowerCase());

    // Date filters
    let matchesEmissionDate = true;
    let matchesDueDate = true;

    if (emissionDateStart || emissionDateEnd) {
      const emissionDate = item.scheduledDate ? new Date(item.scheduledDate) : null;
      if (emissionDate) {
        if (emissionDateStart) {
          matchesEmissionDate = matchesEmissionDate && emissionDate >= new Date(emissionDateStart);
        }
        if (emissionDateEnd) {
          const endDate = new Date(emissionDateEnd);
          endDate.setHours(23, 59, 59, 999);
          matchesEmissionDate = matchesEmissionDate && emissionDate <= endDate;
        }
      }
    }

    if (dueDateStart || dueDateEnd) {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (dueDate) {
        if (dueDateStart) {
          matchesDueDate = matchesDueDate && dueDate >= new Date(dueDateStart);
        }
        if (dueDateEnd) {
          const endDate = new Date(dueDateEnd);
          endDate.setHours(23, 59, 59, 999);
          matchesDueDate = matchesDueDate && dueDate <= endDate;
        }
      }
    }

    return matchesStatus && matchesSearch && matchesEmissionDate && matchesDueDate;
  }).sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'code':
        comparison = (a.code || '').localeCompare(b.code || '');
        break;
      case 'name':
        comparison = (a.clientName || '').localeCompare(b.clientName || '');
        break;
      case 'dueDate':
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'value':
        const valueA = parseFloat((a.installmentValue || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        const valueB = parseFloat((b.installmentValue || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        comparison = valueA - valueB;
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Fila & Histórico</h2>

                {/* Send Mode Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Modo:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={sendMode === 'manual'}
                      onChange={(e) => setSendMode(e.target.checked ? 'manual' : 'queue')}
                    />
                    <div className="w-20 h-8 bg-green-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-12 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all dark:border-gray-600 peer-checked:bg-orange-400"></div>
                  </label>
                  <span className={`text-sm font-medium ${sendMode === 'queue' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {sendMode === 'queue' ? '🟢 Fila' : '🔶 Manual'}
                  </span>
                </div>
              </div>

              {/* Generation Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generateReminders}
                  className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">notifications</span>
                  Gerar Lembretes
                </button>
                <button
                  onClick={generateOverdue}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Gerar Vencidos
                </button>
                <button
                  onClick={openManualBatchModal}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors flex items-center gap-2 font-semibold"
                >
                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                  Gerar Lote Manual
                </button>
              </div>

              {/* Mode Info */}
              {sendMode === 'manual' && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2">
                  <p className="text-xs text-orange-800 dark:text-orange-300">
                    ℹ️ Modo Manual ativo: mensagens serão exibidas para preview antes do envio.
                  </p>
                </div>
              )}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Buscar por nome, código ou CPF..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
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

              {/* Date Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Emissão:</label>
                  <input
                    type="date"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={emissionDateStart}
                    onChange={(e) => setEmissionDateStart(e.target.value)}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={emissionDateEnd}
                    onChange={(e) => setEmissionDateEnd(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Vencimento:</label>
                  <input
                    type="date"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={dueDateStart}
                    onChange={(e) => setDueDateStart(e.target.value)}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={dueDateEnd}
                    onChange={(e) => setDueDateEnd(e.target.value)}
                  />
                </div>
              </div>

              {/* Sorting Buttons */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Ordenar por:</span>
                {(['code', 'name', 'dueDate', 'value', 'status'] as const).map((field) => (
                  <button
                    key={field}
                    onClick={() => {
                      if (sortBy === field) {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy(field);
                        setSortOrder('asc');
                      }
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${sortBy === field
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                  >
                    {field === 'code' && 'Código'}
                    {field === 'name' && 'Nome'}
                    {field === 'dueDate' && 'Vencimento'}
                    {field === 'value' && 'Valor'}
                    {field === 'status' && 'Status'}
                    {sortBy === field && (
                      <span className="material-symbols-outlined text-xs">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Queue Table with Scrolling */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredQueue.map((item) => (
                    <tr
                      key={item.id}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        setSelectedMessage(item);
                        setShowMessageModal(true);
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.code}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.clientName}</p>
                          <p className="text-xs text-gray-500">{item.cpf}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-3 font-medium">R$ {item.installmentValue}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${item.status === 'SENT' ? 'bg-green-100 text-green-800' :
                          item.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                            item.status === 'PREVIEW' ? 'bg-purple-100 text-purple-800' :
                              'bg-yellow-100 text-yellow-800'
                          }`}>
                          {item.status === 'SENT' ? 'Enviado' :
                            item.status === 'ERROR' ? 'Erro' :
                              item.status === 'PREVIEW' ? 'Preview' :
                                'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {item.messageContent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessage(item);
                                setShowMessageModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver mensagem"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setBlockingItem({ item, type: 'installment' });
                            }}
                            className="text-orange-600 hover:text-orange-800"
                            title="Bloquear esta parcela"
                          >
                            <span className="material-symbols-outlined text-sm">block</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setBlockingItem({ item, type: 'client' });
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Bloquear todas deste cliente"
                          >
                            <span className="material-symbols-outlined text-sm">person_off</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQueue.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhum item encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Blocked List - Right Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Lista Negativa</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {blocked.map((item) => (
                <div key={item.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.client_name}</p>
                    <p className="text-xs text-gray-500">{item.reason}</p>
                    <div className="flex gap-2 mt-1">
                      {item.block_type && (
                        <span className={`text-[10px] px-2 py-0.5 rounded ${item.block_type === 'client'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                          }`}>
                          {item.block_type === 'client' ? 'Cliente Completo' : 'Parcela Específica'}
                        </span>
                      )}
                      <p className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
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

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Preview de Mensagens</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                {previewMessages.map((msg, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{msg.clientName}</p>
                        <p className="text-xs text-gray-500">Código: {msg.code} | CPF: {msg.cpf}</p>
                        <p className="text-xs text-gray-500">Vencimento: {new Date(msg.dueDate).toLocaleDateString('pt-BR')} | Valor: R$ {msg.value}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${msg.messageType === 'reminder' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                        {msg.messageType === 'reminder' ? 'Lembrete' : 'Atraso'}
                      </span>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded mt-2">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.messageContent}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message View Modal */}
      {showMessageModal && selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Mensagem - {selectedMessage.clientName}</h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Código</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.code}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">CPF</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.cpf}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Vencimento</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedMessage.dueDate ? new Date(selectedMessage.dueDate).toLocaleDateString('pt-BR') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Valor</p>
                    <p className="font-medium text-gray-900 dark:text-white">R$ {selectedMessage.installmentValue}</p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Conteúdo da Mensagem:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedMessage.messageContent || 'Mensagem não disponível'}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {blockingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                {blockingItem.type === 'installment' ? 'Bloquear Parcela' : 'Bloquear Cliente'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {blockingItem.type === 'installment'
                  ? 'Esta parcela específica não receberá mensagens'
                  : `Todas as mensagens de ${blockingItem.item.clientName} serão bloqueadas`
                }
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente: {blockingItem.item.clientName}</p>
                <p className="text-xs text-gray-500">Código: {blockingItem.item.code}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo do Bloqueio</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={3}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Informe o motivo..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setBlockingItem(null);
                  setBlockReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (blockingItem.type === 'installment') {
                    handleBlockInstallment(blockingItem.item);
                  } else {
                    handleBlockClient(blockingItem.item);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Batch Warning Modal */}
      {showManualWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">warning</span>
                Atenção: Geração Manual
              </h3>
            </div>
            <div className="p-6">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  A geração manual ignora as verificações de envio automático de hoje. Isso pode resultar em mensagens duplicadas se o sistema automático já tiver rodado.
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Selecione os tipos de mensagem que deseja gerar:
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBatchTypes?.includes('reminder') || false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBatchTypes([...selectedBatchTypes, 'reminder']);
                      } else {
                        setSelectedBatchTypes(selectedBatchTypes.filter(t => t !== 'reminder'));
                      }
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lembretes de Vencimento</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBatchTypes?.includes('overdue') || false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBatchTypes([...selectedBatchTypes, 'overdue']);
                      } else {
                        setSelectedBatchTypes(selectedBatchTypes.filter(t => t !== 'overdue'));
                      }
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Avisos de Atraso</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowManualWarning(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleManualBatchConfirm}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Confirmar Geração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 m-4">
          <h2 className="text-lg font-bold mb-2">Algo deu errado na exibição deste componente.</h2>
          <p className="font-mono text-xs bg-white p-2 rounded border border-red-100 mb-4">
            {this.state.error?.toString()}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function QueueHistoryWithBoundary() {
  return (
    <ErrorBoundary>
      <QueueHistory />
    </ErrorBoundary>
  );
}
