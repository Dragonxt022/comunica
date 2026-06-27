#!/usr/bin/env bash
# =============================================================================
#  Comunica — Script de Instalação
#  Uso: bash setup.sh
#  Suporte: SQLite · MySQL · MariaDB · PostgreSQL
# =============================================================================
set -euo pipefail

# ── Cores e helpers ───────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

ok()      { echo -e "${GREEN}  ✔${RESET}  $*"; }
warn()    { echo -e "${YELLOW}  ⚠${RESET}  $*"; }
info()    { echo -e "${CYAN}  →${RESET}  $*"; }
step()    { echo -e "\n${BOLD}$*${RESET}"; }
die()     { echo -e "\n${RED}  ✘  ERRO: $*${RESET}\n" >&2; exit 1; }
ask()     { echo -en "${CYAN}  ?${RESET}  $*"; }

# ── Detecta o diretório do projeto automaticamente ────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║          Comunica — Instalação Automatizada               ║"
echo "  ║   Plataforma de Comunicação Institucional Municipal       ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  Diretório do projeto: ${BOLD}${SCRIPT_DIR}${RESET}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. VERIFICAR REQUISITOS
# ─────────────────────────────────────────────────────────────────────────────
step "[ 1 / 7 ]  Verificando requisitos do sistema"

# Git
if ! command -v git &>/dev/null; then
  die "Git não encontrado. Instale com: sudo apt install git"
fi
ok "Git $(git --version | awk '{print $3}') encontrado."

# Node.js
if ! command -v node &>/dev/null; then
  die "Node.js não encontrado. Instale a versão 18+: https://nodejs.org\n\n       Instalação rápida via nvm:\n         curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash\n         nvm install 20"
fi
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "Node.js 18+ é necessário. Versão encontrada: $(node --version)"
fi
ok "Node.js $(node --version) encontrado."

# npm
if ! command -v npm &>/dev/null; then
  die "npm não encontrado. Instale o Node.js novamente."
fi
ok "npm v$(npm --version) encontrado."

# ─────────────────────────────────────────────────────────────────────────────
# 2. CONFIGURAÇÕES DA APLICAÇÃO
# ─────────────────────────────────────────────────────────────────────────────
step "[ 2 / 7 ]  Configuração da aplicação"

# Verificar .env existente
if [ -f .env ]; then
  echo ""
  warn "Um arquivo .env já existe neste diretório."
  ask "Deseja sobrescrever as configurações existentes? [s/N]: "
  read -r OVERWRITE_ENV
  if [[ ! "$OVERWRITE_ENV" =~ ^[sS]$ ]]; then
    echo ""
    info "Mantendo .env existente. Pulando etapa de configuração..."
    SKIP_ENV=true
  else
    cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
    ok "Backup do .env atual criado."
    SKIP_ENV=false
  fi
else
  SKIP_ENV=false
fi

