import sqlite3
import os
import pyodbc
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Message Config Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS message_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            send_time TEXT DEFAULT '09:00',
            reminder_enabled INTEGER DEFAULT 1,
            reminder_days INTEGER DEFAULT 5,
            reminder_msg TEXT,
            overdue_enabled INTEGER DEFAULT 1,
            overdue_days INTEGER DEFAULT 3,
            overdue_msg TEXT
        )
    ''')
    
    # Queue Items Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS queue_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT,
            installment_value TEXT,
            due_date TEXT,
            scheduled_date TEXT,
            sent_date TEXT,
            error_date TEXT,
            code TEXT,
            cpf TEXT,
            status TEXT
        )
    ''')
    
    # Blocked Clients Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blocked_clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT UNIQUE,
            client_name TEXT,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Saved Connections Table (SQL Server)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS db_connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            host TEXT,
            database TEXT,
            user TEXT,
            password TEXT,
            active INTEGER DEFAULT 1
        )
    ''')

    # Saved Queries Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saved_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            query_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Seed Config
    cursor.execute("SELECT count(*) FROM message_config")
    if cursor.fetchone()[0] == 0:
        default_reminder = "Olá, @nomecliente! Passando para lembrar que sua fatura no valor de R$ @valorparcela vence em @vencimentoparcela. 😊"
        default_overdue = "Olá, @nomecliente. Identificamos que sua fatura de R$ @valorparcela, vencida em @vencimentoparcela, ainda está em aberto. Por favor, regularize sua situação. O valor total devido é R$ @valortotaldevido."
        cursor.execute("INSERT INTO message_config (send_time, reminder_days, reminder_msg, overdue_days, overdue_msg) VALUES (?, ?, ?, ?, ?)",
                       ('09:00', 5, default_reminder, 3, default_overdue))
        print("Default config inserted.")

    # Seed Queue (Demo)
    cursor.execute("SELECT count(*) FROM queue_items")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO queue_items (client_name, installment_value, due_date, scheduled_date, sent_date, error_date, code, cpf, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       ('Ana Silva', '150,00', '30/10/2023', '25/10/2023 10:00', None, None, '10234', '123.***.***-00', 'PENDING'))
        cursor.execute("INSERT INTO queue_items (client_name, installment_value, due_date, scheduled_date, sent_date, error_date, code, cpf, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       ('Carlos Pereira', '250,50', '20/10/2023', None, '24/10/2023 15:30', None, '10235', '987.***.***-00', 'SENT'))
        print("Default queue items inserted.")

    conn.commit()
    conn.close()

# Initialize DB on start
init_db()

# --- API Endpoints ---

@app.route('/api/config', methods=['GET'])
def get_config():
    conn = get_db_connection()
    config = conn.execute('SELECT * FROM message_config LIMIT 1').fetchone()
    conn.close()
    if config:
        return jsonify(dict(config))
    return jsonify({})

@app.route('/api/config', methods=['POST'])
def update_config():
    data = request.json
    conn = get_db_connection()
    conn.execute('''
        UPDATE message_config SET 
        send_time = ?, reminder_enabled = ?, reminder_days = ?, reminder_msg = ?,
        overdue_enabled = ?, overdue_days = ?, overdue_msg = ?
        WHERE id = 1
    ''', (data.get('send_time'), data.get('reminder_enabled'), data.get('reminder_days'), data.get('reminder_msg'),
          data.get('overdue_enabled'), data.get('overdue_days'), data.get('overdue_msg')))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Config updated'})

@app.route('/api/queue', methods=['GET'])
def get_queue():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM queue_items ORDER BY id DESC').fetchall()
    conn.close()
    
    # Map snake_case to camelCase
    result = []
    for row in rows:
        result.append({
            'id': str(row['id']),
            'clientName': row['client_name'],
            'installmentValue': row['installment_value'],
            'dueDate': row['due_date'],
            'scheduledDate': row['scheduled_date'],
            'sentDate': row['sent_date'],
            'errorDate': row['error_date'],
            'code': row['code'],
            'cpf': row['cpf'],
            'status': row['status']
        })
    return jsonify(result)

@app.route('/api/blocked', methods=['GET'])
def get_blocked():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM blocked_clients ORDER BY created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/blocked', methods=['POST'])
def add_blocked():
    data = request.json
    conn = get_db_connection()
    cursor = conn.execute('INSERT INTO blocked_clients (identifier, client_name, reason) VALUES (?, ?, ?)',
                          (data['identifier'], data['client_name'], data['reason']))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': new_id, 'identifier': data['identifier'], 'client_name': data['client_name'], 'reason': data['reason']})

@app.route('/api/blocked/<int:id>', methods=['DELETE'])
def delete_blocked(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM blocked_clients WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Deleted'})

# --- SQL Server & Connection API ---

@app.route('/api/connection', methods=['GET'])
def get_connection():
    conn = get_db_connection()
    row = conn.execute('SELECT * FROM db_connections ORDER BY id DESC LIMIT 1').fetchone()
    conn.close()
    if row:
        # Don't send password back in plain text ideally, but for prototype ok
        return jsonify(dict(row))
    return jsonify({})

@app.route('/api/connection', methods=['POST'])
def save_connection():
    data = request.json
    conn = get_db_connection()
    # Simple logic: just insert new one as active
    conn.execute('INSERT INTO db_connections (host, database, user, password) VALUES (?, ?, ?, ?)',
                 (data['host'], data['database'], data['user'], data['password']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Connection saved'})

@app.route('/api/query/save', methods=['POST'])
def save_query():
    data = request.json
    conn = get_db_connection()
    conn.execute('INSERT INTO saved_queries (name, query_text) VALUES (?, ?)',
                 ('Last Query', data['query']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Query saved'})

@app.route('/api/query/execute', methods=['POST'])
def execute_query():
    data = request.json
    query = data.get('query')
    
    # Get credentials
    conn_local = get_db_connection()
    creds = conn_local.execute('SELECT * FROM db_connections ORDER BY id DESC LIMIT 1').fetchone()
    conn_local.close()

    if not creds:
        return jsonify({'error': 'No database connection configured'}), 400

    # Connect to SQL Server
    try:
        connection_string = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={creds['host']};DATABASE={creds['database']};UID={creds['user']};PWD={creds['password']}"
        # Fallback drivers if 17 not present
        # connection_string = f"DRIVER={{SQL Server}};SERVER={creds['host']};DATABASE={creds['database']};UID={creds['user']};PWD={creds['password']}"
        
        # We try a generic approach or let pyodbc fail
        # Ideally we check drivers: pyodbc.drivers()
        
        drivers = pyodbc.drivers()
        driver_name = next((d for d in drivers if 'SQL Server' in d), None)
        if not driver_name:
             return jsonify({'error': 'No SQL Server ODBC Driver found on server'}), 500
        
        connection_string = f"DRIVER={{{driver_name}}};SERVER={creds['host']};DATABASE={creds['database']};UID={creds['user']};PWD={creds['password']}"

        sql_conn = pyodbc.connect(connection_string, timeout=5)
        cursor = sql_conn.cursor()
        cursor.execute(query)
        
        # Fetch results
        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append(dict(zip(columns, row)))
            
        sql_conn.close()
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3001, debug=True)
