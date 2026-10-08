<#
.SYNOPSIS
    Dispara o deploy/atualização do Comunica na VPS via SSH.

.DESCRIPTION
    Conecta na VPS por SSH e executa o update.sh dentro do diretório do projeto.
    O update.sh é quem faz: git fetch + reset para origin/main, npm install (se
    preciso) e pm2 restart do processo.

.PARAMETER Vps
    Host ou alias SSH da VPS. Padrão: srv1285015

.PARAMETER User
    Usuário SSH. Padrão: root

.PARAMETER AppPath
    Caminho do projeto na VPS.
    Padrão: /home/buscamais-comunica/htdocs/comunica.buscamais.org

.PARAMETER AppName
    Nome do processo PM2 (opcional). Se informado, força COMUNICA_APP_NAME.

.EXAMPLE
    .\deploy.ps1

.EXAMPLE
    .\deploy.ps1 -Vps 1.2.3.4 -User root -AppName comunica
#>
param(
    [string]$Vps      = "srv1285015",
    [string]$User     = "root",
    [string]$AppPath  = "/home/buscamais-comunica/htdocs/comunica.buscamais.org",
    [string]$AppName  = ""
)

$ErrorActionPreference = "Stop"

function Write-Info  { param($m) Write-Host "  ->  $m" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host "  !   $m" -ForegroundColor Yellow }
function Write-Fail  { param($m) Write-Host "  X   $m" -ForegroundColor Red }

Write-Host ""
Write-Host "  Comunica - Deploy na VPS" -ForegroundColor Cyan
Write-Host "  Host: $User@$Vps"
Write-Host "  Path: $AppPath"
Write-Host ""

# ── Verifica se o cliente SSH existe ──────────────────────────────────────────
$ssh = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $ssh) {
    Write-Fail "Cliente 'ssh' não encontrado. Instale o OpenSSH Client do Windows"
    Write-Host "        (Configurações > Apps > Recursos opcionais > OpenSSH Client)."
    exit 1
}

$target = "$User@$Vps"

# ── Monta o comando remoto ────────────────────────────────────────────────────
$appEnv = if ($AppName) { "COMUNICA_APP_NAME='$AppName' " } else { "" }
$remoteCmd = "cd '$AppPath' && ${appEnv}bash update.sh"

# ── Testa conexão SSH ─────────────────────────────────────────────────────────
Write-Info "Testando conexão SSH..."
& ssh -o ConnectTimeout=10 -o BatchMode=no "$target" "echo ok" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Não foi possível conectar em $target."
    Write-Host "        Verifique a chave SSH (ou use -User correto) e tente de novo."
    Write-Host "        Teste manualmente: ssh $target"
    exit 1
}
Write-Ok "Conexão estabelecida."
Write-Host ""

# ── Executa o update.sh na VPS (com TTY, pois o script pode pedir confirmação) ─
Write-Info "Executando update.sh na VPS..."
Write-Host ""
& ssh -t "$target" $remoteCmd
$code = $LASTEXITCODE
Write-Host ""

if ($code -eq 0) {
    Write-Ok "Deploy concluído com sucesso."
} else {
    Write-Fail "O update.sh terminou com código $code. Veja a saída acima."
    Write-Host "        Para investigar: ssh $target 'pm2 logs comunica --lines 50'"
    exit $code
}
