import express from 'express';
import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import dotenv from 'dotenv';
import sequelize from './src/config/database.ts';
import { Op } from 'sequelize';
import { User, Secretaria, Auditoria, Configuracao, Evento, Solicitacao, Release } from './src/database/models/index.ts';
import bcrypt from 'bcryptjs';
import authRoutes from './src/modules/auth/routes.ts';
import eventosRoutes from './src/modules/eventos/routes.ts';
import solicitacoesRoutes from './src/modules/solicitacoes/routes.ts';
import releasesRoutes from './src/modules/releases/routes.ts';
import adminRoutes from './src/modules/admin/routes.ts';
import relatoriosRoutes from './src/modules/relatorios/routes.ts';
import pushRoutes from './src/modules/push/routes.ts';
import notificacoesRoutes from './src/modules/notificacoes/routes.ts';
import { sendToRole, sendToUser } from './src/lib/push.ts';
import * as ImprensaController from './src/modules/imprensa/controller.ts';
import { isAuthenticated } from './src/middlewares/auth.middleware.ts';
import { sseBroker } from './src/lib/sse.ts';
import { getConfigCache, setConfigCache } from './src/lib/config-cache.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000');

// Trust Proxy (Essential for sessions behind Cloud Run / Iframe proxy)
app.set('trust proxy', 1);

// Session Setup
const SequelizeStore = connectSessionSequelize(session.Store);
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
});

// Middlewares
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src":      ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'self'"],
    },
  },
  xFrameOptions: false,
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-comunica',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  name: 'comunica.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

sessionStore.sync();

// Template Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

export const DEFAULT_STATUS_EVENTOS = [
  { key: 'em_planejamento', label: 'Em planejamento', cor: '#6366f1' },
  { key: 'em_producao',     label: 'Em produção',     cor: '#f59e0b' },
  { key: 'em_analise',      label: 'Em análise',      cor: '#3b82f6' },
  { key: 'concluido',       label: 'Concluído',        cor: '#10b981' },
  { key: 'publicado',       label: 'Publicado',        cor: '#059669' },
  { key: 'cancelado',       label: 'Cancelado',        cor: '#ef4444' },
];

// Global Variables Middleware
app.use(async (req, res, next) => {
  res.locals.user = (req as any).session.user || null;
  res.locals.path = req.path;

  const cached = getConfigCache();
  if (cached) {
    res.locals.config = cached.cfg;
    res.locals.statusEventos = cached.statusEventos;
    res.locals.metas = cached.metas;
  } else {
    try {
      const cfg = await Configuracao.findOne({ where: { id: 1 } });
      const statusEventos = cfg?.status_eventos
        ? JSON.parse(cfg.status_eventos as string)
        : DEFAULT_STATUS_EVENTOS;
      const metas = cfg?.metas_midia ? JSON.parse(cfg.metas_midia as string) : [];
      setConfigCache(cfg, statusEventos, metas);
      res.locals.config = cfg;
      res.locals.statusEventos = statusEventos;
      res.locals.metas = metas;
    } catch {
      res.locals.config = null;
      res.locals.statusEventos = DEFAULT_STATUS_EVENTOS;
      res.locals.metas = [];
    }
  }
  next();
});

// Seed Function
async function seed() {
  await sequelize.sync({ force: false });

  // Adiciona colunas novas sem recriar tabelas (SQLite não suporta ALTER bem via sync)
  const addCol = async (table: string, column: string, definition: string) => {
    try {
      await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    } catch (e: any) {
      if (!e.message?.toLowerCase().includes('duplicate column name')) throw e;
      // coluna já existe — sem ação necessária
    }
  };
  await addCol('releases', 'imagem_capa', 'VARCHAR(255) NULL');
  await addCol('releases', 'agendado_para', 'DATETIME NULL');
  await addCol('releases', 'secretaria_id', 'INTEGER NULL');
  await addCol('releases', 'link_publicacao', 'VARCHAR(500) NULL');
  await addCol('releases', 'print_publicacao_url', 'VARCHAR(500) NULL');
  await addCol('releases', 'print_publicacao_nome', 'VARCHAR(255) NULL');
  await addCol('configuracoes', 'status_eventos', 'TEXT NULL');
  await addCol('configuracoes', 'metas_midia', 'TEXT NULL');
  // PushSubscription e Notificacao são criados pelo sequelize.sync acima
  await addCol('configuracoes', 'facebook', 'VARCHAR(255) NULL');
  await addCol('configuracoes', 'youtube', 'VARCHAR(255) NULL');
  await addCol('configuracoes', 'twitter', 'VARCHAR(255) NULL');
  await addCol('configuracoes', 'whatsapp', 'VARCHAR(50) NULL');
  await addCol('users', 'avatar', 'VARCHAR(255) NULL');
  await addCol('users', 'celular', 'VARCHAR(50) NULL');
  await addCol('eventos', 'arquivado', 'BOOLEAN NOT NULL DEFAULT 0');
  await addCol('solicitacoes', 'arte_final_url', 'VARCHAR(500) NULL');
  await addCol('solicitacoes', 'arte_final_nome', 'VARCHAR(255) NULL');
  await addCol('solicitacoes', 'link_publicacao', 'VARCHAR(500) NULL');

  // Migrate old event statuses to new values (idempotent)
  await sequelize.query(`UPDATE eventos SET status = 'em_planejamento' WHERE status = 'pendente'`);
  await sequelize.query(`UPDATE eventos SET status = 'publicado' WHERE status = 'aprovado'`);
  
  const secretariaCount = await Secretaria.count();
  if (secretariaCount === 0) {
    const secAdmin = await Secretaria.create({
      nome: 'Comunicação (SECOM)',
      slug: 'secom',
      cor: '#ef4444',
      ativo: true,
    });

    const hash = await bcrypt.hash('admin123', 12);
    await User.create({
      nome: 'Administrador Master',
      email: 'admin@comunica.gov.br',
      senha_hash: hash,
      role: 'admin',
      ativo: true,
      secretaria_id: secAdmin.id,
    });
    
    console.log('Seed: Initial data created (Admin: admin@comunica.gov.br / admin123)');
  }
}

