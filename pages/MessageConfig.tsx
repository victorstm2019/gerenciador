import React, { useState, useEffect } from 'react';

const MessageConfig: React.FC = () => {
  const [sendTime, setSendTime] = useState('09:00');
  const [reminderMsg, setReminderMsg] = useState('Olá {cliente}, sua fatura vence hoje. Link: {link}');
  const [overdueMsg, setOverdueMsg] = useState('Olá {cliente}, sua fatura venceu em {vencimento}. Link: {link}');
  const [daysBefore, setDaysBefore] = useState(1);
  const [daysAfter, setDaysAfter] = useState(1);
  const [enableReminder, setEnableReminder] = useState(true);
  const [enableOverdue, setEnableOverdue] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch('http://localhost:3001/api/config/messages')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSendTime(data.send_time || '09:00');
          setReminderMsg(data.reminder_msg || '');
          setOverdueMsg(data.overdue_msg || '');
          setDaysBefore(data.days_before || 1);
          setDaysAfter(data.days_after || 1);
          setEnableReminder(data.enable_reminder ?? true);
          setEnableOverdue(data.enable_overdue ?? true);
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
    fetch('http://localhost:3001/api/config/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        send_time: sendTime,
        reminder_msg: reminderMsg,
        overdue_msg: overdueMsg,
        days_before: daysBefore,
        days_after: daysAfter,
        enable_reminder: enableReminder,
        enable_overdue: enableOverdue
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