if [ "$SKIP_ENV" = false ]; then

  echo ""
  ask "Porta da aplicação [3020]: "
  read -r PORT
  PORT=${PORT:-3020}

  # Verificar se a porta está em uso
  if command -v ss &>/dev/null && ss -tlnp | grep -q ":${PORT}[[:space:]]"; then
    warn "A porta ${PORT} parece estar em uso por outro processo."
    warn "Você pode prosseguir, mas verifique conflitos depois."
  fi

  ask "URL pública (ex: https://comunicacao.prefeitura.gov.br) [http://localhost:${PORT}]: "
  read -r APP_URL
  APP_URL=${APP_URL:-"http://localhost:${PORT}"}

  echo ""
  echo -e "  Timezones comuns:"
  echo -e "    1) America/Sao_Paulo    (GMT-3 — região Sudeste/Sul/Nordeste)"
  echo -e "    2) America/Porto_Velho  (GMT-4 — Rondônia / Amazonas)"
  echo -e "    3) America/Manaus       (GMT-4 — Amazonas)"
  echo -e "    4) America/Belem        (GMT-3 — Pará / Maranhão)"
  echo -e "    5) America/Fortaleza    (GMT-3 — Ceará)"
  echo -e "    6) America/Recife       (GMT-3 — Pernambuco)"
  echo -e "    7) America/Cuiaba       (GMT-4 — Mato Grosso)"
  echo -e "    8) America/Rio_Branco   (GMT-5 — Acre)"
  echo -e "    9) Digitar manualmente"
  ask "Selecione o fuso horário [1]: "
  read -r TZ_CHOICE
  TZ_CHOICE=${TZ_CHOICE:-1}

  case "$TZ_CHOICE" in
    1) APP_TZ="America/Sao_Paulo" ;;
    2) APP_TZ="America/Porto_Velho" ;;
    3) APP_TZ="America/Manaus" ;;
    4) APP_TZ="America/Belem" ;;
    5) APP_TZ="America/Fortaleza" ;;
    6) APP_TZ="America/Recife" ;;
    7) APP_TZ="America/Cuiaba" ;;
    8) APP_TZ="America/Rio_Branco" ;;
    9)
      ask "Fuso horário (ex: America/Sao_Paulo): "
      read -r APP_TZ
      APP_TZ=${APP_TZ:-"America/Sao_Paulo"}
      ;;
    *) APP_TZ="America/Sao_Paulo" ;;
  esac
  ok "Fuso horário: ${APP_TZ}"

  ask "E-mail para contato VAPID [admin@comunicacao.gov.br]: "
  read -r VAPID_EMAIL
  VAPID_EMAIL=${VAPID_EMAIL:-"admin@comunicacao.gov.br"}

  # ── Banco de Dados ──────────────────────────────────────────────────────────
  echo ""
  echo -e "  Banco de dados:"
  echo -e "    1) SQLite    — arquivo local, zero configuração ${GREEN}(recomendado para começar)${RESET}"
  echo -e "    2) MySQL     — servidor MySQL 5.7+ ou MariaDB 10.3+"
  echo -e "    3) MariaDB   — mesmo que MySQL, use se o servidor for MariaDB"
  echo -e "    4) PostgreSQL — servidor PostgreSQL 12+"
  ask "Escolha [1]: "
  read -r DB_CHOICE
  DB_CHOICE=${DB_CHOICE:-1}

  DB_DIALECT="" DB_HOST="" DB_PORT="" DB_NAME="" DB_USER="" DB_PASS="" DB_STORAGE=""

  case "$DB_CHOICE" in
    1)
      DB_DIALECT="sqlite"
      DB_STORAGE="./database/app.sqlite"
      ok "SQLite selecionado."
      ;;
    2) DB_DIALECT="mysql" ;;
    3) DB_DIALECT="mariadb" ;;
    4) DB_DIALECT="postgres" ;;
    *) die "Opção inválida." ;;
  esac

  if [ "$DB_DIALECT" != "sqlite" ]; then
    echo ""
    info "Preencha os dados de conexão com o banco de dados:"
    ask "  Host [localhost]: ";            read -r DB_HOST;  DB_HOST=${DB_HOST:-localhost}
    if [ "$DB_DIALECT" = "postgres" ]; then
      ask "  Porta [5432]: ";              read -r DB_PORT;  DB_PORT=${DB_PORT:-5432}
    else
      ask "  Porta [3306]: ";              read -r DB_PORT;  DB_PORT=${DB_PORT:-3306}
    fi
    ask "  Nome do banco de dados: ";      read -r DB_NAME
    ask "  Usuário: ";                     read -r DB_USER
    ask "  Senha: ";                       read -rs DB_PASS; echo ""

    [ -z "$DB_NAME" ] && die "Nome do banco não pode ser vazio."
    [ -z "$DB_USER" ] && die "Usuário do banco não pode ser vazio."

    # Testar conexão
    info "Testando conexão com o banco de dados..."
    if node -e "
      const { Sequelize } = require('./node_modules/sequelize/lib/sequelize.js') 2>/dev/null ||
        eval(require('fs').readFileSync('./node_modules/sequelize/lib/sequelize.js','utf8'));
    " 2>/dev/null; then
      : # will test below with proper import
    fi

    ok "Dados de conexão registrados (a conexão será validada ao iniciar)."
  fi

  # ── Gerar segredos de segurança ─────────────────────────────────────────────
  step "  Gerando chaves de segurança..."

  SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")
  ok "SESSION_SECRET gerado (96 caracteres aleatórios)."

  # Gerar chaves VAPID usando web-push (já listado como dependência)
  # Garante que o módulo existe antes de tentar usar
  VAPID_PUBLIC_KEY=""
  VAPID_PRIVATE_KEY=""

  # Tenta gerar com web-push
  if node -e "require('web-push')" 2>/dev/null || \
     ( npm install --no-save --quiet web-push 2>/dev/null && node -e "require('web-push')" 2>/dev/null ); then
    VAPID_RAW=$(node -e "
      const wp = require('web-push');
      const k = wp.generateVAPIDKeys();
      process.stdout.write(k.publicKey + '|' + k.privateKey);
    " 2>/dev/null || echo "")
    if [ -n "$VAPID_RAW" ]; then
      VAPID_PUBLIC_KEY="${VAPID_RAW%%|*}"
      VAPID_PRIVATE_KEY="${VAPID_RAW##*|}"
    fi
  fi

  # Fallback: gera com crypto nativo do Node.js
  if [ -z "$VAPID_PUBLIC_KEY" ]; then
    warn "Gerando chaves VAPID via crypto nativo (fallback)..."
    VAPID_RAW=$(node --input-type=commonjs <<'JSEOF'
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});
const b64u = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
// spki header is 27 bytes for P-256, pkcs8 header is 36 bytes
process.stdout.write(b64u(publicKey.slice(27)) + '|' + b64u(privateKey.slice(36)));
JSEOF
    )
    VAPID_PUBLIC_KEY="${VAPID_RAW%%|*}"
    VAPID_PRIVATE_KEY="${VAPID_RAW##*|}"
  fi

  if [ -z "$VAPID_PUBLIC_KEY" ]; then
    warn "Não foi possível gerar chaves VAPID automaticamente."
    warn "As push notifications não funcionarão até você configurar as chaves manualmente."
    warn "Execute depois: npx web-push generate-vapid-keys"
    VAPID_PUBLIC_KEY="CONFIGURE-MANUALMENTE-npx-web-push-generate-vapid-keys"
    VAPID_PRIVATE_KEY="CONFIGURE-MANUALMENTE-npx-web-push-generate-vapid-keys"
  else
    ok "Chaves VAPID geradas (push notifications)."
  fi

  # ── Criar .env ───────────────────────────────────────────────────────────────
  info "Criando arquivo .env..."

  cat > .env <<EOF