// Start Server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    await seed();
    
    // Public Routes
    app.use('/', authRoutes);
    app.get('/imprensa/agenda', ImprensaController.agendaPublica);
    app.get('/imprensa/releases/:id', ImprensaController.detalheRelease);
    
    // Health Check
    app.get('/health', (req, res) => res.send('OK'));
    
    // Protected Routes
    app.get('/', isAuthenticated, async (req, res) => {
      try {
        const sessionUser = (req as any).session.user;
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        weekEnd.setHours(23, 59, 59, 999);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const calStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const calEnd   = new Date(now.getFullYear(), now.getMonth() + 5, 1);

        const whereRole = sessionUser.role === 'secretaria'
          ? { secretaria_id: sessionUser.secretaria_id }
          : {};

        const [
          solicitacoesPendentes,
          eventosNaSemana,
          releasesPublicados,
          totalUsuativos,
          proximosEventos,
          solicitacoesRecentes,
        ] = await Promise.all([
          Solicitacao.count({ where: { status: 'pendente', ...whereRole } }),
          Evento.count({ where: { data_inicio: { [Op.between]: [today, weekEnd] } } }),
          Release.count({ where: { publicado: true } }),
          User.count({ where: { ativo: true } }),
          Evento.findAll({
            where: { data_inicio: { [Op.between]: [calStart, calEnd] }, arquivado: false },
            include: [{ model: Secretaria, as: 'secretaria' }],
            order: [['data_inicio', 'ASC']],
          }),
          Solicitacao.findAll({
            where: whereRole,
            include: [{ model: Secretaria, as: 'secretaria' }],
            order: [['created_at', 'DESC']],
            limit: 5,
          }),
        ]);

        // Progresso de metas do mês (apenas admin/secom)
        const metasProgresso: Record<string, number> = {};
        const metas: any[] = (res.locals.metas || []);
        if ((sessionUser.role === 'admin' || sessionUser.role === 'secom') && metas.length > 0) {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const solsMes = await Solicitacao.findAll({
            where: { createdAt: { [Op.gte]: startOfMonth } },
            attributes: ['tipo_midia'],
          });
          for (const s of solsMes) {
            metasProgresso[(s as any).tipo_midia] = (metasProgresso[(s as any).tipo_midia] || 0) + 1;
          }
        }

        res.render('index', {
          title: 'Dashboard',
          solicitacoesPendentes,
          eventosNaSemana,
          releasesPublicados,
          totalUsuativos,
          proximosEventos,
          solicitacoesRecentes,
          metas,
          metasProgresso,
        });
      } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // SSE — real-time events stream
    app.get('/sse', isAuthenticated, (req, res) => {
      sseBroker.connect(res);
    });

    // Modules
    app.use('/solicitacoes', isAuthenticated, solicitacoesRoutes);
    app.use('/eventos', isAuthenticated, eventosRoutes);
    app.use('/releases', isAuthenticated, releasesRoutes);
    app.use('/admin', isAuthenticated, adminRoutes);
    app.use('/relatorios', isAuthenticated, relatoriosRoutes);
    app.use('/push', pushRoutes);
    app.use('/notificacoes', notificacoesRoutes);

    // Lembrete de eventos próximos (a cada hora)
    setInterval(async () => {
      try {
        const agora = new Date();
        const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
        const em25h = new Date(agora.getTime() + 25 * 60 * 60 * 1000);
        const eventos = await Evento.findAll({
          where: { data_inicio: { [Op.between]: [em24h, em25h] }, arquivado: false },
          include: [{ model: Secretaria, as: 'secretaria' }],
        });
        for (const ev of eventos) {
          const hora = new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          await sendToRole(['admin', 'secom'], {
            title: '📅 Evento amanhã',
            body: `${ev.titulo} às ${hora}`,
            url: `/eventos`,
            tag: `evento-lembrete-${ev.id}`,
          });
        }
      } catch (e) { /* silencioso */ }
    }, 60 * 60 * 1000);

    // Audit helper available in req
    app.use((req, res, next) => {
      (req as any).audit = async (acao: string, entidade: string, entidade_id?: number) => {
        const user = (req as any).session.user;
        await Auditoria.create({
          user_id: user ? user.id : null,
          acao,
          entidade,
          entidade_id,
          ip: req.ip,
          user_agent: req.get('user-agent'),
        });
      };
      next();
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer();
