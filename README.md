# Gerenciador de Cobranças

Sistema de gerenciamento de cobranças com interface web moderna e backend Node.js/Python.

## 🚀 Funcionalidades

- **Conexões de Banco de Dados**: Conecte-se a bancos SQL Server e execute queries
- **Gerenciamento de Mensagens**: Configure e envie mensagens personalizadas
- **Fila de Mensagens**: Visualize e gerencie a fila de mensagens
- **Logs do Sistema**: Monitore atividades e erros
- **Gerenciamento de Usuários**: Sistema completo de permissões e controle de acesso
- **Autenticação**: Login seguro com diferentes níveis de acesso (Admin/Usuário)

## 📋 Pré-requisitos

- Node.js (v16 ou superior)
- Python 3.x (para o backend alternativo)
- npm ou yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd gerenciador
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (opcional):
```bash
# Crie um arquivo .env.local se necessário
```

## 🏃 Como Executar

### Modo Desenvolvimento (Frontend + Backend)
```bash
npm run dev:full
```

Este comando inicia simultaneamente:
- Frontend (Vite) em `http://localhost:5173`
- Backend (Node.js) em `http://localhost:3001`

### Apenas Frontend
```bash
npm run dev
```

### Apenas Backend
```bash
npm run server
```

## 🏗️ Estrutura do Projeto

```
gerenciador/
├── pages/              # Páginas React
│   ├── Connections.tsx
│   ├── Messages.tsx
│   ├── Queue.tsx
│   ├── Logs.tsx
│   └── UserPermissions.tsx
├── server/             # Backend Node.js
│   ├── index.cjs
│   ├── db.cjs
│   └── database.sqlite
├── backend/            # Backend Python (alternativo)
│   ├── app.py
│   └── database.db
├── context/            # Context API do React
├── App.tsx             # Componente principal
└── index.tsx           # Entry point
```

## 👤 Usuários Padrão

- **Admin**: `admin` / `admin123`
- **Usuário**: `user` / `user123`

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Node.js, Express
- **Banco de Dados**: SQLite, SQL Server (via mssql)
- **Estilização**: CSS customizado
- **Roteamento**: React Router DOM

## 📝 Licença

Este projeto é privado.

## 🤝 Contribuindo

Para contribuir com este projeto, entre em contato com o administrador.
