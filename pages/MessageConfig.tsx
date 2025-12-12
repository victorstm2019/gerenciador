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
  const [interestRate, setInterestRate] = useState(0);
  const [penaltyRate, setPenaltyRate] = useState(0);
  const [baseValueType, setBaseValueType] = useState('valorbrutoparcela');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

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
      base_value_type: baseValueType
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Modo Fila</h2>
          <div className="flex items-center gap-8">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoSendMessages} onChange={(e) => setAutoSendMessages(e.target.checked)} />
              <span>Envio Automático</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoSendEnabled} onChange={(e) => setAutoSendEnabled(e.target.checked)} />
              <span>Modo Fila</span>
            </label>
          </div>
        </div>
        
        <div className="w-full max-w-xs">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Horário de Geração
          </label>
          <input
            type="time"
            className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            disabled={!autoSendEnabled}
          />
          <p className="text-xs text-gray-500 mt-1">Horário diário para gerar mensagens automaticamente</p>
        </div>
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
