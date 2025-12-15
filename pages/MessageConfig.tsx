import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface FieldMapping {
  id?: number;
  message_variable: string;
  database_column: string;
}

const MessageConfig: React.FC = () => {
  const [sendTime, setSendTime] = useState('09:00');
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [autoSendMessages, setAutoSendMessages] = useState(false);
  const [reminderMsg, setReminderMsg] = useState('Olá {cliente}, sua fatura vence hoje. Link: {link}');
  const [overdueMsg, setOverdueMsg] = useState('Olá {cliente}, sua fatura venceu em {vencimento}. Link: {link}');
  const [daysBefore, setDaysBefore] = useState(1);
  const [daysAfter, setDaysAfter] = useState(1);
  const [enableReminder, setEnableReminder] = useState(true);
  const [enableOverdue, setEnableOverdue] = useState(true);
  const [reminderRepeatTimes, setReminderRepeatTimes] = useState(0);
  const [reminderRepeatInterval, setReminderRepeatInterval] = useState(3);
  const [overdueRepeatTimes, setOverdueRepeatTimes] = useState(0);
  const [overdueRepeatInterval, setOverdueRepeatInterval] = useState(7);

  // New Calculation Fields
  const [interestRate, setInterestRate] = useState(0);
  const [penaltyRate, setPenaltyRate] = useState(0);
  const [baseValueType, setBaseValueType] = useState('valorbrutoparcela');

  // Send Control Fields
  const [delayBetweenMessages, setDelayBetweenMessages] = useState(3);
  const [batchSize, setBatchSize] = useState(15);
  const [batchDelay, setBatchDelay] = useState(60);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(30);
  const [maxMessagesPerHour, setMaxMessagesPerHour] = useState(100);

  const [isLoading, setIsLoading] = useState(false);

  // Field Mappings State
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  // Available database columns
  const availableColumns = [
    'codigocliente', 'numeroparcela', 'sequenciavenda', 'nomecliente', 'cpfcliente', 'fone1', 'fone2',
    'descricaoparcela', 'emissao', 'vencimento', 'valorbrutoparcela',
    'valorfinalparcela', 'valortotaldevido', 'totalvencido'
  ];

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.get<any>('/api/config'),
      api.get<FieldMapping[]>('/api/field-mappings')
    ])
      .then(([configData, mappingsData]) => {
        if (configData) {
          setSendTime(configData.send_time || '09:00');
          setAutoSendEnabled(configData.auto_send_enabled ?? false);
          setAutoSendMessages(configData.auto_send_messages ?? false);
          setReminderMsg(configData.reminder_msg || '');
          setOverdueMsg(configData.overdue_msg || '');
          setDaysBefore(configData.reminder_days || 1);
          setDaysAfter(configData.overdue_days || 1);
          setEnableReminder(configData.reminder_enabled ?? true);
          setEnableOverdue(configData.overdue_enabled ?? true);
          setReminderRepeatTimes(configData.reminder_repeat_times ?? 0);
          setReminderRepeatInterval(configData.reminder_repeat_interval_days ?? 3);
          setOverdueRepeatTimes(configData.overdue_repeat_times ?? 0);
          setOverdueRepeatInterval(configData.overdue_repeat_interval_days ?? 7);

          setInterestRate(configData.interest_rate ?? 0);
          setPenaltyRate(configData.penalty_rate ?? 0);
          setBaseValueType(configData.base_value_type || 'valorbrutoparcela');

          setDelayBetweenMessages(configData.delay_between_messages ?? 3);
          setBatchSize(configData.batch_size ?? 15);
          setBatchDelay(configData.batch_delay ?? 60);
          setMaxRetries(configData.max_retries ?? 3);
          setRetryDelay(configData.retry_delay ?? 30);
          setMaxMessagesPerHour(configData.max_messages_per_hour ?? 100);
        }
        if (mappingsData) {
          const filteredMappings = mappingsData.filter(m =>
            !['@desconto', '@juros', '@multa', 'desconto', 'juros', 'multa'].includes(m.message_variable.toLowerCase())
          );
          setFieldMappings(filteredMappings);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching config:", err);
        setIsLoading(false);
      });
  }, []);

  const saveConfig = () => {
    setIsLoading(true);
    api.post('/api/config', {
      send_time: sendTime,
      auto_send_enabled: autoSendEnabled,
      auto_send_messages: autoSendMessages,
      reminder_msg: reminderMsg,
      reminder_enabled: enableReminder,
      reminder_days: daysBefore,
      reminder_repeat_times: reminderRepeatTimes,
      reminder_repeat_interval_days: reminderRepeatInterval,
      overdue_msg: overdueMsg,
      overdue_enabled: enableOverdue,
      overdue_days: daysAfter,
      overdue_repeat_times: overdueRepeatTimes,
      overdue_repeat_interval_days: overdueRepeatInterval,
      interest_rate: interestRate,
      penalty_rate: penaltyRate,
      base_value_type: baseValueType,
      delay_between_messages: delayBetweenMessages,
      batch_size: batchSize,
      batch_delay: batchDelay,
      max_retries: maxRetries,
      retry_delay: retryDelay,
      max_messages_per_hour: maxMessagesPerHour
    })
      .then(() => {
        setIsLoading(false);
        alert('Configurações salvas!');
      })
      .catch(err => {
        setIsLoading(false);
        alert('Erro ao salvar: ' + err.message);
      });
  };

  const saveMappings = () => {
    setIsLoading(true);
    api.post('/api/field-mappings', fieldMappings)
      .then(() => {
        setIsLoading(false);
        alert('Mapeamentos salvos com sucesso!');
      })
      .catch(err => {
        setIsLoading(false);
        alert('Erro ao salvar mapeamentos: ' + err.message);
      });
  };

  const updateMapping = (variable: string, column: string) => {
    setFieldMappings(prev =>
      prev.map(m =>
        m.message_variable === variable
          ? { ...m, database_column: column }
          : m
      )
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Configuração de Mensagens</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Agendamento Geral</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${autoSendEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {autoSendEnabled ? 'Envio Automático Ativo' : 'Envio Automático Desativado'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoSendEnabled}
                onChange={(e) => setAutoSendEnabled(e.target.checked)}
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-full max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Horário de Envio
            </label>
            <input
              type="time"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              disabled={!autoSendEnabled}
            />
            <p className="text-xs text-gray-500 mt-1">Horário diário para processamento da fila</p>
          </div>
        </div>
        {!autoSendEnabled && (
          <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
            <p className="text-xs text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>O envio automático está desativado. As mensagens não serão enviadas automaticamente no horário configurado.</span>
            </p>
          </div>
        )}
      </div>

      {/* Send Control Config */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined">settings</span>
          Controle de Envio
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delay entre mensagens (segundos)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={delayBetweenMessages}
              onChange={(e) => setDelayBetweenMessages(parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">Pausa entre cada envio</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tamanho do lote
            </label>
            <input
              type="number"
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">Mensagens por lote</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pausa entre lotes (segundos)
            </label>
            <input
              type="number"
              min="10"
              max="300"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={batchDelay}
              onChange={(e) => setBatchDelay(parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">Intervalo entre lotes</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Máximo de tentativas
            </label>
            <input
              type="number"
              min="1"
              max="5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={maxRetries}
              onChange={(e) => setMaxRetries(parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">Tentativas em caso de erro</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delay entre tentativas (segundos)
            </label>
            <input
              type="number"
              min="10"
              max="300"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={retryDelay}
              onChange={(e) => setRetryDelay(parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">Aguardar antes de retentar</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Limite por hora
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={maxMessagesPerHour}
              onChange={(e) => setMaxMessagesPerHour(parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">Máximo de mensagens/hora</p>
          </div>
        </div>
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            💡 <strong>Exemplo:</strong> Com {batchSize} mensagens por lote, delay de {delayBetweenMessages}s entre mensagens e {batchDelay}s entre lotes, 
            cada lote levará aproximadamente {Math.ceil((batchSize * delayBetweenMessages) / 60)} minuto(s) + {Math.ceil(batchDelay / 60)} minuto(s) de pausa.
          </p>
        </div>
      </div>

      {/* Calculation Config */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Cálculo de Valores</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Juros (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Multa (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={penaltyRate}
              onChange={(e) => setPenaltyRate(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor Base
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={baseValueType}
              onChange={(e) => setBaseValueType(e.target.value)}
            >
              <option value="valorbrutoparcela">Valor Bruto</option>
              <option value="valorfinalparcela">Valor Final</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Base para cálculo de juros e multa</p>
          </div>
        </div>
        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            Variáveis calculadas disponíveis para uso na mensagem: <br />
            <strong>{`{valorparcelavencida}`}</strong>: Total corrigido (Base + Juros + Multa) <br />
            <strong>{`{juros}`}</strong>: Valor calculado dos juros <br />
            <strong>{`{multa}`}</strong>: Valor calculado da multa <br />
            <strong>{`{valortotalcomjuros}`}</strong>: Soma de TODOS os débitos do cliente com juros e multa <br />
            <span className="opacity-75 mt-1 block">Cálculo: <em>Valor Base + (Valor Base * Juros%) + (Valor Base * Multa%)</em></span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reminder Config */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-500">notifications</span>
              Lembrete de Vencimento
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enableReminder}
                onChange={(e) => setEnableReminder(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className={`space-y-4 ${!enableReminder ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dias antes do vencimento
              </label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={daysBefore}
                onChange={(e) => setDaysBefore(parseInt(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Repetir quantas vezes
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={reminderRepeatTimes}
                  onChange={(e) => setReminderRepeatTimes(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Intervalo (dias)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={reminderRepeatInterval}
                  onChange={(e) => setReminderRepeatInterval(parseInt(e.target.value))}
                />
              </div>
            </div>

            {reminderRepeatTimes > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                <p className="text-xs text-yellow-800 dark:text-yellow-300">
                  💡 Esta mensagem será enviada <strong>{reminderRepeatTimes} {reminderRepeatTimes === 1 ? 'vez' : 'vezes'}</strong> com intervalo de <strong>{reminderRepeatInterval} dias</strong> antes do vencimento.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Modelo da Mensagem
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
              ></textarea>
            </div>
          </div>
        </div>

        {/* Overdue Config */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">warning</span>
              Cobrança de Atraso
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enableOverdue}
                onChange={(e) => setEnableOverdue(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className={`space-y-4 ${!enableOverdue ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dias após o vencimento
              </label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={daysAfter}
                onChange={(e) => setDaysAfter(parseInt(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Repetir quantas vezes
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={overdueRepeatTimes}
                  onChange={(e) => setOverdueRepeatTimes(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Intervalo (dias)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  value={overdueRepeatInterval}
                  onChange={(e) => setOverdueRepeatInterval(parseInt(e.target.value))}
                />
              </div>
            </div>

            {overdueRepeatTimes > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                <p className="text-xs text-red-800 dark:text-red-300">
                  💡 Esta mensagem será enviada <strong>{overdueRepeatTimes} {overdueRepeatTimes === 1 ? 'vez' : 'vezes'}</strong> com intervalo de <strong>{overdueRepeatInterval} dias</strong> após o vencimento.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Modelo da Mensagem
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={overdueMsg}
                onChange={(e) => setOverdueMsg(e.target.value)}
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      {/* Field Mappings Card - Moved to bottom and made more compact */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <span className="material-symbols-outlined">link</span>
              Mapeamento de Campos
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Vincule as variáveis das mensagens com os campos do banco SQL
            </p>
          </div>
          <button
            onClick={saveMappings}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors text-sm"
          >
            Salvar Mapeamento
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: items 1-8 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Campos 1-8</p>
            {fieldMappings.slice(0, 8).map((mapping, index) => (
              <div key={mapping.message_variable} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2.5 rounded">
                <span className="text-xs font-bold text-gray-400 w-6">{index + 1}.</span>
                <div className="flex-shrink-0 w-40">
                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {mapping.message_variable}
                  </span>
                </div>
                <span className="text-gray-400 text-xs">=</span>
                <select
                  value={mapping.database_column}
                  onChange={(e) => updateMapping(mapping.message_variable, e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {availableColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Right column: items 9-15 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Campos 9-17</p>
            {fieldMappings.slice(8).map((mapping, index) => (
              <div key={mapping.message_variable} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2.5 rounded">
                <span className="text-xs font-bold text-gray-400 w-6">{index + 9}.</span>
                <div className="flex-shrink-0 w-40">
                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {mapping.message_variable}
                  </span>
                </div>
                <span className="text-gray-400 text-xs">=</span>
                <select
                  value={mapping.database_column}
                  onChange={(e) => updateMapping(mapping.message_variable, e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {availableColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {fieldMappings.length === 0 && (
          <p className="text-center text-gray-500 py-8">Nenhum mapeamento configurado.</p>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={saveConfig}
          className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 transition-colors shadow-sm"
        >
          Salvar Alterações
        </button>
      </div>
    </div>
  );
};

export default MessageConfig;