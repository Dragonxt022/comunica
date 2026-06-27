// =============================================================================
//  Comunica — Configuração PM2
//  O fuso horário (TZ) é definido pelo setup.sh com base na escolha do usuário.
//  Para alterar manualmente, edite o valor de TZ abaixo e execute:
//    pm2 restart comunica
// =============================================================================

const fs = require('fs');
const path = require('path');

// Lê o TZ do .env automaticamente (fallback para America/Sao_Paulo)
let TZ = 'America/Sao_Paulo';
try {
  const envFile = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envFile, 'utf8');
  const match = envContent.match(/^TZ="?([^"\n]+)"?/m);
  if (match) TZ = match[1].trim();
} catch (_) {
  // .env não encontrado, usa o padrão
}

module.exports = {
  apps: [
    {
      name: 'comunica',

      // tsx executa TypeScript diretamente, sem compilação prévia
      script: './node_modules/.bin/tsx',
      args: 'server.ts',

      // Número de instâncias (1 = single process, 'max' = um por core da CPU)
      // Para ambientes pequenos, 1 é suficiente e mais fácil de debugar
      instances: 1,

      // Reinicia automaticamente se o processo cair
      autorestart: true,
      watch: false,

      // Reinicia se ultrapassar 512 MB de RAM (ajuste conforme o servidor)
      max_memory_restart: '512M',

      // Aguarda até 5s para a aplicação responder ao sinal de parada
      kill_timeout: 5000,

      // Variáveis de ambiente para produção (pm2 start --env production)
      env_production: {
        NODE_ENV: 'production',
        TZ,
      },

      // Variáveis de ambiente para desenvolvimento (pm2 start)
      env: {
        NODE_ENV: 'development',
        TZ,
      },

      // Logs separados por saída padrão e erros
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
