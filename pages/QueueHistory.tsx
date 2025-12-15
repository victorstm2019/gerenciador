import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatPhoneDisplay } from '../utils/phoneFormatter';
import { SendProgressMonitor } from '../utils/SendProgressMonitor';

interface QueueItem {
    id: string;
    installmentId?: string;
    code: string;
    clientName: string;
    cpf: string;
    installmentValue: string;
    dueDate: string;
    emissionDate?: string;
    createdAt?: string;
    scheduledDate?: string;
    sentDate?: string;
    errorDate?: string;
    status: 'PENDING' | 'SENT' | 'ERROR' | 'PREVIEW' | 'BLOCKED';
    messageContent?: string;
    messageType?: string;
    created_at?: string;
    description?: string;
    phone?: string;
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
    const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'enviado' | 'bloqueado' | 'erro'>('todos');
    const [filterType, setFilterType] = useState<'all' | 'reminder' | 'overdue'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewMessages, setPreviewMessages] = useState<QueueItem[]>([]);
    const [selectedMessage, setSelectedMessage] = useState<QueueItem | null>(null);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [blockingItem, setBlockingItem] = useState<{ item: QueueItem, type: 'installment' | 'client' } | null>(null);
    const [blockReason, setBlockReason] = useState('');

    // New manual generation states
    const [sendMode, setSendMode] = useState<'queue' | 'manual'>(() => {
        const saved = localStorage.getItem('sendMode');
        return (saved === 'queue' || saved === 'manual') ? saved : 'queue';
    });
    const [showManualWarning, setShowManualWarning] = useState(false);
    const [selectedBatchTypes, setSelectedBatchTypes] = useState<('reminder' | 'overdue')[]>([]);

    // Date range generation states
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);
    const [dateRangeStart, setDateRangeStart] = useState('');
    const [dateRangeEnd, setDateRangeEnd] = useState('');
    const [showDatePreview, setShowDatePreview] = useState(false);
    const [datePreviewItems, setDatePreviewItems] = useState<QueueItem[]>([]);
    const [selectedDateItems, setSelectedDateItems] = useState<Set<string>>(new Set());
    const [loadingDatePreview, setLoadingDatePreview] = useState(false);
    const [loadingConfirm, setLoadingConfirm] = useState(false);
    const [confirmTimeout, setConfirmTimeout] = useState<number>(0);

    // Selection states FOR MANUAL MODE
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [sending, setSending] = useState(false);
    const [autoSendMessages, setAutoSendMessages] = useState(false);

    // Sorting and filtering states
    const [sortBy, setSortBy] = useState<'code' | 'name' | 'dueDate' | 'value' | 'status'>('code');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [dueDateStart, setDueDateStart] = useState('');
    const [dueDateEnd, setDueDateEnd] = useState('');

    // Save sendMode to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('sendMode', sendMode);
    }, [sendMode]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            api.get<QueueItem[]>('/api/queue/today'),
            api.get<BlockedClient[]>('/api/blocked'),
            api.get<any>('/api/config')
        ])
            .then(([queueData, blockedData, configData]) => {
                setQueue(queueData || []);
                setBlocked(blockedData || []);
                if (configData) {
                    setAutoSendMessages(configData.auto_send_messages ?? false);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching data:", err);
                setLoading(false);
            });
    };

    const handleToggleAutoSend = async () => {
        const newValue = !autoSendMessages;
        setAutoSendMessages(newValue);
        
        try {
            const currentConfig = await api.get('/api/config');
            await api.post('/api/config', {
                ...currentConfig,
                auto_send_messages: newValue
            });
        } catch (err: any) {
            setAutoSendMessages(!newValue);
            alert('Erro ao salvar configuração: ' + err.message);
        }
    };

    const generateAndAddToQueue = (messageType: 'reminder' | 'overdue') => {
        setLoading(true);
        // 1. Generate the messages (preview)
        api.post<QueueItem[]>('/api/queue/generate-test', { messageType, limit: 100 })
            .then(data => {
                if (Array.isArray(data)) {
                    // 2. Add them to the queue
                    return api.post<{ inserted: number, skipped: number }>('/api/queue/add-items', {
                        items: data,
                        send_mode: sendMode.toUpperCase()
                    });
                } else {
                    throw new Error('Resposta inválida da API ao gerar');
                }
            })
            .then(result => {
                setLoading(false);
                alert(`${result.inserted} itens adicionados à fila\n${result.skipped} duplicados ignorados`);
                fetchData(); // Refresh the table
            })
            .catch(err => {
                setLoading(false);
                alert('Erro ao gerar e adicionar à fila: ' + err.message);
            });
    };

    const generateReminders = () => {
        if (confirm('Gerar e adicionar lembretes à fila?')) {
            generateAndAddToQueue('reminder');
        }
    };

    const generateOverdue = () => {
        if (confirm('Gerar e adicionar mensagens de atraso à fila?')) {
            generateAndAddToQueue('overdue');
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
        api.post<QueueItem[]>('/api/queue/generate-batch', { types: selectedBatchTypes })
            .then(data => {
                setLoading(false);
                if (Array.isArray(data)) {
                    setPreviewMessages(data);
                    setShowManualWarning(false);
                    setShowPreview(true);
                } else {
                    console.error("API returned non-array:", data);
                    const errorMessage = (data as any).error ? (data as any).error : 'Resposta inválida da API';
                    alert('Erro ao gerar lote: ' + errorMessage);
                }
            })
            .catch(err => {
                setLoading(false);
                alert('Erro ao gerar lote: ' + err.message);
            });
    };

    const handleSelectItem = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
        setSelectAll(false);
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedItems(new Set());
            setSelectAll(false);
        } else {
            const allIds = new Set(filteredQueue.map(item => item.id));
            setSelectedItems(allIds);
            setSelectAll(true);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedItems.size === 0) return;

        if (!confirm(`Tem certeza que deseja excluir ${selectedItems.size} itens selecionados?`)) {
            return;
        }

        setLoading(true);

        api.delete<{ deleted: number }>('/api/queue/items/bulk', {
            body: { ids: Array.from(selectedItems) }
        })
            .then(data => {
                setLoading(false);
                setSelectedItems(new Set());
                setSelectAll(false);
                fetchData();
                alert(`${data.deleted} itens excluídos com sucesso!`);
            })
            .catch(err => {
                setLoading(false);
                alert('Erro ao excluir itens: ' + err.message);
            });
    };

    const handleSendSelected = () => {
        if (selectedItems.size === 0) {
            alert('Por favor, selecione pelo menos um item para enviar');
            return;
        }

        if (!confirm(`Enviar ${selectedItems.size} mensagens selecionadas?`)) {
            return;
        }

        setSending(true);

        Promise.all(
            Array.from(selectedItems).map(id =>
                api.put(`/api/queue/items/${id}/select`, { selected: true })
            )
        )
            .then(() => {
                return api.post<{ sent: number, errors: number }>('/api/queue/send-selected', {});
            })
            .then(result => {
                setSending(false);
                setSelectedItems(new Set());
                setSelectAll(false);
                alert(`Enviado: ${result.sent} mensagens\nErros: ${result.errors}`);
                fetchData();
            })
            .catch(err => {
                setSending(false);
                alert('Erro ao enviar: ' + err.message);
            });
    };

    const formatCurrency = (value: string | number | undefined) => {
        if (!value) return 'R$ 0,00';
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    };

    const parseBrazilianDate = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        // If already in dd/MM/yyyy format, return as is
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return dateStr;
        }
        // Otherwise try to parse and format
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const handleBlockInstallment = (item: QueueItem) => {
        if (!blockReason.trim()) {
            alert('Por favor, informe o motivo do bloqueio');
            return;
        }

        api.post('/api/blocked/by-installment', {
            client_code: item.code,
            installment_id: item.id,
            client_name: item.clientName,
            reason: blockReason
        })
            .then(() => {
                setBlockingItem(null);
                setBlockReason('');
                fetchData();
                alert('Parcela bloqueada com sucesso!');
            })
            .catch(err => alert('Erro ao bloquear: ' + err.message));
    };

    const handleBlockClient = (item: QueueItem) => {
        if (!blockReason.trim()) {
            alert('Por favor, informe o motivo do bloqueio');
            return;
        }

        api.post('/api/blocked/by-client', {
            client_code: item.code,
            client_name: item.clientName,
            reason: blockReason
        })
            .then(() => {
                setBlockingItem(null);
                setBlockReason('');
                fetchData();
                alert('Cliente bloqueado com sucesso - todas as mensagens!');
            })
            .catch(err => alert('Erro ao bloquear: ' + err.message));
    };

    const handleUnblock = (id: number) => {
        if (confirm('Desbloquear este item?')) {
            api.delete(`/api/blocked/${id}`)
                .then(() => fetchData())
                .catch(err => alert('Erro ao desbloquear: ' + err.message));
        }
    };

    // Date range generation functions
    const handleDateRangeGenerate = async () => {
        if (!dateRangeStart || !dateRangeEnd) {
            alert('Por favor, selecione as datas de início e fim');
            return;
        }

        setLoadingDatePreview(true);
        try {
            const data = await api.post<QueueItem[]>('/api/queue/generate-by-date', {
                startDate: dateRangeStart,
                endDate: dateRangeEnd
            });

            setDatePreviewItems(data);
            setShowDateRangeModal(false);
            setShowDatePreview(true);
            setSelectedDateItems(new Set());
        } catch (err: any) {
            alert('Erro ao gerar preview: ' + err.message);
        } finally {
            setLoadingDatePreview(false);
        }
    };

    const handleDateItemSelect = (id: string) => {
        const newSelected = new Set(selectedDateItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedDateItems(newSelected);
    };

    const handleDateSelectAll = () => {
        if (selectedDateItems.size === datePreviewItems.length) {
            setSelectedDateItems(new Set());
        } else {
            setSelectedDateItems(new Set(datePreviewItems.map(item => item.id)));
        }
    };

    const handleDatePreviewConfirm = async () => {
        if (selectedDateItems.size === 0) {
            alert('Selecione pelo menos um item');
            return;
        }

        const itemsToAdd = datePreviewItems.filter(item => selectedDateItems.has(item.id));

        setLoadingConfirm(true);
        setConfirmTimeout(60); // 60 segundos

        // Iniciar contagem regressiva
        const countdownInterval = setInterval(() => {
            setConfirmTimeout(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Timeout de 60 segundos
        const timeoutId = setTimeout(() => {
            clearInterval(countdownInterval);
            setLoadingConfirm(false);
            setConfirmTimeout(0);
            alert('⏱️ Tempo excedido!\n\nA adição à fila levou mais de 1 minuto.\nPor favor, reduza o período de datas selecionado e tente novamente.');
        }, 60000);

        try {
            const result = await api.post<{ inserted: number, skipped: number }>('/api/queue/add-items', {
                items: itemsToAdd,
                send_mode: 'MANUAL'
            });

            // Limpar timeout e countdown se completou antes de 60s
            clearTimeout(timeoutId);
            clearInterval(countdownInterval);

            alert(`${result.inserted} itens adicionados à fila\n${result.skipped} itens ignorados (duplicados)`);
            setShowDatePreview(false);
            setDatePreviewItems([]);
            setSelectedDateItems(new Set());
            setDateRangeStart('');
            setDateRangeEnd('');
            fetchData();
        } catch (err: any) {
            clearTimeout(timeoutId);
            clearInterval(countdownInterval);
            alert('Erro ao adicionar itens: ' + err.message);
        } finally {
            setLoadingConfirm(false);
            setConfirmTimeout(0);
        }
    };

    const filteredQueue = queue.filter(item => {
        const matchesStatus = filterStatus === 'todos' ? true :
            (filterStatus === 'pendente' && item.status === 'PENDING') ||
            (filterStatus === 'enviado' && item.status === 'SENT') ||
            (filterStatus === 'bloqueado' && item.status === 'BLOCKED') ||
            (filterStatus === 'erro' && item.status === 'ERROR');

        const matchesSearch = searchTerm === '' ? true :
            (item.clientName && item.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.cpf && item.cpf.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.installmentId && item.installmentId.toLowerCase().includes(searchTerm.toLowerCase()));

        // Filter by type
        if (filterType !== 'all') {
            if (filterType === 'reminder' && item.messageType !== 'reminder') return false;
            if (filterType === 'overdue' && item.messageType !== 'overdue') return false;
        }

        // Date filters
        let matchesDueDate = true;

        if (dueDateStart || dueDateEnd) {
            // Validate that start date is not greater than end date
            if (dueDateStart && dueDateEnd && dueDateStart > dueDateEnd) {
                // Skip this item if date range is invalid
                return false;
            }

            // Helper to get YYYY-MM-DD string from any date format
            const getISODateStr = (dateStr: string) => {
                if (!dateStr) return null;
                let date: Date;

                // Handle BR format dd/MM/yyyy
                if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    const [day, month, year] = dateStr.split('/');
                    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else {
                    date = new Date(dateStr);
                }

                if (isNaN(date.getTime())) return null;

                // Return YYYY-MM-DD adjusted to local timezone to match input type="date"
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const itemDateStr = getISODateStr(item.dueDate);

            if (itemDateStr) {
                if (dueDateStart) {
                    matchesDueDate = matchesDueDate && itemDateStr >= dueDateStart;
                }
                if (dueDateEnd) {
                    matchesDueDate = matchesDueDate && itemDateStr <= dueDateEnd;
                }
            } else {
                // If item has no valid date, exclude it ONLY when filtering by date
                matchesDueDate = false;
            }
        }

        return matchesStatus && matchesSearch && matchesDueDate;
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
                const getDate = (d: string) => {
                    if (!d) return 0;
                    if (d.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        const [day, month, year] = d.split('/');
                        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
                    }
                    return new Date(d).getTime();
                };
                comparison = getDate(a.dueDate) - getDate(b.dueDate);
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
        <>
        <SendProgressMonitor />
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Queue List */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex flex-col gap-4 mb-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Fila & Histórico</h2>
                                    <div className="relative group">
                                        <button className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined text-lg">help</span>
                                        </button>
                                        <div className="absolute left-0 top-10 w-[600px] bg-white dark:bg-gray-900 border-2 border-blue-500 rounded-lg shadow-2xl p-6 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined">info</span>
                                                Tutorial: Como Funciona o Sistema
                                            </h3>
                                            
                                            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                                                <div>
                                                    <h4 className="font-bold text-green-600 dark:text-green-400 mb-1">🟢 Modo Fila (Automático)</h4>
                                                    <p className="text-xs leading-relaxed">• Sistema gera mensagens automaticamente no horário configurado (via scheduler a cada 30 min)</p>
                                                    <p className="text-xs leading-relaxed">• Verifica: modo ativo, se já executou hoje, horário configurado</p>
                                                    <p className="text-xs leading-relaxed">• Se "Envio Automático" estiver ATIVO: envia imediatamente após gerar</p>
                                                    <p className="text-xs leading-relaxed">• Se "Envio Automático" estiver INATIVO: apenas adiciona à fila para envio manual</p>
                                                </div>
                                                
                                                <div>
                                                    <h4 className="font-bold text-orange-600 dark:text-orange-400 mb-1">🔶 Modo Manual</h4>
                                                    <p className="text-xs leading-relaxed">• Você controla quando gerar e enviar mensagens</p>
                                                    <p className="text-xs leading-relaxed">• Use os botões "Gerar Lembretes" ou "Gerar Vencidos" para adicionar à fila</p>
                                                    <p className="text-xs leading-relaxed">• Selecione itens na tabela e clique "Enviar Selecionados"</p>
                                                    <p className="text-xs leading-relaxed">• Opção "Gerar Vencidos por Data" permite escolher período específico</p>
                                                </div>
                                                
                                                <div>
                                                    <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-1">📋 Geração de Mensagens</h4>
                                                    <p className="text-xs leading-relaxed">• <strong>Lembretes:</strong> Parcelas que vencem em X dias (configurável)</p>
                                                    <p className="text-xs leading-relaxed">• <strong>Vencidos:</strong> Parcelas já vencidas há X dias (configurável)</p>
                                                    <p className="text-xs leading-relaxed">• Sistema busca dados do SQL Server configurado</p>
                                                    <p className="text-xs leading-relaxed">• Aplica template de mensagem com variáveis personalizadas</p>
                                                </div>
                                                
                                                <div>
                                                    <h4 className="font-bold text-blue-600 dark:text-blue-400 mb-1">📤 Envio de Mensagens</h4>
                                                    <p className="text-xs leading-relaxed">• Mensagens com status PENDING podem ser enviadas</p>
                                                    <p className="text-xs leading-relaxed">• Sistema verifica lista negativa antes de enviar</p>
                                                    <p className="text-xs leading-relaxed">• Após envio: status muda para SENT ou ERROR</p>
                                                    <p className="text-xs leading-relaxed">• Bloqueios podem ser por parcela específica ou cliente completo</p>
                                                </div>
                                                
                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-2 mt-2">
                                                    <p className="text-xs text-yellow-800 dark:text-yellow-300"><strong>💡 Dica:</strong> Configure tudo em "Configuração de Mensagens" antes de ativar o Modo Fila!</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Send Mode Toggle */}
                                <div className="flex items-center gap-4">
                                    {sendMode === 'queue' && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Envio Automático:</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={autoSendMessages}
                                                    onChange={handleToggleAutoSend}
                                                />
                                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    )}
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
                                {sendMode === 'manual' && (
                                    <button
                                        onClick={() => setShowDateRangeModal(true)}
                                        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                                        Gerar Vencidos por Data
                                    </button>
                                )}
                            </div>

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
                                <div className="flex flex-wrap items-end gap-4">
                                    {/* Status Filters Group */}
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Status</span>
                                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                            <button
                                                onClick={() => setFilterStatus('todos')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterStatus === 'todos' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Todos
                                            </button>
                                            <button
                                                onClick={() => setFilterStatus('pendente')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterStatus === 'pendente' ? 'bg-white dark:bg-gray-600 shadow text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Pendentes
                                            </button>
                                            <button
                                                onClick={() => setFilterStatus('enviado')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterStatus === 'enviado' ? 'bg-white dark:bg-gray-600 shadow text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Enviados
                                            </button>
                                            <button
                                                onClick={() => setFilterStatus('bloqueado')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterStatus === 'bloqueado' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Bloqueados
                                            </button>
                                            <button
                                                onClick={() => setFilterStatus('erro')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterStatus === 'erro' ? 'bg-white dark:bg-gray-600 shadow text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Erros
                                            </button>
                                        </div>
                                    </div>

                                    {/* Vertical Separator */}
                                    <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 hidden md:block mb-1"></div>

                                    {/* Type Filters Group */}
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Tipo</span>
                                        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                            <button
                                                onClick={() => setFilterType('all')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Todos
                                            </button>
                                            <button
                                                onClick={() => setFilterType('reminder')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterType === 'reminder' ? 'bg-white dark:bg-gray-600 shadow text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Lembretes
                                            </button>
                                            <button
                                                onClick={() => setFilterType('overdue')}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterType === 'overdue' ? 'bg-white dark:bg-gray-600 shadow text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Vencidos
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Date Filters and Sorting */}
                            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                                <div className="flex gap-2 items-center">
                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Vencimento:</label>
                                    <input
                                        type="date"
                                        className="px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={dueDateStart}
                                        onChange={(e) => setDueDateStart(e.target.value)}
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="date"
                                        className="px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={dueDateEnd}
                                        onChange={(e) => setDueDateEnd(e.target.value)}
                                    />
                                    {dueDateStart && dueDateEnd && dueDateStart > dueDateEnd && (
                                        <span className="text-xs text-red-600 dark:text-red-400 ml-2">
                                            ⚠️ Data inicial maior que final
                                        </span>
                                    )}
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
                    </div>

                    {/* Queue Table with Scrolling */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectAll}
                                                onChange={handleSelectAll}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                title="Selecionar todos os itens"
                                            />
                                        </th>
                                        <th className="px-4 py-3">ID Parcela</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">TELEFONE</th>
                                        <th className="px-4 py-3">Vencimento</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
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
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(item.id)}
                                                    onChange={() => handleSelectItem(item.id)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">{item.installmentId || item.id}</td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{item.clientName}</p>
                                                    <p className="text-xs text-gray-500">{item.cpf}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                                {formatPhoneDisplay(item.phone)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                                {parseBrazilianDate(item.dueDate)}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-right">{formatCurrency(item.installmentValue)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs ${item.status === 'SENT' ? 'bg-green-100 text-green-800' :
                                                    item.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                                                        item.status === 'BLOCKED' ? 'bg-blue-100 text-blue-800' :
                                                            item.status === 'PREVIEW' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {item.status === 'SENT' ? 'Enviado' :
                                                        item.status === 'ERROR' ? 'Erro' :
                                                            item.status === 'BLOCKED' ? 'Bloqueado' :
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
                                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                                Nenhum item encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Actions for Selected Items */}
                    {selectedItems.size > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mt-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{selectedItems.size}</strong> item(ns) selecionado(s)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDeleteSelected}
                                        disabled={loading}
                                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                        Excluir Selecionados
                                    </button>
                                    {sendMode === 'manual' && (
                                        <button
                                            onClick={handleSendSelected}
                                            disabled={sending}
                                            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="material-symbols-outlined text-sm">send</span>
                                            {sending ? 'Enviando...' : `Enviar Selecionados`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Blocked List - Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-200">Lista Negativa</h2>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {blocked.map((item) => (
                                <div key={item.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 flex justify-between items-start">
                                    <div>
                                        <p className="font-medium text-xs text-gray-900 dark:text-white">{item.client_name}</p>
                                        <p className="text-[10px] text-gray-500">{item.reason}</p>
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
                                <p className="text-xs text-gray-500 text-center py-4">Nenhum cliente bloqueado.</p>
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
                                                <p className="text-xs text-gray-500">Vencimento: {parseBrazilianDate(msg.dueDate)} | Valor: {formatCurrency(msg.installmentValue)}</p>
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Mensagem - {selectedMessage.clientName}</h3>
                            <button
                                onClick={() => setShowMessageModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="space-y-2 mb-4">
                                <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400">Código</p>
                                        <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.code}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400">CPF</p>
                                        <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.cpf}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400">Emissão</p>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {parseBrazilianDate(selectedMessage.emissionDate)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400">Vencimento</p>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {parseBrazilianDate(selectedMessage.dueDate)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400">Valor</p>
                                        <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedMessage.installmentValue)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400">Telefone</p>
                                        <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.phone || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-gray-500 dark:text-gray-400">Descrição da Parcela</p>
                                        <p className="font-medium text-gray-900 dark:text-white">{selectedMessage.description || 'N/A'}</p>
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
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
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

            {/* Date Range Selection Modal */}
            {showDateRangeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-500">calendar_month</span>
                                Gerar Vencidos por Data
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Início</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={dateRangeStart}
                                    onChange={(e) => setDateRangeStart(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fim</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={dateRangeEnd}
                                    onChange={(e) => setDateRangeEnd(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowDateRangeModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDateRangeGenerate}
                                disabled={loadingDatePreview}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loadingDatePreview ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Gerando...
                                    </>
                                ) : (
                                    'Gerar Preview'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Generation Preview Modal */}
            {showDatePreview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Preview de Geração por Data</h3>
                                <p className="text-sm text-gray-500">
                                    {datePreviewItems.length} itens encontrados. Selecione os que deseja adicionar à fila.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDatePreview(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedDateItems.size === datePreviewItems.length && datePreviewItems.length > 0}
                                                onChange={handleDateSelectAll}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Vencimento</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3">Mensagem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {datePreviewItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${selectedDateItems.has(item.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                            onClick={() => handleDateItemSelect(item.id)}
                                        >
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDateItems.has(item.id)}
                                                    onChange={() => handleDateItemSelect(item.id)}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.code}</td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{item.clientName}</p>
                                                    <p className="text-xs text-gray-500">{item.cpf}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                {parseBrazilianDate(item.dueDate)}
                                            </td>
                                            <td className="px-4 py-3 font-medium">{formatCurrency(item.installmentValue)}</td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs text-gray-500 truncate max-w-xs" title={item.messageContent}>
                                                    {item.messageContent}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                    {datePreviewItems.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                                Nenhum item encontrado para o período selecionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                <strong>{selectedDateItems.size}</strong> itens selecionados
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDatePreview(false)}
                                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDatePreviewConfirm}
                                    disabled={selectedDateItems.size === 0 || loadingConfirm}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {loadingConfirm ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Adicionando... ({confirmTimeout}s)
                                        </>
                                    ) : (
                                        'Confirmar e Adicionar à Fila'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

export default QueueHistory;
