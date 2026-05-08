# Comunica

Plataforma de comunicação institucional para prefeituras municipais. Centraliza o gerenciamento de eventos, releases de imprensa, solicitações de comunicação e usuários em um único sistema web.

## Funcionalidades

- **Agenda de Eventos** — cadastro, kanban por status, agenda pública com filtros por secretaria
- **Releases de Imprensa** — criação com imagem de capa, agendamento de publicação, página pública de detalhe
- **Solicitações de Comunicação** — abertura e acompanhamento de chamados entre secretarias e SECOM
- **Gestão de Usuários e Secretarias** — CRUD completo com controle de permissões por perfil
- **Configurações do Site** — título, contato, redes sociais e status de eventos personalizáveis
- **Atualizações em tempo real** — notificações via SSE sem necessidade de refresh

## Perfis de Acesso

| Perfil | Permissões |
|---|---|
| **Secretaria** | Cadastra eventos e abre chamados para sua secretaria |
| **SECOM** | Gerencia comunicação, atende chamados, aprova eventos |
| **Imprensa** | Acesso somente leitura à agenda pública e releases |
| **Administrador** | Acesso completo: usuários, secretarias, releases e configurações |

## Requisitos

- **Node.js** 18 ou superior
- **npm** 8 ou superior
- **Banco de dados**: SQLite (padrão), PostgreSQL ou MySQL/MariaDB
- **PM2** (instalado automaticamente pelo script de setup)

## Deploy em VPS

### Setup automático (recomendado)

```bash
git clone <url-do-repositorio> comunica
cd comunica
bash setup.sh
```

O script irá:
1. Verificar a versão do Node.js
2. Solicitar configurações (porta, URL, banco de dados)
3. Gerar `SESSION_SECRET` aleatório
4. Criar o arquivo `.env`
5. Instalar dependências e driver de banco
6. Iniciar a aplicação com PM2

Após o setup, acesse a URL configurada e faça login com:

```
E-mail: admin@comunica.gov.br
Senha:  admin123
```

**Troque a senha imediatamente após o primeiro acesso.**

---

### Setup manual

```bash
# 1. Clonar e instalar
git clone <url-do-repositorio> comunica
cd comunica
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# 3. Criar diretórios
mkdir -p database logs public/uploads

# 4. Iniciar com PM2
npm install -g pm2
pm2 start ecosystem.config.cjs --env production
pm2 save
```

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `NODE_ENV` | Ambiente (`production` / `development`) | `development` |
| `PORT` | Porta da aplicação | `3000` |
| `APP_URL` | URL pública completa | `http://localhost:3000` |
| `SESSION_SECRET` | Chave secreta para sessões (string aleatória longa) | — |
| `DB_DIALECT` | Banco de dados: `sqlite`, `postgres`, `mysql`, `mariadb` | `sqlite` |
| `DB_STORAGE` | Caminho do arquivo SQLite | `./database/app.sqlite` |
| `DB_HOST` | Host do banco (postgres/mysql) | `localhost` |
| `DB_PORT` | Porta do banco (postgres/mysql) | `5432` / `3306` |
| `DB_NAME` | Nome do banco (postgres/mysql) | — |
| `DB_USER` | Usuário do banco (postgres/mysql) | — |
| `DB_PASS` | Senha do banco (postgres/mysql) | — |

Gere um `SESSION_SECRET` seguro com:

```bash
node -e "require('crypto').randomBytes(48).toString('hex')"
```

## Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name comunicacao.suaprefeitura.gov.br;

    # Redirecionar para HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name comunicacao.suaprefeitura.gov.br;

    ssl_certificate     /etc/letsencrypt/live/comunicacao.suaprefeitura.gov.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/comunicacao.suaprefeitura.gov.br/privkey.pem;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## PM2 — Comandos úteis

```bash
pm2 status                  # Ver status dos processos
pm2 logs comunica           # Logs em tempo real
pm2 restart comunica        # Reiniciar aplicação
pm2 stop comunica           # Parar aplicação
pm2 startup                 # Configurar autostart no boot do sistema
```

## Desenvolvimento local

```bash
# Instalar todas as dependências (incluindo devDependencies)
npm install

# Iniciar com hot-reload
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

## Estrutura do Projeto

```
comunica/
├── server.ts               # Entry point
├── ecosystem.config.cjs    # Configuração PM2
├── setup.sh                # Script de deploy
├── src/
│   ├── config/             # Configuração do banco de dados
│   ├── database/
│   │   └── models/         # Modelos Sequelize
│   ├── lib/                # Utilitários (SSE, cache)
│   ├── middlewares/        # Auth, upload
│   ├── modules/            # Módulos por domínio (auth, eventos, ...)
│   └── views/              # Templates EJS
├── public/                 # Arquivos estáticos e uploads
├── database/               # Arquivo SQLite (gerado automaticamente)
└── logs/                   # Logs do PM2
```

## Stack Técnica

- **Runtime**: Node.js + TypeScript (via `tsx`, sem compilação)
- **Framework**: Express 4
- **ORM**: Sequelize 6 (SQLite / PostgreSQL / MySQL)
- **Templates**: EJS + express-ejs-layouts
- **Frontend**: Tailwind CSS (CDN) + Alpine.js (CDN)
- **Sessões**: express-session + connect-session-sequelize
- **Upload**: Multer (disco local)
- **Tempo real**: Server-Sent Events (SSE)
