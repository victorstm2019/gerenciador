// Generate messages by date range
app.post('/api/queue/generate-by-date', async (req, res) => {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
    }

    try {
        // Get message configuration
        const config = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM message_config LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!config) {
            res.status(400).json({ error: "Configuração de mensagens não encontrada" });
            return;
        }

        // Get field mappings
        const mappings = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM field_mappings", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const fieldMap = {};
        mappings.forEach(m => {
            fieldMap[m.message_variable] = m.database_column;
        });

        // Get SQL connection config
        const connectionConfig = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM db_connections ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!connectionConfig) {
            res.status(400).json({ error: "Configuração de conexão SQL não encontrada" });
            return;
        }

        const sqlConfig = {
            user: connectionConfig.user,
            password: connectionConfig.password,
            server: connectionConfig.host,
            database: connectionConfig.database,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };

        let pool;

        try {
            pool = await sql.connect(sqlConfig);

            // Get saved query or use default
            const savedQuery = await new Promise((resolve, reject) => {
                db.get("SELECT query_text FROM saved_queries ORDER BY id DESC LIMIT 1", (err, row) => {
                    if (err) resolve(null);
                    else resolve(row ? row.query_text : null);
                });
            });

            const baseQuery = savedQuery || `
                SELECT
                    FC.Cliente__Codigo AS codigocliente,
                    C.Nome AS nomecliente,
                    C.CNPJ AS cpfcliente,
                    c.fone1 as fone1,
                    c.fone2 as fone2,
                    CONVERT(VARCHAR(10), FC.EMISSAO, 103) AS emissao,
                    CONVERT(VARCHAR(10), FC.VENCIMENTO, 103) AS vencimento,
                    FC.Valor AS valorbrutoparcela,
                    FC.Desconto AS desconto,
                    FC.Juros AS juros,
                    FC.Multa AS multa,
                    FC.Valor_Final AS valorfinalparcela,
                    SUM(FC.Valor_Final) OVER (PARTITION BY FC.Cliente__Codigo) AS valortotaldevido,
                    SUM(CASE WHEN FC.VENCIMENTO < CAST(GETDATE() AS DATE) THEN FC.Valor_Final ELSE 0 END) OVER (PARTITION BY FC.Cliente__Codigo) AS totalvencido,
                    FC.Descricao AS descricaoparcela
                FROM FINANCEIRO_CONTA FC
                LEFT JOIN Cli_For C ON FC.Cliente__Codigo = C.Codigo
                WHERE FC.PAGAR_RECEBER = 'R'
                  AND FC.SITUACAO = 'A'
                  AND FC.STATUS <> -1
                  AND FC.Cliente__Codigo <> 1
                  AND FC.Tipo = 'P'
            `;

            let cleanBaseQuery = baseQuery.trim();
            cleanBaseQuery = cleanBaseQuery.replace(/;+\s*$/g, '');
            cleanBaseQuery = cleanBaseQuery.replace(/ORDER\s+BY\s+[\w\.,\s]+$/i, '');

            // Convert Brazilian date format to ISO
            const parseDate = (dateStr) => {
                const [day, month, year] = dateStr.split('/');
                return `${year}-${month}-${day}`;
            };

            const finalQuery = `
                WITH BaseData AS (
                    ${cleanBaseQuery}
                )
                SELECT *
                FROM BaseData
                WHERE CONVERT(DATE, vencimento, 103) >= '${parseDate(startDate)}'
                AND CONVERT(DATE, vencimento, 103) <= '${parseDate(endDate)}'
                ORDER BY CONVERT(DATE, vencimento, 103) DESC
            `;

            const result = await pool.request().query(finalQuery);
            const clients = result.recordset;
            const template = config.overdue_msg;

            // Helper function to get value case-insensitive
            const getValue = (obj, key) => {
                if (obj[key] !== undefined) return obj[key];
                const lowerKey = key.toLowerCase();
                const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                return foundKey ? obj[foundKey] : undefined;
            };

            const messages = clients.map((client) => {
                let message = template;
                Object.keys(fieldMap).forEach(variable => {
                    const dbColumn = fieldMap[variable];
                    let value = getValue(client, dbColumn) || '';
                    if (typeof value === 'number' && (variable.includes('valor') || variable.includes('juros') || variable.includes('multa'))) {
                        value = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    } else if (value instanceof Date) {
                        value = value.toLocaleDateString('pt-BR');
                    } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                        const date = new Date(value);
                        value = date.toLocaleDateString('pt-BR');
                    }
                    message = message.replace(new RegExp(variable, 'g'), value);
                });

                const desc = getValue(client, 'descricaoparcela') || '';

                return {
                    id: getValue(client, 'codigocliente') || client.id,
                    code: getValue(client, 'codigocliente'),
                    clientName: getValue(client, 'nomecliente'),
                    cpf: getValue(client, 'cpfcliente'),
                    dueDate: getValue(client, 'vencimento'),
                    emissionDate: getValue(client, 'emissao'),
                    value: getValue(client, 'valorfinalparcela') || getValue(client, 'valorbrutoparcela') || 0,
                    installmentValue: getValue(client, 'valorfinalparcela') || getValue(client, 'valorbrutoparcela') || 0,
                    messageContent: message,
                    messageType: 'overdue',
                    status: 'PREVIEW',
                    phone: getValue(client, 'fone1') || '',
                    description: desc
                };
            });

            res.json(messages);

        } finally {
            if (pool) {
                await pool.close();
            }
        }

    } catch (error) {
        console.error("Error generating messages by date:", error);
        res.status(500).json({ error: error.message || "Erro ao gerar mensagens por data" });
    }
});
