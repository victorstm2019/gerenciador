# Como Gerar o Executável Portátil do Gerenciador

## Pré-requisitos

- Node.js instalado (versão 18 ou superior)
- NPM instalado

## Passo a Passo

### 1. Instalar Dependências

```bash
cd c:\gerenciador
npm install
```

### 2. Gerar o Executável

```bash
npm run build:portable
```

Este comando faz automaticamente:
1. Cria o template do banco (`assets/template.sqlite`) sem dados sensíveis do W-API
2. Compila o frontend (Vite build)
3. Empacota tudo em um executável portátil

### 3. Localizar o Executável

O arquivo `Gerenciador.exe` estará em:
```
c:\gerenciador\release\Gerenciador.exe
```

## Como Usar o Executável

1. Copie `Gerenciador.exe` para qualquer pasta no Windows
2. Execute o arquivo
3. O banco de dados (`database.sqlite`) será criado automaticamente **na mesma pasta** do exe
4. O aplicativo abrirá no navegador e um ícone aparecerá na bandeja do sistema

## Arquivos Gerados na Pasta do EXE

- `database.sqlite` - Banco de dados local
- `app-debug.log` - Log de inicialização (para diagnóstico)

## Notas Importantes

- O executável é **portátil**: pode ser movido para qualquer pasta ou pendrive
- Os dados ficam salvos na **mesma pasta** do exe, não em AppData
- A configuração W-API vem vazia no template (segurança)
- As credenciais de usuário do banco original são preservadas
