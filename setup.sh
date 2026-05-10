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

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
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

read -rp "  Porta da aplicação [3020]: " PORT
PORT=${PORT:-3020}

read -rp "  URL pública (ex: https://comunicacao.prefeitura.gov.br) [http://localhost:${PORT}]: " APP_URL
APP_URL=${APP_URL:-"http://localhost:${PORT}"}

read -rp "  E-mail para notificações VAPID [admin@comunica.gov.br]: " VAPID_EMAIL
VAPID_EMAIL=${VAPID_EMAIL:-"admin@comunica.gov.br"}

# ── Banco de Dados ───────────────────────────────────────────────────────────
section "Banco de Dados"
echo "  1) SQLite  (recomendado para servidores simples)"
echo "  2) MySQL / MariaDB  (recomendado para produção)"
echo "  3) PostgreSQL"
read -rp "  Escolha [1]: " DB_CHOICE
DB_CHOICE=${DB_CHOICE:-1}

DB_DIALECT=""
DB_HOST=""
DB_PORT=""
DB_NAME=""
DB_USER=""
DB_PASS=""
DB_STORAGE=""

case "$DB_CHOICE" in
  1)
    DB_DIALECT="sqlite"
    DB_STORAGE="./database/app.sqlite"
    info "SQLite selecionado. Arquivo: ${DB_STORAGE}"
    ;;
  2)
    DB_DIALECT="mysql"
    read -rp "  Host [localhost]: "      DB_HOST; DB_HOST=${DB_HOST:-localhost}
    read -rp "  Porta [3306]: "          DB_PORT; DB_PORT=${DB_PORT:-3306}
    read -rp "  Nome do banco: "         DB_NAME
    read -rp "  Usuário: "               DB_USER
    read -srp "  Senha: "                DB_PASS; echo
    ;;
  3)
    DB_DIALECT="postgres"
    read -rp "  Host [localhost]: "      DB_HOST; DB_HOST=${DB_HOST:-localhost}
    read -rp "  Porta [5432]: "          DB_PORT; DB_PORT=${DB_PORT:-5432}
    read -rp "  Nome do banco: "         DB_NAME
    read -rp "  Usuário: "               DB_USER
    read -srp "  Senha: "                DB_PASS; echo
    ;;
  *)
    die "Opção inválida."
    ;;
esac

# ── Gerar segredos ───────────────────────────────────────────────────────────
section "Gerando chaves de segurança..."

SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")
info "SESSION_SECRET gerado."

# Instala web-push temporariamente para gerar as chaves VAPID (caso ainda não exista)
if [ ! -f node_modules/.bin/web-push ] && [ ! -f node_modules/web-push/src/vapid-helper.js ]; then
  warn "Instalando web-push para gerar chaves VAPID..."
  npm install --no-save web-push &>/dev/null
fi

VAPID_KEYS=$(node -e "
  const webpush = require('web-push');
  const keys = webpush.generateVAPIDKeys();
  console.log(keys.publicKey + '|' + keys.privateKey);
")
VAPID_PUBLIC_KEY="${VAPID_KEYS%%|*}"
VAPID_PRIVATE_KEY="${VAPID_KEYS##*|}"
info "Chaves VAPID geradas (push notifications)."

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

cat >> .env <<EOF

# ─── Push Notifications (VAPID) ──────────────────────────────────────────────
VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY}"
VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY}"
VAPID_EMAIL="${VAPID_EMAIL}"
EOF

info ".env criado com sucesso."

# ── Criar diretórios necessários ─────────────────────────────────────────────
section "Criando diretórios..."
mkdir -p database logs public/uploads
info "Diretórios: database/, logs/, public/uploads/"

# ── Instalar dependências ────────────────────────────────────────────────────
section "Instalando dependências npm..."

# Instala tudo (incluindo devDependencies) porque o tsx é necessário em runtime
npm install

# Garante driver de banco instalado para MySQL/PostgreSQL (já estão no package.json,
# mas forçamos aqui para garantir após qualquer git reset)
if [ "$DB_DIALECT" = "mysql" ]; then
  if [ ! -d node_modules/mysql2 ]; then
    warn "mysql2 não encontrado — instalando..."
    npm install mysql2
  fi
fi
if [ "$DB_DIALECT" = "postgres" ]; then
  if [ ! -d node_modules/pg ]; then
    warn "pg não encontrado — instalando..."
    npm install pg pg-hstore
  fi
fi

# Verifica se tsx está disponível (é devDependency obrigatória em runtime)
if [ ! -f node_modules/.bin/tsx ]; then
  die "tsx não encontrado em node_modules/.bin/tsx após npm install. Verifique o package.json."
fi
info "tsx encontrado em node_modules/.bin/tsx."

# ── PM2 ─────────────────────────────────────────────────────────────────────
section "Configurando PM2..."

if ! command -v pm2 &>/dev/null; then
  warn "PM2 não encontrado. Instalando globalmente..."
  npm install -g pm2
fi
info "PM2 $(pm2 --version 2>/dev/null || echo '?') disponível."

# Para e remove instância anterior se existir
pm2 delete comunica 2>/dev/null || true

pm2 start ecosystem.config.cjs --env production
pm2 save

# Aguarda inicialização e verifica porta
info "Aguardando inicialização da aplicação..."
for i in $(seq 1 12); do
  sleep 2
  if ss -tlnp 2>/dev/null | grep -q ":${PORT}"; then
    info "Aplicação ouvindo na porta ${PORT}."
    break
  fi
  if [ "$i" -eq 12 ]; then
    warn "Aplicação não respondeu na porta ${PORT} após 24s."
    warn "Verifique os logs: pm2 logs comunica --lines 30"
  fi
done

# ── Configura PM2 para iniciar no boot ──────────────────────────────────────
section "Configurando inicialização automática no boot..."
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" || true)
if [ -n "$PM2_STARTUP" ]; then
  warn "Execute o seguinte comando para ativar o boot automático:"
  echo -e "  ${YELLOW}${PM2_STARTUP}${RESET}"
else
  info "Boot automático já configurado."
fi

# ── Resumo ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║             Instalação concluída com sucesso!            ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  URL da aplicação   : ${GREEN}${APP_URL}${RESET}"
echo -e "  Banco de dados     : ${DB_DIALECT}"
echo -e "  Push notifications : ${GREEN}configurado (VAPID)${RESET}"
echo ""
echo -e "  ${BOLD}Credenciais padrão (altere imediatamente após o primeiro acesso):${RESET}"
echo -e "  E-mail  : ${YELLOW}admin@comunica.gov.br${RESET}"
echo -e "  Senha   : ${YELLOW}admin123${RESET}"
echo ""
echo -e "  ${BOLD}Comandos úteis:${RESET}"
echo -e "    pm2 status              — ver status do processo"
echo -e "    pm2 logs comunica       — ver logs em tempo real"
echo -e "    pm2 restart comunica    — reiniciar a aplicação"
echo -e "    bash update.sh          — atualizar do GitHub"
echo ""
echo -e "  ${BOLD}Importante:${RESET} guarde o arquivo ${YELLOW}.env${RESET} em local seguro."
echo -e "  As chaves VAPID não podem ser regeneradas sem invalidar"
echo -e "  as inscrições de push existentes nos navegadores dos usuários."
echo ""
