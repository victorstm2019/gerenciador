import React, { useState, useEffect } from 'react';

const MessageConfig: React.FC = () => {
  const [sendTime, setSendTime] = useState('09:00');
  const [reminderMsg, setReminderMsg] = useState('Olá {cliente}, sua fatura vence hoje. Link: {link}');
  const [overdueMsg, setOverdueMsg] = useState('Olá {cliente}, sua fatura venceu em {vencimento}. Link: {link}');
  const [daysBefore, setDaysBefore] = useState(1);
  const [daysAfter, setDaysAfter] = useState(1);
  const [enableReminder, setEnableReminder] = useState(true);
  const [enableOverdue, setEnableOverdue] = useState(true);
  const [reminderRepeatTimes, setReminderRepeatTimes] = useState(1);
  const [reminderRepeatInterval, setReminderRepeatInterval] = useState(3);
  const [overdueRepeatTimes, setOverdueRepeatTimes] = useState(1);
  const [overdueRepeatInterval, setOverdueRepeatInterval] = useState(7);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSendTime(data.send_time || '09:00');
          setReminderMsg(data.reminder_msg || '');
          setOverdueMsg(data.overdue_msg || '');
          setDaysBefore(data.reminder_days || 1);
          setDaysAfter(data.overdue_days || 1);
          setEnableReminder(data.reminder_enabled ?? true);
          setEnableOverdue(data.overdue_enabled ?? true);
          setReminderRepeatTimes(data.reminder_repeat_times || 1);
          setReminderRepeatInterval(data.reminder_repeat_interval_days || 3);
          setOverdueRepeatTimes(data.overdue_repeat_times || 1);
          setOverdueRepeatInterval(data.overdue_repeat_interval_days || 7);
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
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        send_time: sendTime,
        reminder_msg: reminderMsg,
        reminder_enabled: enableReminder,
        reminder_days: daysBefore,
        reminder_repeat_times: reminderRepeatTimes,
        reminder_repeat_interval_days: reminderRepeatInterval,
        overdue_msg: overdueMsg,
        overdue_enabled: enableOverdue,
        overdue_days: daysAfter,
        overdue_repeat_times: overdueRepeatTimes,
        overdue_repeat_interval_days: overdueRepeatInterval
      })
    })
      .then(res => res.json())
      .then(() => {
        setIsLoading(false);
        alert('Configurações salvas!');
      })
      .catch(err => {
        setIsLoading(false);
        alert('Erro ao salvar: ' + err);
      });
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
        <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Agendamento Geral</h2>
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
            />
            <p className="text-xs text-gray-500 mt-1">Horário diário para processamento da fila</p>
          </div>
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

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">Variáveis Disponíveis</h3>
        <div className="flex flex-wrap gap-2">
          {[
            '@codigocliente',
            '@nomecliente',
            '@cpfcliente',
            '@valorparcela',
            '@vencimentoparcela',
            '@valortotaldevido',
            '@cnpjemitente',
            '@razaoemitente',
            '@foneemitente'
          ].map(v => (
            <span key={v} className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Clique para copiar" onClick={() => navigator.clipboard.writeText(v)}>
              {v}
            </span>
          ))}
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