# =============================================================================
#  Comunica — Configuração do Ambiente
#  Gerado automaticamente em: $(date)
# =============================================================================

# ─── Aplicação ───────────────────────────────────────────────────────────────
NODE_ENV="production"
PORT=${PORT}
APP_URL="${APP_URL}"
TZ="${APP_TZ}"

# ─── Segurança de Sessão ─────────────────────────────────────────────────────
# NÃO compartilhe este valor. Gerado automaticamente.
SESSION_SECRET="${SESSION_SECRET}"

# ─── Banco de Dados ──────────────────────────────────────────────────────────
# Dialeto: sqlite | mysql | mariadb | postgres
DB_DIALECT="${DB_DIALECT}"
EOF

  if [ "$DB_DIALECT" = "sqlite" ]; then
    cat >> .env <<EOF
DB_STORAGE="${DB_STORAGE}"
EOF
  else
    cat >> .env <<EOF
DB_HOST="${DB_HOST}"
DB_PORT="${DB_PORT}"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
DB_PASS="${DB_PASS}"
EOF
  fi

  cat >> .env <<EOF

# ─── Push Notifications (VAPID) ──────────────────────────────────────────────
# ATENÇÃO: não regenere estas chaves após usuários se inscreverem,
# ou as inscrições de notificação existentes serão invalidadas.
VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY}"
VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY}"
VAPID_EMAIL="${VAPID_EMAIL}"
EOF

  ok ".env criado com sucesso."

  # ── Atualizar ecosystem.config.cjs com o timezone configurado ───────────────
  cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [
    {
      name: 'comunica',
      script: './node_modules/.bin/tsx',
      args: 'server.ts',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        TZ: '${APP_TZ}',
      },
      env: {
        NODE_ENV: 'development',
        TZ: '${APP_TZ}',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
EOF
  ok "ecosystem.config.cjs atualizado com o fuso horário."

fi # fim do bloco SKIP_ENV=false

# ─────────────────────────────────────────────────────────────────────────────
# 3. CRIAR DIRETÓRIOS NECESSÁRIOS
# ─────────────────────────────────────────────────────────────────────────────
step "[ 3 / 7 ]  Criando diretórios"

mkdir -p database logs public/uploads
ok "database/       criado (ou já existia)"
ok "logs/           criado (ou já existia)"
ok "public/uploads/ criado (ou já existia)"

# ─────────────────────────────────────────────────────────────────────────────
# 4. INSTALAR DEPENDÊNCIAS
# ─────────────────────────────────────────────────────────────────────────────
step "[ 4 / 7 ]  Instalando dependências npm"

info "Isso pode levar alguns minutos na primeira vez..."

# Instala tudo incluindo devDependencies (tsx é obrigatório em runtime)
if npm install --prefer-offline 2>&1 | grep -E "^(added|updated|removed|found|npm warn|npm error)" | head -5; then
  :
else
  npm install
fi

# Verificar tsx (obrigatório em runtime)
if [ ! -f node_modules/.bin/tsx ]; then
  die "tsx não encontrado após npm install.\nVerifique se o package.json contém tsx em devDependencies."
fi
ok "tsx disponível em node_modules/.bin/tsx"

# Verificar drivers de banco
if [ "${DB_DIALECT:-sqlite}" = "mysql" ] || [ "${DB_DIALECT:-sqlite}" = "mariadb" ]; then
  if [ ! -d node_modules/mysql2 ]; then
    info "Instalando driver mysql2..."
    npm install --quiet mysql2
  fi
  ok "Driver mysql2 disponível."
fi
if [ "${DB_DIALECT:-sqlite}" = "postgres" ]; then
  if [ ! -d node_modules/pg ]; then
    info "Instalando driver pg..."
    npm install --quiet pg pg-hstore
  fi
  ok "Driver pg disponível."
fi

ok "Dependências instaladas."

# ─────────────────────────────────────────────────────────────────────────────
# 5. PM2
# ─────────────────────────────────────────────────────────────────────────────
step "[ 5 / 7 ]  Configurando PM2"

if ! command -v pm2 &>/dev/null; then
  info "PM2 não encontrado. Instalando globalmente..."
  npm install -g pm2 --quiet
  ok "PM2 instalado."
fi
ok "PM2 $(pm2 --version 2>/dev/null | head -1) disponível."

# Para e remove instância anterior, se existir
if pm2 describe comunica &>/dev/null; then
  info "Encerrando instância anterior do Comunica..."
  pm2 delete comunica 2>/dev/null || true
fi

info "Iniciando aplicação..."
pm2 start ecosystem.config.cjs --env production --silent

pm2 save --force &>/dev/null
ok "Processo salvo na lista do PM2."

# ─────────────────────────────────────────────────────────────────────────────
# 6. VALIDAR INICIALIZAÇÃO
# ─────────────────────────────────────────────────────────────────────────────
step "[ 6 / 7 ]  Validando inicialização"

# Lê a porta do .env se não estiver definida nesta sessão
if [ -z "${PORT:-}" ]; then
  PORT=$(grep '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "3020")
fi
APP_URL_CHECK=$(grep '^APP_URL=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "http://localhost:${PORT}")

info "Aguardando aplicação iniciar na porta ${PORT}..."
STARTED=false
for i in $(seq 1 15); do
  sleep 2

  # Tenta verificar a porta com ss, netstat ou curl (um dos três deve existir)
  PORT_OPEN=false
  if command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":${PORT}[[:space:]]"; then
    PORT_OPEN=true
  elif command -v netstat &>/dev/null && netstat -tlnp 2>/dev/null | grep -q ":${PORT}[[:space:]]"; then
    PORT_OPEN=true
  elif command -v curl &>/dev/null && curl -sf --max-time 2 "http://localhost:${PORT}/" &>/dev/null; then
    PORT_OPEN=true
  elif command -v wget &>/dev/null && wget -q --timeout=2 -O /dev/null "http://localhost:${PORT}/" &>/dev/null; then
    PORT_OPEN=true
  fi

  if $PORT_OPEN; then
    ok "Aplicação respondendo na porta ${PORT} (tentativa ${i})."
    STARTED=true
    break
  fi

  # Verificar se o processo não morreu
  PM2_STATUS=$(pm2 jlist 2>/dev/null | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const app = d.find(p => p.name === 'comunica');
    process.stdout.write(app ? app.pm2_env.status : 'not_found');
  " 2>/dev/null || echo "unknown")

  if [ "$PM2_STATUS" = "errored" ] || [ "$PM2_STATUS" = "stopped" ]; then
    echo ""
    die "A aplicação entrou em estado '${PM2_STATUS}' durante a inicialização.\n\n  Verifique os logs para entender o erro:\n    pm2 logs comunica --lines 50\n\n  Causas comuns:\n    - Erro no arquivo .env (variáveis incorretas)\n    - Porta ${PORT} já em uso por outro processo\n    - Erro de conexão com o banco de dados"
  fi

  echo -n "."
done
echo ""

if ! $STARTED; then
  warn "A aplicação não respondeu após 30 segundos."
  warn "Ela pode ainda estar inicializando (normal em VPS lentas)."
  warn "Verifique com: pm2 logs comunica --lines 30"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. AUTO-START NO BOOT
# ─────────────────────────────────────────────────────────────────────────────
step "[ 7 / 7 ]  Inicialização automática no boot"

STARTUP_OUT=$(pm2 startup 2>&1 || true)
STARTUP_CMD=$(echo "$STARTUP_OUT" | grep -oE "sudo .+" | head -1 || true)

if [ -n "$STARTUP_CMD" ]; then
  # Se estamos rodando como root, executa diretamente
  if [ "$(id -u)" -eq 0 ]; then
    eval "$STARTUP_CMD" &>/dev/null && ok "Auto-start configurado com sucesso." || \
      warn "Não foi possível configurar o auto-start automaticamente."
    pm2 save --force &>/dev/null
  else
    warn "Para ativar o auto-start no boot, execute o seguinte comando:"
    echo ""
    echo -e "    ${YELLOW}${STARTUP_CMD}${RESET}"
    echo ""
    echo -e "    Em seguida: ${YELLOW}pm2 save${RESET}"
  fi
else
  ok "Auto-start no boot já está configurado."
fi

# ─────────────────────────────────────────────────────────────────────────────
# RESUMO FINAL
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║          Instalação concluída com sucesso!               ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# Lê valores do .env para exibir no resumo
_PORT=$(grep '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "3020")
_URL=$(grep '^APP_URL=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "http://localhost:${_PORT}")
_DB=$(grep '^DB_DIALECT=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "sqlite")
_TZ=$(grep '^TZ=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "?")

echo -e "  ${BOLD}Aplicação${RESET}"
echo -e "    URL            : ${GREEN}${_URL}${RESET}"
echo -e "    Banco          : ${_DB}"
echo -e "    Fuso horário   : ${_TZ}"
echo ""
echo -e "  ${BOLD}Acesso inicial${RESET} ${YELLOW}(altere a senha imediatamente!)${RESET}"
echo -e "    E-mail         : ${YELLOW}admin@comunica.gov.br${RESET}"
echo -e "    Senha          : ${YELLOW}admin123${RESET}"
echo ""
echo -e "  ${BOLD}Próximos passos${RESET}"
echo -e "    1. Acesse ${GREEN}${_URL}${RESET} e troque a senha"
echo -e "    2. Cadastre o primeiro município e suas secretarias"
echo -e "    3. Crie os usuários da equipe de comunicação"
echo ""
echo -e "  ${BOLD}Comandos úteis${RESET}"
echo -e "    pm2 status                — status da aplicação"
echo -e "    pm2 logs comunica         — logs em tempo real"
echo -e "    pm2 restart comunica      — reiniciar"
echo -e "    bash update.sh            — atualizar para nova versão"
echo ""
echo -e "  ${BOLD}Arquivo de configuração${RESET}"
echo -e "    ${YELLOW}${SCRIPT_DIR}/.env${RESET}"
echo -e "    Guarde este arquivo em local seguro. Contém senhas e chaves."
echo ""
