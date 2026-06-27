#!/usr/bin/env bash
# =============================================================================
#  Comunica — Script de Atualização
#  Uso: bash update.sh
#  Sincroniza com o GitHub e reinicia a aplicação automaticamente.
# =============================================================================
set -euo pipefail

# ── Cores e helpers ───────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

ok()    { echo -e "${GREEN}  ✔${RESET}  $*"; }
warn()  { echo -e "${YELLOW}  ⚠${RESET}  $*"; }
info()  { echo -e "${CYAN}  →${RESET}  $*"; }
step()  { echo -e "\n${BOLD}── $* ${RESET}"; }
die()   { echo -e "\n${RED}  ✘  ERRO: $*${RESET}\n" >&2; exit 1; }

APP_NAME="comunica"

# ── Detecta o diretório do projeto automaticamente ────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BOLD}${CYAN}  Comunica — Atualização${RESET}  ($(date '+%d/%m/%Y %H:%M:%S'))"
echo -e "  Diretório: ${SCRIPT_DIR}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. VERIFICAR GIT
# ─────────────────────────────────────────────────────────────────────────────
step "1/5  Verificando repositório"

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  die "Este diretório não é um repositório git.\n  Clone o projeto primeiro: git clone <url> ."
fi

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
  die "Nenhum remote 'origin' configurado.\n  Configure com: git remote add origin <url-do-repositorio>"
fi
ok "Repositório: ${REMOTE_URL}"
ok "Branch atual: $(git branch --show-current)"

# Verifica se há arquivos modificados que não sejam .env ou uploads
MODIFIED=$(git status --porcelain | grep -v '^\?\?' | grep -v '.env' | grep -v 'public/uploads' || true)
if [ -n "$MODIFIED" ]; then
  warn "Há arquivos modificados localmente que serão sobrescritos pela atualização:"
  echo "$MODIFIED" | while read -r line; do echo "    $line"; done
  echo ""
  echo -en "${YELLOW}  Deseja continuar mesmo assim? [s/N]: ${RESET}"
  read -r CONFIRM
  if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo "  Atualização cancelada."
    exit 0
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. BUSCAR ATUALIZAÇÕES
# ─────────────────────────────────────────────────────────────────────────────
step "2/5  Buscando atualizações em origin/main"

info "Conectando ao repositório remoto..."
git fetch origin 2>/dev/null || die "Não foi possível conectar ao repositório remoto.\nVerifique sua conexão com a internet."

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || die "Branch 'main' não encontrada no repositório remoto.")
CURRENT_VERSION=$(git log -1 --format='%h — %s' 2>/dev/null || echo "desconhecida")

if [ "$LOCAL" = "$REMOTE" ]; then
  ok "Já está na versão mais recente."
  echo -e "    Versão atual: ${CURRENT_VERSION}"
  echo ""
  echo -e "  Use ${CYAN}pm2 logs ${APP_NAME}${RESET} para verificar se a aplicação está saudável."
  echo ""
  exit 0
fi

# Mostra o que vai ser atualizado
COMMIT_COUNT=$(git rev-list --count HEAD..origin/main)
echo ""
echo -e "  ${BOLD}${COMMIT_COUNT} novo(s) commit(s) disponível(is):${RESET}"
git log --oneline HEAD..origin/main | while read -r line; do
  echo -e "    ${CYAN}•${RESET} ${line}"
done
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 3. APLICAR ATUALIZAÇÃO
# ─────────────────────────────────────────────────────────────────────────────
step "3/5  Aplicando atualização"

# Preserva o .env antes do reset
ENV_BACKUP=""
if [ -f .env ]; then
  ENV_BACKUP="/tmp/.comunica_env_$(date +%s)"
  cp .env "$ENV_BACKUP"
fi

git reset --hard origin/main

