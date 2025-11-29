import React, { useState, useEffect } from 'react';

const ConnectionSettings: React.FC = () => {
  const [isTestingSQL, setIsTestingSQL] = useState(false);
  const [isTestingWA, setIsTestingWA] = useState(false);
  const [isExecutingQuery, setIsExecutingQuery] = useState(false);
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // W-API State
  const [wapiInstanceId, setWapiInstanceId] = useState('');
  const [wapiToken, setWapiToken] = useState('');
  const [wapiTestPhone, setWapiTestPhone] = useState('');

  // Connection State
  const [sqlHost, setSqlHost] = useState('');
  const [sqlDb, setSqlDb] = useState('');
  const [sqlUser, setSqlUser] = useState('');
  const [sqlPass, setSqlPass] = useState('');

  // Query State
  const [queryText, setQueryText] = useState("SELECT * FROM clientes WHERE status = 'pendente'");
  const [savedQueries, setSavedQueries] = useState<any[]>([]);


  useEffect(() => {
    // Fetch saved connection
    fetch('http://localhost:3001/api/connection')
      .then(res => res.json())
      .then(data => {
        if (data.host) {
          setSqlHost(data.host);
          setSqlDb(data.database);
          setSqlUser(data.user);
          setSqlPass(data.password);
        }
      })
      .catch(err => console.error("Error fetching connection:", err));

    // Fetch saved queries
    fetch('http://localhost:3001/api/query/saved')
      .then(res => res.json())
      .then(data => {
        setSavedQueries(data || []);
        // Load the most recent query into the editor
        if (data && data.length > 0) {
          setQueryText(data[0].query_text);
        }
      })
      .catch(err => console.error("Error fetching saved queries:", err));

    // Fetch W-API configuration
    fetch('http://localhost:3001/api/wapi/config')
      .then(res => res.json())
      .then(data => {
        if (data.instance_id) {
          setWapiInstanceId(data.instance_id);
          setWapiToken(data.bearer_token);
        }
      })
      .catch(err => console.error("Error fetching W-API config:", err));
  }, []);

  const saveConnection = () => {
    setIsTestingSQL(true);
    fetch('http://localhost:3001/api/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: sqlHost,
        database: sqlDb,
        user: sqlUser,
        password: sqlPass
      })
    })
      .then(res => res.json())
      .then(() => {
        setIsTestingSQL(false);
        alert('Configurações salvas! (Teste real de conexão será feito ao executar query)');
      })
      .catch(err => {
        setIsTestingSQL(false);
        alert('Erro ao salvar: ' + err);
      });
  };

  const executeQuery = () => {
    setIsExecutingQuery(true);
    setQueryResults(null);
    setQueryError(null);

    // Save query first (optional, but requested)
    fetch('http://localhost:3001/api/query/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText })
    });

    // Execute
    fetch('http://localhost:3001/api/query/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
        return data;
      })
      .then(data => {
        setQueryResults(data);
        setIsExecutingQuery(false);
      })
      .catch(err => {
        setQueryError(err.message);
        setIsExecutingQuery(false);
      });
  };

  // Logic for dynamic table generation
  const headers = queryResults && queryResults.length > 0 ? Object.keys(queryResults[0]) : [];
  const displayData = queryResults ? queryResults.slice(0, 20) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Conexões & Testes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SQL Connection Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <span className="material-symbols-outlined">database</span>
            SQL Server
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host / Servidor</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="ex: localhost"
                value={sqlHost}
                onChange={(e) => setSqlHost(e.target.value)}
                type="text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banco de Dados</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Nome do banco"
                value={sqlDb}
                onChange={(e) => setSqlDb(e.target.value)}
                type="text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Usuário do banco"
                value={sqlUser}
                onChange={(e) => setSqlUser(e.target.value)}
                type="text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Senha do banco"
                value={sqlPass}
                onChange={(e) => setSqlPass(e.target.value)}
                type="password"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={saveConnection}
              disabled={isTestingSQL}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isTestingSQL ? 'Salvando...' : 'Salvar Configuração'}
            </button>
            <button
              onClick={() => {
                setIsTestingSQL(true);
                fetch('http://localhost:3001/api/connection/test', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    host: sqlHost,
                    database: sqlDb,
                    user: sqlUser,
                    password: sqlPass
                  })
                })
                  .then(res => res.json())
                  .then(data => {
                    setIsTestingSQL(false);
                    if (data.error) {
                      alert('Erro na conexão: ' + data.error);
                    } else {
                      alert('Conexão bem sucedida!');
                    }
                  })
                  .catch(err => {
                    setIsTestingSQL(false);
                    alert('Erro ao testar: ' + err);
                  });
              }}
              disabled={isTestingSQL}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
            >
              Testar
            </button>
          </div>
          <div className="mt-4 text-center">
            <a
              href="https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Baixar Driver ODBC para SQL Server
            </a>
          </div>
        </div>

        {/* WhatsApp API Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <span className="material-symbols-outlined">chat</span>
            WhatsApp API (W-API)
          </h2>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>URL da API: <strong>https://w-api.izy.one/</strong></span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instance ID</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Seu Instance ID"
                type="text"
                value={wapiInstanceId}
                onChange={(e) => setWapiInstanceId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bearer Token</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Seu token de autenticação"
                type="password"
                value={wapiToken}
                onChange={(e) => setWapiToken(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone para Teste (opcional)</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="5511999999999"
                type="text"
                value={wapiTestPhone}
                onChange={(e) => setWapiTestPhone(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Formato: código do país + DDD + número (sem espaços ou caracteres)</p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setIsTestingWA(true);
                fetch('http://localhost:3001/api/wapi/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    instance_id: wapiInstanceId,
                    bearer_token: wapiToken
                  })
                })
                  .then(res => res.json())
                  .then(() => {
                    setIsTestingWA(false);
                    alert('Configuração W-API salva com sucesso!');
                  })
                  .catch(err => {
                    setIsTestingWA(false);
                    alert('Erro ao salvar: ' + err);
                  });
              }}
              disabled={isTestingWA || !wapiInstanceId || !wapiToken}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isTestingWA ? 'Salvando...' : 'Salvar Configuração'}
            </button>
            <button
              onClick={() => {
                setIsTestingWA(true);
                fetch('http://localhost:3001/api/wapi/test', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    instance_id: wapiInstanceId,
                    bearer_token: wapiToken
                  })
                })
                  .then(res => res.json())
                  .then(data => {
                    setIsTestingWA(false);
                    if (data.success) {
                      alert('✅ ' + data.message);
                    } else {
                      alert('❌ Erro: ' + (data.error || 'Falha na conexão'));
                    }
                  })
                  .catch(err => {
                    setIsTestingWA(false);
                    alert('Erro ao testar: ' + err);
                  });
              }}
              disabled={isTestingWA || !wapiInstanceId || !wapiToken}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white disabled:opacity-50"
            >
              Testar
            </button>
          </div>
          <button
            onClick={() => {
              if (!wapiTestPhone) {
                alert('Por favor, insira um número de telefone para teste');
                return;
              }
              setIsTestingWA(true);
              fetch('http://localhost:3001/api/wapi/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  instance_id: wapiInstanceId,
                  bearer_token: wapiToken,
                  phone: wapiTestPhone,
                  message: 'Mensagem de teste do Gerenciador - W-API configurado com sucesso! 🎉'
                })
              })
                .then(res => res.json())
                .then(data => {
                  setIsTestingWA(false);
                  if (data.success) {
                    alert('✅ ' + data.message);
                  } else {
                    alert('❌ Erro: ' + (data.error || 'Falha ao enviar mensagem'));
                  }
                })
                .catch(err => {
                  setIsTestingWA(false);
                  alert('Erro ao enviar: ' + err);
                });
            }}
            disabled={isTestingWA || !wapiInstanceId || !wapiToken || !wapiTestPhone}
            className="w-full mt-3 px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Enviar Mensagem de Teste
          </button>
        </div>
      </div>

      {/* SQL Query Tool */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <span className="material-symbols-outlined">terminal</span>
          Console SQL
        </h2>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="relative">
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm min-h-[150px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="SELECT * FROM clientes WHERE status = 'pendente'"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
              ></textarea>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  fetch('http://localhost:3001/api/query/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: queryText })
                  })
                    .then(res => res.json())
                    .then(() => {
                      alert('Query salva com sucesso!');
                      // Refresh saved queries list
                      fetch('http://localhost:3001/api/query/saved')
                        .then(res => res.json())
                        .then(data => setSavedQueries(data || []));
                    })
                    .catch(err => {
                      alert('Erro ao salvar query: ' + err);
                    });
                }}
                className="bg-gray-100 text-gray-700 py-2 px-4 rounded hover:bg-gray-200 transition-colors border border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">bookmark_add</span>
                Salvar Query
              </button>
              <button
                onClick={executeQuery}
                disabled={isExecutingQuery}
                className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isExecutingQuery ? 'Executando...' : (
                  <>
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    Executar Query
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Saved Queries Sidebar */}
          {savedQueries.length > 0 && (
            <div className="w-full lg:w-72 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 p-4 flex flex-col max-h-[300px]">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Histórico</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {savedQueries.map((sq) => (
                  <div
                    key={sq.id}
                    onClick={() => setQueryText(sq.query_text)}
                    className="group p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded cursor-pointer hover:border-blue-500 relative"
                  >
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 line-clamp-2 mb-1">
                      {sq.query_text}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{new Date(sq.created_at).toLocaleDateString()}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Excluir esta query?')) {
                            fetch(`http://localhost:3001/api/query/saved/${sq.id}`, {
                              method: 'DELETE'
                            })
                              .then(() => {
                                fetch('http://localhost:3001/api/query/saved')
                                  .then(res => res.json())
                                  .then(data => setSavedQueries(data || []))
                                  .catch(err => console.error(err));
                              })
                              .catch(err => alert('Erro ao excluir: ' + err));
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {queryError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 flex items-start gap-2">
            <span className="material-symbols-outlined">error</span>
            <div>
              <p className="font-bold">Erro na execução</p>
              <p className="text-sm">{queryError}</p>
            </div>
          </div>
        )}

        {queryResults && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 dark:text-gray-200">
                Resultados ({queryResults.length})
              </h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Limitado a 20 registros
              </span>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-6 py-3 whitespace-nowrap font-semibold">
                          {header.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {displayData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                        {headers.map((header) => (
                          <td key={`${rowIndex}-${header}`} className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionSettings;