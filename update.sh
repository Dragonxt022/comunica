#!/bin/bash
# Script de atualização — sincroniza com GitHub e reinicia a aplicação
set -e

APP_DIR="/home/buscamais-comunica/htdocs/comunica.buscamais.org"
APP_NAME="comunica"

cd "$APP_DIR"

echo "==> [1/5] Buscando atualizações do GitHub..."
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "     Já está na versão mais recente ($(git log -1 --format='%h %s'))."
else
  echo "     Novos commits encontrados:"
  git log --oneline HEAD..origin/main
  echo "==> [2/5] Aplicando atualização..."
  git reset --hard origin/main
fi

echo "==> [3/5] Instalando dependências..."
npm install 2>&1 | tail -3

echo "==> [4/5] Reiniciando aplicação via PM2..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME"
else
  pm2 start ecosystem.config.cjs --env production
fi

echo "==> [5/5] Aguardando inicialização..."
sleep 4

STATUS=$(pm2 describe "$APP_NAME" 2>/dev/null | grep "│ status" | awk -F'│' '{gsub(/ /,"",$3); print $3}' | head -1)

if [ "$STATUS" = "online" ]; then
  echo ""
  echo "✓ Aplicação online! Versão: $(git log -1 --format='%h — %s')"
else
  echo ""
  echo "✗ Atenção: status da aplicação é '$STATUS'. Verifique os logs:"
  echo "    pm2 logs $APP_NAME --lines 30"
  exit 1
fi
