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
        TZ: 'America/Porto_Velho',
      },
      env: {
        TZ: 'America/Porto_Velho',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