# Restaura o .env (o git reset não toca arquivos ignorados, mas por segurança)
if [ -n "$ENV_BACKUP" ] && [ ! -f .env ]; then
  cp "$ENV_BACKUP" .env
  warn ".env restaurado do backup temporário."
fi
[ -n "$ENV_BACKUP" ] && rm -f "$ENV_BACKUP"

ok "Código atualizado para: $(git log -1 --format='%h — %s')"

# ─────────────────────────────────────────────────────────────────────────────
# 4. ATUALIZAR DEPENDÊNCIAS
# ─────────────────────────────────────────────────────────────────────────────
step "4/5  Atualizando dependências"

# Verifica se o package.json mudou nesta atualização
PKG_CHANGED=$(git diff HEAD@{1} HEAD -- package.json 2>/dev/null | head -5 || true)
if [ -n "$PKG_CHANGED" ]; then
  info "package.json modificado — reinstalando dependências..."
  npm install --prefer-offline 2>&1 | grep -E "^(added|updated|removed)" | head -5 || true
  ok "Dependências atualizadas."
else
  ok "package.json não alterado — pulando npm install."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. REINICIAR APLICAÇÃO
# ─────────────────────────────────────────────────────────────────────────────
step "5/5  Reiniciando aplicação"

if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 restart "$APP_NAME" --silent
  ok "Aplicação reiniciada via PM2."
else
  warn "Processo '${APP_NAME}' não encontrado no PM2. Iniciando..."
  pm2 start ecosystem.config.cjs --env production --silent
  pm2 save --force &>/dev/null
  ok "Aplicação iniciada."
fi

# Aguarda a aplicação subir
info "Aguardando inicialização..."
PORT=$(grep '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "3020")
HEALTHY=false

for i in $(seq 1 10); do
  sleep 2

  # Tenta verificar porta ou HTTP
  IS_UP=false
  if command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":${PORT}[[:space:]]"; then
    IS_UP=true
  elif command -v netstat &>/dev/null && netstat -tlnp 2>/dev/null | grep -q ":${PORT}[[:space:]]"; then
    IS_UP=true
  elif command -v curl &>/dev/null && curl -sf --max-time 2 "http://localhost:${PORT}/" &>/dev/null; then
    IS_UP=true
  fi

  if $IS_UP; then
    HEALTHY=true
    break
  fi

  # Verifica se o PM2 não colocou em estado de erro
  PM2_STATUS=$(pm2 jlist 2>/dev/null | node -e "
    try {
      const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const a = d.find(p => p.name === '${APP_NAME}');
      process.stdout.write(a ? a.pm2_env.status : 'not_found');
    } catch(e) { process.stdout.write('unknown'); }
  " 2>/dev/null || echo "unknown")

  if [ "$PM2_STATUS" = "errored" ]; then
    echo ""
    die "A aplicação entrou em estado de erro após a atualização.\n\n  Verifique os logs:\n    pm2 logs ${APP_NAME} --lines 50\n\n  Para reverter para a versão anterior:\n    git log --oneline -5\n    git reset --hard <hash-da-versao-anterior>\n    pm2 restart ${APP_NAME}"
  fi

  echo -n "."
done
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# RESUMO
# ─────────────────────────────────────────────────────────────────────────────
echo ""
if $HEALTHY; then
  echo -e "${GREEN}  ✔  Atualização concluída!${RESET}"
else
  echo -e "${YELLOW}  ⚠  Atualização aplicada, mas a aplicação demorou mais que o esperado.${RESET}"
fi

echo ""
echo -e "  Versão anterior : ${YELLOW}${CURRENT_VERSION}${RESET}"
echo -e "  Versão atual    : ${GREEN}$(git log -1 --format='%h — %s')${RESET}"
echo ""
echo -e "  ${BOLD}Comandos úteis:${RESET}"
echo -e "    pm2 logs ${APP_NAME}         — ver logs em tempo real"
echo -e "    pm2 status                  — ver status do processo"
echo ""
