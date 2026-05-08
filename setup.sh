#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Comunica — Setup Automatizado para VPS
#  Uso: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

info()    { echo -e "${GREEN}✔${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
section() { echo -e "\n${BOLD}$*${RESET}"; }
die()     { echo -e "${RED}✘  $*${RESET}" >&2; exit 1; }

# ── Verificar Node.js ────────────────────────────────────────────────────────
section "Verificando requisitos..."

if ! command -v node &>/dev/null; then
  die "Node.js não encontrado. Instale a versão 18 ou superior: https://nodejs.org"
fi

NODE_VERSION=$(node -e "process.exit(parseInt(process.versions.node))" 2>&1 || node --version | grep -oP '\d+' | head -1)
NODE_MAJOR=$(node --version | grep -oP '^\d+' || node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "Node.js 18+ é necessário. Versão encontrada: $(node --version)"
fi
info "Node.js $(node --version) encontrado."

if ! command -v npm &>/dev/null; then
  die "npm não encontrado."
fi
info "npm $(npm --version) encontrado."

# ── Configuração do App ──────────────────────────────────────────────────────
section "Configuração da aplicação"

read -rp "  Porta da aplicação [3000]: " PORT
PORT=${PORT:-3000}

read -rp "  URL pública (ex: https://comunicacao.prefeitura.gov.br) [http://localhost:${PORT}]: " APP_URL
APP_URL=${APP_URL:-"http://localhost:${PORT}"}

# ── Banco de Dados ───────────────────────────────────────────────────────────
section "Banco de Dados"
echo "  1) SQLite  (recomendado para servidores simples)"
echo "  2) PostgreSQL"
echo "  3) MySQL / MariaDB"
read -rp "  Escolha [1]: " DB_CHOICE
DB_CHOICE=${DB_CHOICE:-1}

DB_DIALECT=""
DB_HOST=""
DB_PORT=""
DB_NAME=""
DB_USER=""
DB_PASS=""
DB_STORAGE=""
EXTRA_PKG=""

case "$DB_CHOICE" in
  1)
    DB_DIALECT="sqlite"
    DB_STORAGE="./database/app.sqlite"
    info "SQLite selecionado. Arquivo: ${DB_STORAGE}"
    ;;
  2)
    DB_DIALECT="postgres"
    EXTRA_PKG="pg pg-hstore"
    read -rp "  Host [localhost]: "      DB_HOST; DB_HOST=${DB_HOST:-localhost}
    read -rp "  Porta [5432]: "          DB_PORT; DB_PORT=${DB_PORT:-5432}
    read -rp "  Nome do banco: "         DB_NAME
    read -rp "  Usuário: "               DB_USER
    read -srp "  Senha: "                DB_PASS; echo
    ;;
  3)
    DB_DIALECT="mysql"
    EXTRA_PKG="mysql2"
    read -rp "  Host [localhost]: "      DB_HOST; DB_HOST=${DB_HOST:-localhost}
    read -rp "  Porta [3306]: "          DB_PORT; DB_PORT=${DB_PORT:-3306}
    read -rp "  Nome do banco: "         DB_NAME
    read -rp "  Usuário: "               DB_USER
    read -srp "  Senha: "                DB_PASS; echo
    ;;
  *)
    die "Opção inválida."
    ;;
esac

# ── Gerar SESSION_SECRET ─────────────────────────────────────────────────────
SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")
info "SESSION_SECRET gerado."

# ── Criar .env ───────────────────────────────────────────────────────────────
section "Criando arquivo .env..."

cat > .env <<EOF
# ─── App ────────────────────────────────────────────────────────────────────
NODE_ENV="production"
PORT=${PORT}
APP_URL="${APP_URL}"

# ─── Session ─────────────────────────────────────────────────────────────────
SESSION_SECRET="${SESSION_SECRET}"

# ─── Database ────────────────────────────────────────────────────────────────
DB_DIALECT="${DB_DIALECT}"
EOF

if [ "$DB_DIALECT" = "sqlite" ]; then
  echo "DB_STORAGE=\"${DB_STORAGE}\"" >> .env
else
  cat >> .env <<EOF
DB_HOST="${DB_HOST}"
DB_PORT="${DB_PORT}"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
DB_PASS="${DB_PASS}"
EOF
fi

info ".env criado com sucesso."

# ── Criar diretórios necessários ─────────────────────────────────────────────
section "Criando diretórios..."
mkdir -p database logs public/uploads
info "Diretórios: database/, logs/, public/uploads/"

# ── Instalar dependências ────────────────────────────────────────────────────
section "Instalando dependências npm..."
npm install --omit=dev

if [ -n "$EXTRA_PKG" ]; then
  info "Instalando driver de banco: ${EXTRA_PKG}"
  npm install $EXTRA_PKG
fi

# ── PM2 ─────────────────────────────────────────────────────────────────────
section "Configurando PM2..."

if ! command -v pm2 &>/dev/null; then
  warn "PM2 não encontrado. Instalando globalmente..."
  npm install -g pm2
fi
info "PM2 $(pm2 --version) disponível."

pm2 start ecosystem.config.cjs --env production
pm2 save
info "Aplicação iniciada e salva no PM2."

# ── Resumo ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║             Instalação concluída com sucesso!            ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  URL da aplicação : ${GREEN}${APP_URL}${RESET}"
echo -e "  Banco de dados   : ${DB_DIALECT}"
echo ""
echo -e "  ${BOLD}Credenciais padrão (altere imediatamente após o primeiro acesso):${RESET}"
echo -e "  E-mail  : ${YELLOW}admin@comunica.gov.br${RESET}"
echo -e "  Senha   : ${YELLOW}admin123${RESET}"
echo ""
echo -e "  Comandos úteis:"
echo -e "    pm2 status          — ver status do processo"
echo -e "    pm2 logs comunica   — ver logs em tempo real"
echo -e "    pm2 restart comunica — reiniciar a aplicação"
echo ""
