const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

/**
 * Wrapper para sql.js que emula a API do sqlite3 e better-sqlite3
 * Permite migração transparente sem alterar código existente
 */
class SqlJsDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this.SQL = null;
        this.isInitialized = false;
    }

    /**
     * Inicializa o banco de dados (carrega arquivo ou cria novo)
     */
    async init() {
        if (this.isInitialized) return;

        // Sistema simples de log em arquivo para debug em produção
        const logFile = path.resolve(path.dirname(this.dbPath), 'debug-startup.log');
        const log = (msg) => {
            const time = new Date().toISOString();
            try {
                fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
            } catch (e) { }
            console.log(msg);
        };

        try {
            log('[SQL.js] Iniciando carregamento...');

            const isPkg = typeof process.pkg !== 'undefined';
            // Prefer path passed by Electron
            const resourcesPath = process.env.ELECTRON_RESOURCES_PATH ||
                (process.versions.electron ? process.resourcesPath : path.join(__dirname, '..'));

            const wasmPath = path.join(resourcesPath, 'assets', 'sql-wasm.wasm');
            log(`[SQL.js] Procurando WASM em: ${wasmPath}`);
            log(`[SQL.js] Arquivo existe? ${fs.existsSync(wasmPath)}`);

            // Inicializar sql.js com localização explícita do WASM
            const config = {
                locateFile: (filename) => {
                    log(`[SQL.js] locateFile solicitado: ${filename}`);
                    if (filename.endsWith('.wasm')) {
                        return wasmPath;
                    }
                    return filename;
                }
            };

            // Precisamos carregar o binário do wasm manualmente se estivermos no node
            if (fs.existsSync(wasmPath)) {
                config.wasmBinary = fs.readFileSync(wasmPath);
                log('[SQL.js] wasmBinary carregado manualmente do disco');
            }

            this.SQL = await initSqlJs(config);
            log('[SQL.js] Biblioteca inicializada com sucesso');

            // Verificar se arquivo existe
            if (fs.existsSync(this.dbPath)) {
                log(`[SQL.js] Carregando banco de: ${this.dbPath}`);
                const buffer = fs.readFileSync(this.dbPath);
                this.db = new this.SQL.Database(buffer);
                log('[SQL.js] Banco carregado com sucesso');
            } else {
                log('[SQL.js] Criando novo banco vazio');
                this.db = new this.SQL.Database();
                this.save(); // Salvar imediatamente para criar o arquivo
                log(`[SQL.js] Novo banco criado e salvo em: ${this.dbPath}`);
            }

            this.isInitialized = true;
        } catch (error) {
            const errSettings = {
                message: error.message,
                stack: error.stack
            };
            log(`[SQL.js] CRITICAL ERROR: ${JSON.stringify(errSettings)}`);
            console.error('[SQL.js] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Salva o banco de dados no arquivo de forma atômica (Seguro contra falhas)
     * Implementa retry logic para lidar com problemas de permissão no Windows
     */
    save() {
        if (!this.db) return;

        const tempPath = this.dbPath + '.tmp';
        const maxRetries = 5;
        const retryDelay = 100; // ms

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const data = this.db.export();
                const buffer = Buffer.from(data);

                // 1. Escreve no arquivo temporário
                fs.writeFileSync(tempPath, buffer);

                // 2. Garante que os dados foram gravados fisicamente no disco (Flush)
                const fd = fs.openSync(tempPath, 'r+');
                fs.fsyncSync(fd);
                fs.closeSync(fd);

                // 3. Tenta renomear de forma atômica
                try {
                    // No Windows, precisamos remover o arquivo de destino primeiro se existir
                    if (fs.existsSync(this.dbPath)) {
                        // Tenta remover o arquivo antigo
                        try {
                            fs.unlinkSync(this.dbPath);
                        } catch (unlinkError) {
                            // Se não conseguir remover, tenta backup
                            const backupPath = this.dbPath + '.backup';
                            try {
                                if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
                                fs.renameSync(this.dbPath, backupPath);
                            } catch (backupError) {
                                // Ignora erro de backup, tenta continuar
                            }
                        }
                    }

                    // Agora tenta renomear
                    fs.renameSync(tempPath, this.dbPath);

                    // Sucesso! Remove backup se existir
                    const backupPath = this.dbPath + '.backup';
                    if (fs.existsSync(backupPath)) {
                        try {
                            fs.unlinkSync(backupPath);
                        } catch (e) { }
                    }

                    return; // Salvamento bem-sucedido
                } catch (renameError) {
                    if (renameError.code === 'EPERM' && attempt < maxRetries - 1) {
                        // Espera um pouco antes de tentar novamente
                        const delay = retryDelay * Math.pow(2, attempt);
                        const start = Date.now();
                        while (Date.now() - start < delay) {
                            // Busy wait (sync)
                        }
                        continue; // Tenta novamente
                    }
                    throw renameError;
                }
            } catch (error) {
                if (attempt === maxRetries - 1) {
                    // Última tentativa falhou
                    console.error('[SQL.js] Save error após múltiplas tentativas:', error);
                    console.error('[SQL.js] Tentando salvamento direto como fallback...');

                    // Fallback: salva diretamente (menos seguro, mas funciona)
                    try {
                        const data = this.db.export();
                        const buffer = Buffer.from(data);
                        fs.writeFileSync(this.dbPath, buffer);
                        console.log('[SQL.js] Salvamento direto bem-sucedido');
                    } catch (fallbackError) {
                        console.error('[SQL.js] Fallback também falhou:', fallbackError);
                    }
                }

                // Tenta limpar o arquivo temporário
                try {
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                } catch (e) { }
            }
        }
    }

    /**
     * Executa query e retorna UMA linha (compatível com sqlite3)
     * @param {string} sql - Query SQL
     * @param {Array|Function} params - Parâmetros ou callback
     * @param {Function} callback - Callback (err, row)
     */
    get(sql, params, callback) {
        // Suportar chamada sem parâmetros: db.get(sql, callback)
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        if (params && Array.isArray(params)) params = params.map(p => p === undefined ? null : p);

        if (!this.isInitialized) {
            return callback(new Error('Database not initialized'));
        }

        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params || []);

            let row = null;
            if (stmt.step()) {
                const columns = stmt.getColumnNames();
                row = {};
                columns.forEach((col, idx) => {
                    row[col] = stmt.get()[idx];
                });
            }

            stmt.free();
            callback(null, row);
        } catch (error) {
            callback(error);
        }
    }

    /**
     * Executa query e retorna TODAS as linhas (compatível com sqlite3)
     * @param {string} sql - Query SQL
     * @param {Array|Function} params - Parâmetros ou callback
     * @param {Function} callback - Callback (err, rows)
     */
    all(sql, params, callback) {
        // Suportar chamada sem parâmetros: db.all(sql, callback)
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        if (params && Array.isArray(params)) params = params.map(p => p === undefined ? null : p);

        if (!this.isInitialized) {
            return callback(new Error('Database not initialized'));
        }

        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params || []);

            const rows = [];
            const columns = stmt.getColumnNames();

            while (stmt.step()) {
                const row = {};
                const values = stmt.get();
                columns.forEach((col, idx) => {
                    row[col] = values[idx];
                });
                rows.push(row);
            }

            stmt.free();
            callback(null, rows);
        } catch (error) {
            callback(error);
        }
    }

    /**
     * Executa query de escrita (INSERT, UPDATE, DELETE)
     * @param {string} sql - Query SQL
     * @param {Array|Function} params - Parâmetros ou callback
     * @param {Function} callback - Callback (err) com this.changes e this.lastID
     */
    run(sql, params, callback) {
        // Suportar chamada sem parâmetros: db.run(sql, callback)
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        // Sanitize params: replace undefined with null
        if (params && Array.isArray(params)) {
            params = params.map(p => p === undefined ? null : p);
        }

        if (!this.isInitialized) {
            if (callback) return callback(new Error('Database not initialized'));
            return;
        }

        try {
            this.db.run(sql, params || []);

            // Salvar após cada escrita
            this.save();

            // Obter informações sobre a operação
            const changes = this.db.getRowsModified();
            const lastID = this.db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] || 0;

            // Criar contexto compatível com sqlite3
            const context = {
                changes: changes,
                lastID: lastID
            };

            if (callback) {
                callback.call(context, null);
            }
        } catch (error) {
            if (callback) {
                callback(error);
            } else {
                console.error('[SQL.js] Run error:', error);
            }
        }
    }

    /**
     * Prepara statement (compatível com better-sqlite3)
     * Retorna objeto com métodos get() e all() síncronos
     */
    prepare(sql) {
        const self = this;

        return {
            get: (params) => {
                if (!self.isInitialized) {
                    throw new Error('Database not initialized');
                }

                try {
                    const stmt = self.db.prepare(sql);
                    stmt.bind(params || []);

                    let row = null;
                    if (stmt.step()) {
                        const columns = stmt.getColumnNames();
                        row = {};
                        columns.forEach((col, idx) => {
                            row[col] = stmt.get()[idx];
                        });
                    }

                    stmt.free();
                    return row;
                } catch (error) {
                    console.error('[SQL.js] Prepare.get error:', error);
                    throw error;
                }
            },

            all: (params) => {
                if (!self.isInitialized) {
                    throw new Error('Database not initialized');
                }

                try {
                    const stmt = self.db.prepare(sql);
                    stmt.bind(params || []);

                    const rows = [];
                    const columns = stmt.getColumnNames();

                    while (stmt.step()) {
                        const row = {};
                        const values = stmt.get();
                        columns.forEach((col, idx) => {
                            row[col] = values[idx];
                        });
                        rows.push(row);
                    }

                    stmt.free();
                    return rows;
                } catch (error) {
                    console.error('[SQL.js] Prepare.all error:', error);
                    throw error;
                }
            },

            run: (params) => {
                if (!self.isInitialized) {
                    throw new Error('Database not initialized');
                }

                try {
                    if (params && Array.isArray(params)) params = params.map(p => p === undefined ? null : p);
                    self.db.run(sql, params || []);
                    self.save();

                    const changes = self.db.getRowsModified();
                    const lastID = self.db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] || 0;

                    return { changes, lastID };
                } catch (error) {
                    console.error('[SQL.js] Prepare.run error:', error);
                    throw error;
                }
            },

            finalize: () => {
                // No-op para compatibilidade
            }
        };
    }

    /**
     * Executa múltiplas queries em série (compatível com sqlite3)
     */
    serialize(callback) {
        if (!this.isInitialized) {
            console.warn('[SQL.js] serialize() called before init()');
        }
        // Em sql.js tudo já é serializado, apenas executar callback
        if (callback) callback();
    }

    /**
     * Fecha o banco de dados
     */
    close(callback) {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
        if (callback) callback(null);
    }
}

module.exports = SqlJsDatabase;
