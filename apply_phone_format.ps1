# Script para adicionar formatação de telefone de forma segura
$file = "c:\gerenciador\pages\QueueHistory.tsx"
$content = Get-Content $file -Raw

# Backup
Copy-Item $file "$file.bak"

# Mudança 1: Adicionar import
$content = $content -replace "import { api } from '../services/api';", "import { api } from '../services/api';`nimport { formatPhoneDisplay } from '../utils/phoneFormatter';"

# Mudança 2: Usar a função (procura exatamente o padrão)
$content = $content -replace '\{item\.phone \|\| ''-''\}', '{formatPhoneDisplay(item.phone)}'

# Salvar
$content | Set-Content $file -NoNewline

Write-Host "Mudanças aplicadas com sucesso!" -ForegroundColor Green
Write-Host "Backup salvo em: $file.bak" -ForegroundColor Yellow
